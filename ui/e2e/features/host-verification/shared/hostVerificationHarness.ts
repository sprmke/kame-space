import { expect, type Locator } from '@playwright/test';

import { seedSupabaseAuthSession } from '../../../shared/authSeam';

import type { Page, Route } from '@playwright/test';

/**
 * One state object drives both windows: the host dashboard/onboarding and the super-admin
 * approvals console. Mutations from either side are immediately visible to the other, which
 * is what makes the two-window review test meaningful.
 */

export type VerificationStatus = 'none' | 'pending' | 'approved' | 'rejected';
export type RejectionKind = 'changes' | 'rejected' | null;
export type VerificationAssetKey =
  | 'validIdPath'
  | 'socialProofPath'
  | 'selfieWithIdPath'
  | 'platformAdminProofPath'
  | 'businessPermitOrBirPath';

export type IdentitySummary = {
  id: string;
  verdict: string;
  method: string;
  document_type: string | null;
  full_name: string | null;
  signature_valid: boolean;
  liveness_grade: string | null;
  face_match_verdict: string | null;
  flags: Array<{ code: string; severity: string; detail?: string }>;
  verified_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export type HostVerificationState = {
  org: { id: string; slug: string; name: string; hostModes: string[] };
  baseStatus: VerificationStatus;
  enhancedStatus: VerificationStatus;
  baseRejectionKind: RejectionKind;
  baseRejectionReason: string | null;
  baseChangesRequestedDocs: Array<'validId' | 'socialProof'>;
  enhancedRejectionKind: RejectionKind;
  enhancedRejectionReason: string | null;
  assets: Partial<Record<VerificationAssetKey, string | null>>;
  identity: IdentitySummary | null;
  /** Tier 2 (Recommended) entitlement. */
  tier2Entitled: boolean;
  /** Handoff session state, mutated by the phone window. */
  sessionStatus: 'pending' | 'completed' | 'expired';
  sessionVerdict: string;
  sessionSubmitStatus: number;
  calls: {
    createOrg: number;
    submitOrg: number;
    uploads: string[];
    approve: string[];
    reject: string[];
    identityCreate: number;
    identityUpload: number;
    identitySubmit: number;
  };
  lastSubmitOrgBody: Record<string, unknown> | null;
  lastRejectBody: Record<string, unknown> | null;
};

export const HOST_VERIFICATION_ORG = {
  id: 'org-host-001',
  slug: 'kame-homes',
  name: 'Kame Homes',
  hostModes: ['property'],
};

export function createHostVerificationState(
  overrides: Partial<HostVerificationState> = {}
): HostVerificationState {
  return {
    org: HOST_VERIFICATION_ORG,
    baseStatus: 'pending',
    enhancedStatus: 'none',
    baseRejectionKind: null,
    baseRejectionReason: null,
    baseChangesRequestedDocs: [],
    enhancedRejectionKind: null,
    enhancedRejectionReason: null,
    assets: {
      validIdPath: 'org/org-host-001/valid_id/valid-id.jpg',
      socialProofPath: 'org/org-host-001/social_proof/facebook.png',
      selfieWithIdPath: null,
      platformAdminProofPath: null,
      businessPermitOrBirPath: null,
    },
    identity: null,
    tier2Entitled: true,
    sessionStatus: 'pending',
    sessionVerdict: 'partially_verified',
    sessionSubmitStatus: 200,
    calls: {
      createOrg: 0,
      submitOrg: 0,
      uploads: [],
      approve: [],
      reject: [],
      identityCreate: 0,
      identityUpload: 0,
      identitySubmit: 0,
    },
    lastSubmitOrgBody: null,
    lastRejectBody: null,
    ...overrides,
  };
}

export function verificationSettings(state: HostVerificationState): Record<string, unknown> {
  return {
    verification: {
      baseStatus: state.baseStatus,
      enhancedStatus: state.enhancedStatus,
      socialPlatform: null,
      platformAdminPlatform: null,
      propertyRelationship: null,
      propertyContractEndDate: null,
      parkingRelationship: null,
      parkingContractEndDate: null,
      baseSubmittedAt: state.baseStatus === 'none' ? null : '2026-11-01T00:00:00.000Z',
      enhancedSubmittedAt: null,
      baseRejectionReason: state.baseRejectionReason,
      enhancedRejectionReason: state.enhancedRejectionReason,
      baseRejectionKind: state.baseRejectionKind,
      enhancedRejectionKind: state.enhancedRejectionKind,
      baseChangesRequestedDocs: state.baseChangesRequestedDocs,
      assets: {
        validIdPath: state.assets.validIdPath ?? null,
        socialProofPath: state.assets.socialProofPath ?? null,
        selfieWithIdPath: state.assets.selfieWithIdPath ?? null,
        platformAdminProofPath: state.assets.platformAdminProofPath ?? null,
        legitimacyCheckProofPath: null,
        businessPermitOrBirPath: state.assets.businessPermitOrBirPath ?? null,
        propertyOwnershipProofPath: null,
        parkingSocialProofPath: null,
        ownershipProofPath: null,
        azurePmoConfirmationPath: null,
        pmoEmailPaths: [],
      },
    },
  };
}

function serializeOrganization(state: HostVerificationState) {
  return {
    id: state.org.id,
    name: state.org.name,
    slug: state.org.slug,
    description: null,
    logoUrl: null,
    hostModes: state.org.hostModes,
    settings: verificationSettings(state),
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  };
}

function approvalSummary(state: HostVerificationState) {
  const pending = state.baseStatus === 'pending' || state.enhancedStatus === 'pending';
  return {
    type: 'org_verification' as const,
    organizationId: state.org.id,
    organizationName: state.org.name,
    organizationSlug: state.org.slug,
    hostModes: state.org.hostModes,
    ownerName: 'E2E Host',
    ownerEmail: 'host@example.com',
    baseStatus: state.baseStatus,
    baseSubmittedAt: '2026-11-01T00:00:00.000Z',
    baseRejectionReason: state.baseRejectionReason,
    baseRejectionKind: state.baseRejectionKind,
    enhancedStatus: state.enhancedStatus,
    enhancedSubmittedAt: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    unitConflicts: [],
    hasActiveUnitConflict: false,
    propertyConsiderationStatus: 'none',
    parkingConsiderationStatus: 'none',
    hasPendingConsideration: false,
    propertyAccessLocked: false,
    parkingAccessLocked: false,
    pending,
  };
}

/**
 * Mirror of `DEFAULT_PLAN_FEATURES` in the app. The plan presentation ranks a plan by
 * reading nested keys (`teamManagement.enabled`, `marketingMediaLibrary.storageMb`), so a
 * partial object crashes the shell instead of failing the gate.
 */
const BASE_PLAN_FEATURES = {
  automatedBookingFlow: false,
  verifiedBadgeEligible: false,
  recommendedBadgeEligible: false,
  telegramNotifications: false,
  teamManagement: { enabled: false, maxMembers: null as number | null },
  searchVisibilityTier: 'none',
  marketingPublishLimitPerGroup: 0,
  aiValidations: false,
  aiMonthlyCreditAllowance: 0,
  marketingStudio: false,
  customPages: false,
  propertyShowcase: false,
  aiDashboardAssistant: false,
  aiReceptionist: false,
  aiMarketingGeneration: false,
  aiMarketingImageGeneration: false,
  aiMarketingVideoGeneration: false,
  aiChatAutoReply: false,
  fullyManagedByPlatform: false,
  financeReporting: false,
  maintenanceReporting: false,
  metaChatChannel: false,
  quickReplies: false,
  customTemplates: false,
  publicPagesAutosave: false,
  bookingImport: false,
  calendarSync: false,
  reviewAutomation: false,
  smartPricing: false,
  customRoles: false,
  copyPropertySettings: false,
  analyticsInsights: false,
  activityLogExport: false,
  marketingMediaLibrary: {
    storageMb: 100,
    maxFiles: 30,
    maxImageMb: 10,
    maxVideoMb: 50,
    maxVideoSec: 30,
    maxAudioMb: 15,
    dailyUploads: 20,
  },
};

const pngFixture = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAPAAAACgCAIAAAC9uXYyAAAACXBIWXMAAAPoAAAD6AG1e1JrAAADQElEQVR4nO3WwQkAUQwC0d9/q3uZEraMgDywgKCD8dVHHGgFg3d+AXEgQIOAA2loELT+Ek2O+wwoQIOAA2loELT+EEyO+wwoQIOAA2loELT+EEyO+wwoQIOAA2loELT+EEyO+wwoQIOAA2loELT+EEyO+wwoQIOAA2loELT+EEyO+wwoQIOAA2loELT+EEyO+wwoQIOAA2loELT+EEyO+wwoQIOAA2loELT+EEyO+wwoQIOAA2loELT+EEyO+wwoQIOAA2loELT+EEyO+wwoQIOAA2loELT+EEyO+wwoQIOAA2loELT+EEyO+wwoQIOAA2loELT+EEyO+wwoQIOAA2loELT+EEyO+wwoQIOAA2loELT+EEyO+wwoQIOAA2loELT+EEyO+wwoQIOAA2loELT+EEyO+wwoQIOAA2loELT+EEyO+wwoQIOAA2loELT+EEyO+wwoQIOAA2loELT+EEyO+wwoQIOAA2loELT+EEyO+wwoQIOAA2loELT+EEyO+wwoQIOAA2loELT+EEyO+wwoQIOAA2loELT+EEyO+wwoQIOAA2loELT+EEyO+wwoQIOAA2loELT+EEyO+wwoQIOAA2loELT+EEyO+wwoQIOAA2loELT+EEyO+wwoQIOAA2loEMw7YHLcZ0ABGgQcSEODoPWHYHLcZ0ABGgQcSEODoPWHYHLcZ0ABGgQcSEODoPWHYHLcZ0ABGgQcSEODoPWHYHLcZ0ABGgQcSEODoPWHYHLcZ0ABGgQcSEODoPWHYHLcZ0ABGgQcSEODoPWHYHLcZ0ABGgQcSEODoPWHYHLcZ0ABGgQcSEODoPWHYHLcZ0ABGgQcSEODoPWHYHLcZ0ABGgQcSEODoPWHYHLcZ0ABGgQcSEODoPWHYHLcZ0ABGgQcSEODoPWHYHLcZ0ABGgQcSEODoPWHYHLcZ0ABGgQcSEODoPWHYHLcZ0ABGgQcSEODoPWHYHLcZ0ABGgQcSEODoPWHYHLcZ0ABGgQcSEODoPWHYHLcZ0ABGgQcSEODoPWHYHLcZ0ABGgQcSEODoPWHYHLcZ0ABGgQcSEODoPWHYHLcZ0ABGgQcSEODoPWHYHLcZ0ABGgQcSEODoPWH8AN1QgqOtWstnQAAAABJRU5ErkJggg==',
  'base64'
);

