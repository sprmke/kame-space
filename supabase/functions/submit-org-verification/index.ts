/**
 * submit-org-verification — Owner submits host Tier 1 (base) or Tier 2 (enhanced) for review.
 * Host scope only: identity and platform presence. Listing authority, rights, and contract end
 * dates go through submit-listing-authorization.
 * Auth: verifyOrgOwner via orgId in body.
 */

import { verifyOrgOwner, createServiceClient, serializeOrganization } from '../_shared/orgAuth.ts';
import {
  canSubmitBaseVerification,
  canSubmitEnhancedVerification,
  ORG_SOCIAL_PROOF_PLATFORMS,
  orgVerificationToSettingsValue,
  readOrgVerificationFromSettings,
  type OrgSocialProofPlatform,
} from '../_shared/orgVerification.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { catchPlanFeatureError, requireOrgPropertyFeature } from '../_shared/planEntitlements.ts';
import { capturePostHogEvent } from '../_shared/posthog.ts';
import {
  isOrgEligibleForHostRewardGateBypass,
  maybeGrantHostVerificationReward,
} from '../_shared/hostVerificationReward.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { ORG_VERIFICATION_BUCKET } from '../_shared/orgVerification.ts';
import { IDENTITY_CAPTURE_BUCKET } from '../_shared/identitySessionService.ts';
import { buildActorContext, logActivity } from '../_shared/activityLog.ts';

/**
 * A host who verified from their phone during the handoff never has the capture in the
 * browser, so the Valid ID asset would be missing and the submit would fail on
 * "Required: valid ID". Resolve it from the verdict instead: download the captured front
 * image and drop it into `org-verification-assets` under the same key an upload would use.
 *
 * The verdict must belong to this owner and this org (or be unattached, for a verdict made
 * during registration), and must still be unexpired. Anything else returns null and the
 * normal "required" error stands.
 */