export const E2E_IMAGE_FILE = {
  name: 'e2e-id.png',
  mimeType: 'image/png',
  buffer: pngFixture,
};

/** Abort MediaPipe so the liveness step deterministically degrades to "Continue". */
async function blockLivenessCdn(page: Page) {
  await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort());
  await page.route('https://storage.googleapis.com/mediapipe-models/**', (route) => route.abort());
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

export type HostVerificationMockOptions = {
  /** Seed a super-admin session instead of a host session. */
  asSuperAdmin?: boolean;
  /** Registration: the host owns no organization yet. */
  noOrganization?: boolean;
  /** Override the app origin used in the handoff URL. */
  appOrigin?: string;
};

export async function installHostVerificationMocks(
  page: Page,
  state: HostVerificationState,
  options: HostVerificationMockOptions = {}
) {
  await seedSupabaseAuthSession(page, 'host');
  await blockLivenessCdn(page);

  const origin = options.appOrigin ?? 'http://127.0.0.1:4173';

  await page.route('**/functions/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.split('/').pop() ?? '';
    const method = route.request().method();

    switch (endpoint) {
      case 'list-organizations':
        await fulfillJson(route, {
          success: true,
          data: {
            // Registration starts with no org; once `create-organization` has run, the
            // same window must see it — that is what the post-onboarding assertions read.
            organizations:
              options.asSuperAdmin || (options.noOrganization && state.calls.createOrg === 0)
                ? []
                : [serializeOrganization(state)],
            isSuperAdmin: Boolean(options.asSuperAdmin),
          },
        });
        return;

      case 'org-access':
        // The org shell gates every section on this payload; without it the route renders
        // "No organization access" before the sidebar CTA can mount.
        await fulfillJson(route, {
          success: true,
          data: {
            accessKind: 'owner',
            permissions: [
              'org.dashboard:view',
              'org.bookings:view',
              'org.reviews:view',
              'org.properties:view',
              'org.parkings:view',
              'org.team:view',
              'org.settings:view',
              'org.plans:view',
              'org.analytics:view',
              'org.activity:view',
            ],
            memberId: null,
            canListAllProperties: true,
            orgId: state.org.id,
            orgSlug: state.org.slug,
            orgName: state.org.name,
            canManageTeam: true,
            canInviteTeam: true,
            canCreateProperties: true,
            canManageProperties: true,
            canCreateParkings: true,
            canManageParkings: true,
            canEditBasicSettings: true,
            canEditSocials: true,
            canEditAiPlatform: true,
            canEditAiAssistant: true,
            canEditSettings: true,
          },
        });
        return;

      case 'check-organization-name':
      case 'check-property-name':
        await fulfillJson(route, { success: true, data: { available: true, message: null } });
        return;

      case 'check-tower-unit':
        await fulfillJson(route, {
          success: true,
          data: { available: true, hasActiveListing: false, message: null, conflict: null },
        });
        return;

      case 'list-properties':
        await fulfillJson(route, { success: true, data: { properties: [] } });
        return;

      case 'list-activity-log':
        // The activity page maps `events`, so an empty object crashes it.
        await fulfillJson(route, { success: true, data: { events: [], nextCursor: null } });
        return;

      case 'org-plan':
        await fulfillJson(route, {
          success: true,
          data: {
            plans: [
              {
                id: 'plan-tier',
                code: state.tier2Entitled ? 'growth' : 'starter',
                name: state.tier2Entitled ? 'Pro' : 'Starter',
                isDefault: true,
                features: { ...BASE_PLAN_FEATURES, recommendedBadgeEligible: state.tier2Entitled },
              },
            ],
            properties: [],
            subscription: null,
            assignedPropertyIds: [],
            pendingCheckoutUrl: null,
            pendingCheckoutPlanId: null,
            transactions: [],
          },
        });
        return;

      case 'get-org-verification-assets':
        await fulfillJson(route, {
          success: true,
          data: {
            organization: serializeOrganization(state),
            verification: verificationSettings(state).verification,
            identityVerification: state.identity,
            assetUrls: {
              validIdUrl: null,
              socialProofUrl: null,
              selfieWithIdUrl: null,
              platformAdminProofUrl: null,
              legitimacyCheckProofUrl: null,
              businessPermitOrBirUrl: null,
              propertyOwnershipProofUrl: null,
              parkingSocialProofUrl: null,
              ownershipProofUrl: null,
              azurePmoConfirmationUrl: null,
              opsProofUrl: null,
              pmoEmailUrls: [],
            },
          },
        });
        return;

      case 'upload-org-verification-asset': {
        const form = route.request().postDataBuffer()?.toString() ?? '';
        const assetType = /name="assetType"\r?\n\r?\n([^\r\n]+)/.exec(form)?.[1] ?? 'unknown';
        state.calls.uploads.push(assetType);
        const path = `org/${state.org.id}/${assetType}/e2e-upload.jpg`;
        if (assetType === 'valid_id') state.assets.validIdPath = path;
        if (assetType === 'social_proof') state.assets.socialProofPath = path;
        if (assetType === 'selfie_with_id') state.assets.selfieWithIdPath = path;
        await fulfillJson(route, {
          success: true,
          data: { path, previewUrl: null, assetType, verification: verificationSettings(state).verification },
        });
        return;
      }

      case 'submit-org-verification': {
        state.calls.submitOrg += 1;
        state.lastSubmitOrgBody = JSON.parse(route.request().postData() ?? '{}') as Record<
          string,
          unknown
        >;
        const tier = state.lastSubmitOrgBody.tier === 'enhanced' ? 'enhanced' : 'base';
        if (tier === 'base') {
          state.baseStatus = 'pending';
          state.baseRejectionKind = null;
          state.baseRejectionReason = null;
          state.baseChangesRequestedDocs = [];
        } else {
          state.enhancedStatus = 'pending';
          state.enhancedRejectionKind = null;
          state.enhancedRejectionReason = null;
        }
        await fulfillJson(route, {
          success: true,
          data: { organization: serializeOrganization(state) },
        });
        return;
      }

      case 'create-organization': {
        state.calls.createOrg += 1;
        await fulfillJson(route, {
          success: true,
          data: {
            organization: serializeOrganization(state),
            property: null,
            parking: null,
            linkedIdentityVerificationId: state.identity?.id ?? null,
          },
        });
        return;
      }

      case 'submit-listing-authorization':
      case 'submit-listing-recommended':
        await fulfillJson(route, { success: true, data: {} });
        return;

      case 'list-super-admin-approvals': {
        const isSummary = url.searchParams.get('summary') === 'true';
        const visible =
          state.baseStatus === 'pending' || state.enhancedStatus === 'pending';
        if (isSummary) {
          await fulfillJson(route, {
            success: true,
            data: {
              summary: {
                total: visible ? 1 : 0,
                pending: visible ? 1 : 0,
                orgVerifications: visible ? 1 : 0,
                listingVerifications: 0,
                reviews: 0,
              },
            },
          });
          return;
        }
        await fulfillJson(route, {
          success: true,
          data: { approvals: visible ? [approvalSummary(state)] : [], total: visible ? 1 : 0 },
        });
        return;
      }

      case 'approve-org-verification': {
        state.calls.approve.push(method);
        const body = JSON.parse(route.request().postData() ?? '{}') as { tier?: string };
        if (body.tier === 'enhanced') state.enhancedStatus = 'approved';
        else state.baseStatus = 'approved';
        await fulfillJson(route, {
          success: true,
          data: { organization: serializeOrganization(state) },
        });
        return;
      }

      case 'reject-org-verification': {
        state.calls.reject.push(method);
        state.lastRejectBody = JSON.parse(route.request().postData() ?? '{}') as Record<
          string,
          unknown
        >;
        const body = state.lastRejectBody;
        const kind = body.kind === 'changes' ? 'changes' : 'rejected';
        if (body.tier === 'enhanced') {
          state.enhancedStatus = 'rejected';
          state.enhancedRejectionKind = kind;
          state.enhancedRejectionReason = String(body.reason ?? '');
        } else {
          state.baseStatus = 'rejected';
          state.baseRejectionKind = kind;
          state.baseRejectionReason = String(body.reason ?? '');
          state.baseChangesRequestedDocs = kind === 'changes' ? ['validId'] : [];
        }
        await fulfillJson(route, {
          success: true,
          data: { organization: serializeOrganization(state) },
        });
        return;
      }

      case 'identity-session-create': {
        state.calls.identityCreate += 1;
        await fulfillJson(route, {
          success: true,
          data: {
            sessionId: 'session-e2e-1',
            token: 'token-e2e-1',
            expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
            verifyUrl: `${origin}/verify/token-e2e-1`,
            qrPayload: `${origin}/verify/token-e2e-1`,
            subjectKind: 'org_owner',
            guestSlot: null,
          },
        });
        return;
      }

      case 'identity-session-get': {
        if (state.sessionStatus === 'expired') {
          await fulfillJson(route, { success: false, error: 'This link expired.' }, 410);
          return;
        }
        await fulfillJson(route, {
          success: true,
          data: {
            sessionId: 'session-e2e-1',
            verificationId: state.sessionStatus === 'completed' ? 'ver-e2e-1' : null,
            status: state.sessionStatus,
            step: state.sessionStatus === 'completed' ? 'done' : 'captured',
            expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
            verdict: state.sessionStatus === 'completed' ? state.sessionVerdict : null,
            flags: [],
            documentType: state.sessionStatus === 'completed' ? 'philid' : null,
            maskedName: state.sessionStatus === 'completed' ? 'E2E H.' : null,
            subjectKind: 'org_owner',
            guestSlot: null,
            expired: state.sessionStatus === 'expired',
          },
        });
        return;
      }

      case 'identity-session-upload':
        state.calls.identityUpload += 1;
        await fulfillJson(route, {
          success: true,
          data: { path: 'org_owner/owner-1/session-e2e-1/document_front.jpg', kind: 'document_front' },
        });
        return;

      case 'identity-session-submit': {
        state.calls.identitySubmit += 1;
        if (state.sessionSubmitStatus !== 200) {
          await fulfillJson(
            route,
            { success: false, error: 'We could not verify this document.' },
            state.sessionSubmitStatus
          );
          return;
        }
        state.sessionStatus = 'completed';
        await fulfillJson(route, {
          success: true,
          data: {
            sessionId: 'session-e2e-1',
            verificationId: 'ver-e2e-1',
            status: 'completed',
            verdict: state.sessionVerdict,
            flags: [],
            documentType: 'philid',
            maskedName: 'E2E H.',
          },
        });
        return;
      }

      case 'identity-verification-mine':
        await fulfillJson(route, { success: true, data: { hasIdentity: false, verification: null } });
        return;

      default:
        // Let unmocked endpoints fail naturally against the dev server rather than feed a
        // wrong shape into a component that then throws.
        await route.continue();
    }
  });
}