async function resolveValidIdFromIdentity(input: {
  supabase: ReturnType<typeof createServiceClient>;
  organizationId: string;
  ownerUserId: string;
  identityVerificationId: string;
}): Promise<{ path: string; verificationId: string } | null> {
  const { data, error } = await input.supabase
    .from('identity_verifications')
    .select('id, owner_user_id, organization_id, expires_at, document_front_path')
    .eq('id', input.identityVerificationId)
    .maybeSingle();
  if (error || !data) return null;

  const row = data as {
    id: string;
    owner_user_id: string | null;
    organization_id: string | null;
    expires_at: string | null;
    document_front_path: string | null;
  };
  if (row.owner_user_id !== input.ownerUserId) return null;
  if (row.organization_id && row.organization_id !== input.organizationId) return null;
  if (row.expires_at && Date.parse(row.expires_at) < Date.now()) return null;
  if (!row.document_front_path) return null;

  const { data: blob, error: downloadError } = await input.supabase.storage
    .from(IDENTITY_CAPTURE_BUCKET)
    .download(row.document_front_path);
  if (downloadError || !blob) return null;

  const mime = blob.type || 'image/jpeg';
  const extension = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const path = `org/${input.organizationId}/valid_id/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await input.supabase.storage
    .from(ORG_VERIFICATION_BUCKET)
    .upload(path, blob, { upsert: false, contentType: mime, cacheControl: '31536000' });
  if (uploadError) {
    console.error('[submit-org-verification] identity capture copy:', uploadError.message);
    return null;
  }

  // Attach the verdict to this org if it was made during registration.
  if (!row.organization_id) {
    await input.supabase
      .from('identity_verifications')
      .update({ organization_id: input.organizationId })
      .eq('id', row.id)
      .is('organization_id', null);
  }

  return { path, verificationId: row.id };
}

serveAuthenticated('submit-org-verification', async (req) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);

  const orgId = typeof body.orgId === 'string' ? body.orgId.trim() : '';
  const tier = body.tier === 'enhanced' ? 'enhanced' : body.tier === 'base' ? 'base' : '';
  if (!orgId) return jsonError(req, 'orgId is required');
  if (!tier) return jsonError(req, 'tier must be base or enhanced');

  const { user, org } = await verifyOrgOwner(req, orgId);
  const supabase = createServiceClient();

  const identityVerificationId =
    typeof body.identityVerificationId === 'string' ? body.identityVerificationId.trim() : '';

  const currentSettings =
    org.settings && typeof org.settings === 'object' && !Array.isArray(org.settings)
      ? (org.settings as Record<string, unknown>)
      : {};
  let verification = readOrgVerificationFromSettings(currentSettings);

  if (tier === 'base') {
    if (!verification.assets.validIdPath && identityVerificationId) {
      const resolved = await resolveValidIdFromIdentity({
        supabase,
        organizationId: orgId,
        ownerUserId: user.id,
        identityVerificationId,
      });
      if (resolved) {
        verification = {
          ...verification,
          assets: { ...verification.assets, validIdPath: resolved.path },
        };
      }
    }

    if (verification.baseStatus === 'approved') {
      return jsonError(req, 'Base verification is already approved');
    }
    if (verification.baseStatus === 'rejected' && verification.baseRejectionKind === 'rejected') {
      return jsonError(req, 'This verification was declined. Please start a new application.');
    }

    if (!canSubmitBaseVerification(verification)) {
      const missing: string[] = [];
      if (!verification.assets.validIdPath) missing.push('valid ID');
      if (!verification.assets.socialProofPath) missing.push('Facebook Page screenshot');
      return jsonError(req, `Required: ${missing.join(', ')}`);
    }

    verification = {
      ...verification,
      baseStatus: 'pending',
      baseSubmittedAt: new Date().toISOString(),
      baseRejectionReason: null,
      baseRejectionKind: null,
      baseChangesRequestedDocs: [],
    };
  } else {
    const rewardGateBypass = await isOrgEligibleForHostRewardGateBypass(orgId);
    if (!rewardGateBypass) {
      try {
        await requireOrgPropertyFeature(orgId, 'recommendedBadgeEligible');
      } catch (err) {
        const planErr = catchPlanFeatureError(req, err);
        if (planErr) return planErr;
        throw err;
      }
    }

    if (verification.enhancedStatus === 'approved') {
      return jsonError(req, 'Enhanced verification is already approved');
    }

    const platformRaw =
      typeof body.platformAdminPlatform === 'string' ? body.platformAdminPlatform.trim() : '';
    if (platformRaw) {
      if (!ORG_SOCIAL_PROOF_PLATFORMS.includes(platformRaw as OrgSocialProofPlatform)) {
        return jsonError(req, 'platformAdminPlatform must be facebook, instagram, or airbnb');
      }
      verification = {
        ...verification,
        platformAdminPlatform: platformRaw as OrgSocialProofPlatform,
      };
    }

    if (!canSubmitEnhancedVerification(verification)) {
      return jsonError(req, 'Required: selfie with ID');
    }

    verification = {
      ...verification,
      enhancedStatus: 'pending',
      enhancedSubmittedAt: new Date().toISOString(),
      enhancedRejectionReason: null,
      enhancedRejectionKind: null,
    };
  }

  const { data, error } = await supabase
    .from('organizations')
    .update({
      settings: {
        ...currentSettings,
        verification: orgVerificationToSettingsValue(verification),
      },
    })
    .eq('id', orgId)
    .select('*')
    .single();

  if (error || !data) {
    console.error('[submit-org-verification]', error?.message);
    return jsonError(req, 'Failed to submit verification', 500);
  }

  let rewardGrant: Awaited<ReturnType<typeof maybeGrantHostVerificationReward>> | null = null;
  if (tier === 'enhanced') {
    try {
      rewardGrant = await maybeGrantHostVerificationReward(orgId, {
        trigger: 'recommended_verification_submitted',
        assignedBy: user.id,
      });
    } catch (err) {
      console.error('[submit-org-verification] reward grant', err);
    }
  }

  await logActivity({
    action: 'verification.submitted',
    organizationId: orgId,
    scope: 'org',
    actor: buildActorContext(
      'dashboard',
      { authUser: user, actorType: 'org_owner', role: 'owner' },
      req
    ),
    targetType: 'verification',
    targetId: orgId,
    targetLabel: org.name ?? 'the organization',
    metadata: {
      kind: tier === 'enhanced' ? 'enhanced host verification' : 'base host verification',
      ...(identityVerificationId ? { via: 'live_identity' } : {}),
    },
  });

  await capturePostHogEvent('host_verification_submitted', {
    logPrefix: 'submit-org-verification',
    request: req,
    distinctId: user.id,
    groups: { organization: orgId },
    properties: { tier_requested: tier },
  });

  return jsonSuccess(req, {
    organization: serializeOrganization(data),
    verification: {
      baseStatus: verification.baseStatus,
      enhancedStatus: verification.enhancedStatus,
      platformAdminPlatform: verification.platformAdminPlatform,
      verifiedBadge: verification.enhancedStatus === 'approved',
    },
    rewardGrant,
  });
});