/**
 * Walk the phone capture flow to completion. Uses the upload fallback (deterministic) and
 * the liveness CDN block so the step degrades to "Continue" instead of loading a 13 MB model.
 */
export async function completeIdentityCaptureOnPhone(page: Page) {
  await expectVisible(page, 'Check your identity');

  const continueButton = page.getByRole('button', { name: 'Continue' });
  await page.getByRole('checkbox', { name: /I agree to this check/i }).check();
  await expect(continueButton).toBeEnabled({ timeout: 15_000 });
  await continueButton.click();

  await page.getByRole('button', { name: /Take a photo of an ID/i }).click();
  await page.getByRole('button', { name: /Upload a photo instead/i }).click();
  const fileInput = page.locator('input[type="file"][accept*="image/jpeg"]').last();
  await fileInput.setInputFiles(E2E_IMAGE_FILE);
  // The preview is the proof the file reached the flow; without it Continue stays disabled.
  await expectVisibleByLocator(page, page.locator('img[alt="Captured ID"]'));
  await continueButton.click();

  // A photo method also asks for the back of the card.
  const skipBack = page.getByRole('button', { name: 'Skip this side' });
  if (await skipBack.isVisible().catch(() => false)) await skipBack.click();

  // Liveness is blocked at the network layer, so the step offers Continue.
  await continueButton.waitFor({ state: 'visible', timeout: 20_000 });
  await expect(continueButton).toBeEnabled({ timeout: 20_000 });
  await continueButton.click();

  await expectVisible(page, 'Done');
}

async function expectVisibleByLocator(page: Page, locator: Locator) {
  await locator.first().waitFor({ state: 'visible', timeout: 20_000 });
}

/** Complete the capture inline (desktop "Use this device"), which needs no phone tab. */
export async function completeIdentityCaptureInline(page: Page) {
  await page.getByRole('button', { name: /Use this device/i }).click();
  await completeIdentityCaptureOnPhone(page);
}

async function expectVisible(page: Page, text: string | RegExp) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout: 20_000 });
}
