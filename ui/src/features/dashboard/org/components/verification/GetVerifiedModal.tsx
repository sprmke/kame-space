import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';

import { useLocation, useParams } from 'react-router-dom';

import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, BadgeCheck, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  isParkingAdminPath,
  isPropertyAdminPath,
} from '@/features/dashboard/bookings/lib/adminSidebarNav';
import { OrgListingVerificationRollup } from '@/features/dashboard/org/components/listing-authorization/OrgListingVerificationRollup';
import { OnboardingHostVerificationSection } from '@/features/dashboard/org/components/onboarding/OnboardingHostVerificationSection';
import { HostIdentityVerifyButton } from '@/features/verification/components/HostIdentityVerifyButton';
import { OnboardingProofUpload } from '@/features/dashboard/org/components/onboarding/OnboardingProofUpload';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { RecommendedBadgePreview } from '@/features/dashboard/org/components/verification/RecommendedBadgePreview';
import { VerificationChecklist } from '@/features/dashboard/org/components/verification/VerificationChecklist';
import {
  VerificationSectionCard,
  VerificationSectionCount,
} from '@/features/dashboard/org/components/verification/VerificationSectionCard';
import { VerificationStatusBanner } from '@/features/dashboard/org/components/verification/VerificationStatusBanner';
import {
  defaultVerificationStepIndex,
  VerificationTierProgress,
} from '@/features/dashboard/org/components/verification/VerificationTierProgress';
import {
  ORGANIZATIONS_QUERY_KEY,
  useOrganizations,
} from '@/features/dashboard/org/hooks/useOrganizations';
import { handleAiMutationError, isAiQuotaError } from '@/features/dashboard/org/lib/aiQuotaToast';
import { callEdgeFunction, getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';
import {
  validateVerificationFile,
  shouldShowGetVerifiedCta,
  type OrgVerificationStatus,
} from '@/features/dashboard/org/lib/orgVerification';
import {
  buildHostTierChecklist,
  buildVerifiedTierChecklist,
  recommendedTierDocumentChecklistItems,
  hostTierDocumentChecklistItems,
  buildVerificationTiers,
  canSubmitHostTier,
  canSubmitVerifiedTier,
  isHostVerificationChangesRequestedFromDetail,
  isHostVerificationHardRejectedFromDetail,
  readOrgVerificationDetail,
  resolveHostModes,
  verificationSidebarLabel,
  type VerificationTierDefinition,
} from '@/features/dashboard/org/lib/orgVerificationTiers';
import {
  VERIFICATION_BENEFIT_BULLETS,
  VERIFICATION_REVIEW_TIMELINE,
  VERIFICATION_SIDEBAR_SUBLABEL,
  VERIFICATION_TIER2_APPROVED,
  VERIFICATION_TIER2_DOC_HELP,
  VERIFICATION_TIER2_DOC_LABELS,
} from '@/features/dashboard/org/lib/verificationCopy';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';
import { useHostRewardOffer } from '@/features/dashboard/setup-guide/hooks/useHostRewardOffer';

import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { prepareUpload } from '@/lib/media/prepareUpload';
import { PLATFORM_APP_NAME, platformProductLabel } from '@/lib/platformBranding';
import { cn } from '@/lib/utils';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;

// Pulls in a PDF-rendering chain (pdfjs-dist) — this file is imported eagerly by the
// dashboard shell (`AdminLayout.tsx` via `GetVerifiedSidebarCta`), so keep pdfjs-dist
// out of the main bundle by deferring this specific import until the modal opens.
const VerificationTier1SubmittedDocs = lazy(() =>
  import('@/features/dashboard/org/components/verification/VerificationTier1SubmittedDocs').then(
    (m) => ({ default: m.VerificationTier1SubmittedDocs })
  )
);

type ProofSlot = {
  file: File | null;
  previewUrl: string | null;
  path: string | null;
};

const emptySlot = (): ProofSlot => ({ file: null, previewUrl: null, path: null });

function useCurrentOrganization() {
  const { data } = useOrganizations();
  const { orgSlug } = useParams<{ orgSlug?: string }>();
  const orgContext = useOptionalOrgContext();
  const slug = orgSlug ?? orgContext?.org.slug;
  const bySlug = data?.organizations.find((o) => o.slug === slug);
  return bySlug ?? orgContext?.org ?? data?.organizations[0] ?? null;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When true, host cannot dismiss — must Resubmit (changes requested). */
  forced?: boolean;
  /** Render the flow in-place (no nested dialog). */
  embedded?: boolean;
  /** Pin host (0) or Recommended (1). Hides the inner tier switcher. */
  lockedStep?: 0 | 1;
  /** Hide listing Open links that would leave this surface. */
  hideListingOpen?: boolean;
};

async function uploadVerificationAsset(
  orgId: string,
  assetType: string,
  file: File
): Promise<{ path: string; previewUrl: string | null }> {
  const prepared = await prepareUpload(file, {
    imagePreset: 'DOCUMENT',
    surface: `org-verification-${assetType}`,
  });
  if (prepared.error) throw new Error(prepared.error);
  const preparedFile = prepared.file;

  const jwt = await getSessionJwt();
  const body = new FormData();
  body.append('orgId', orgId);
  body.append('assetType', assetType);
  body.append('file', preparedFile);
  body.append('fileName', preparedFile.name);

  const res = await fetch(`${FUNCTIONS_URL}/upload-org-verification-asset`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body,
  });
  const json = (await res.json()) as {
    success?: boolean;
    error?: string;
    data?: { path: string; previewUrl: string | null };
  };
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? 'Upload failed');
  }
  return json.data;
}

function slotReady(slot: ProofSlot): boolean {
  return Boolean(slot.file || slot.path);
}

function slotRequiredError(touched: boolean, submitting: boolean, slot: ProofSlot): string | null {
  if (!touched || submitting || slotReady(slot)) return null;
  return 'Required';
}

function VerificationFeedbackAlert({
  kind,
  title,
  message,
}: {
  kind: 'changes' | 'rejected';
  title: string;
  message: string;
}) {
  const isChanges = kind === 'changes';

  return (
    <div
      role="alert"
      className={cn(
        'flex gap-3 rounded-xl border px-4 py-3.5',
        isChanges
          ? 'border-amber-500/40 bg-amber-500/10'
          : 'border-destructive/40 bg-destructive/10'
      )}
    >
      <AlertCircle
        className={cn(
          'mt-0.5 size-5 shrink-0',
          isChanges ? 'text-amber-600 dark:text-amber-400' : 'text-destructive'
        )}
        aria-hidden
      />
      <div className="min-w-0 space-y-1">
        <p
          className={cn(
            'text-sm font-semibold leading-snug',
            isChanges ? 'text-amber-900 dark:text-amber-100' : 'text-destructive dark:text-red-200'
          )}
        >
          {title}
        </p>
        <p className="text-foreground whitespace-pre-wrap text-sm leading-relaxed">{message}</p>
      </div>
    </div>
  );
}

function ListingVerificationRollupSection({
  orgId,
  orgSlug,
  modalOpen,
  allowUpload,
  hideOpen,
}: {
  orgId?: string;
  orgSlug?: string;
  modalOpen?: boolean;
  allowUpload?: boolean;
  hideOpen?: boolean;
}) {
  if (!orgId || !orgSlug) return null;
  return (
    <OrgListingVerificationRollup
      orgId={orgId}
      orgSlug={orgSlug}
      enabled={Boolean(modalOpen)}
      allowUpload={allowUpload}
      hideOpen={hideOpen}
    />
  );
}

function VerifiedTierStepPanel({
  tier,
  checklist,
  pendingNote,
  rejectionReason,
  rejectionKind,
  changesResubmit = false,
  orgId,
  orgSlug,
  modalOpen,
  allowListingUpload,
  hideListingOpen,
  showSubmittedDocs,
  children,
}: {
  tier: VerificationTierDefinition;
  checklist: ReturnType<typeof buildHostTierChecklist>;
  pendingNote: boolean;
  rejectionReason: string | null;
  rejectionKind: 'changes' | 'rejected' | null;
  /** Streamlined layout for forced Tier 1 changes-requested resubmit. */
  changesResubmit?: boolean;
  orgId?: string;
  orgSlug?: string;
  modalOpen?: boolean;
  allowListingUpload?: boolean;
  hideListingOpen?: boolean;
  showSubmittedDocs?: boolean;
  children?: ReactNode;
}) {
  const documentChecklist = hostTierDocumentChecklistItems(checklist);
  const doneCount = documentChecklist.filter((item) => item.complete).length;
  const approved = tier.status === 'approved';
  const rejected = tier.status === 'rejected';
  const isChangesResubmit = changesResubmit && rejectionKind === 'changes';
  const hasUploads = Boolean(children);
  const canHostCopy = PLATFORM_APP_NAME
    ? `You can host on ${platformProductLabel()}.`
    : 'You can start hosting.';

  const submittedDocsSection =
    showSubmittedDocs && orgId ? (
      <Suspense fallback={null}>
        <VerificationTier1SubmittedDocs
          orgId={orgId}
          enabled={Boolean(modalOpen)}
          items={checklist}
          tierStatus={tier.status}
          framed={false}
          hideGaps={isChangesResubmit}
        />
      </Suspense>
    ) : null;

  return (
    <div className="space-y-3">
      {isChangesResubmit && rejectionReason ? (
        <VerificationFeedbackAlert
          kind="changes"
          title="What to update"
          message={rejectionReason}
        />
      ) : rejected && rejectionReason ? (
        <VerificationFeedbackAlert
          kind={rejectionKind === 'changes' ? 'changes' : 'rejected'}
          title={rejectionKind === 'changes' ? 'What to update' : 'Rejection reason'}
          message={rejectionReason}
        />
      ) : null}

      {hasUploads ? (
        <VerificationSectionCard
          title={isChangesResubmit ? 'Replace documents' : 'Documents to upload'}
          description={
            isChangesResubmit
              ? 'Replace the flagged files, then resubmit.'
              : 'Add both files, then submit for review.'
          }
          meta={
            <VerificationSectionCount>
              {doneCount}/{documentChecklist.length}
            </VerificationSectionCount>
          }
        >
          {children}
        </VerificationSectionCard>
      ) : null}

      {submittedDocsSection ? (
        <VerificationSectionCard
          title={isChangesResubmit ? 'Previously submitted' : 'Submitted documents'}
          description={pendingNote ? VERIFICATION_REVIEW_TIMELINE : undefined}
          meta={
            isChangesResubmit || pendingNote ? undefined : (
              <VerificationSectionCount>
                {doneCount}/{documentChecklist.length}
              </VerificationSectionCount>
            )
          }
          bodyClassName="px-0 pb-0"
        >
          {submittedDocsSection}
        </VerificationSectionCard>
      ) : !hasUploads ? (
        <VerificationSectionCard title="Documents">
          <VerificationChecklist items={checklist} compact />
        </VerificationSectionCard>
      ) : null}

      {approved ? (
        <p className="text-muted-foreground flex items-center gap-1.5 px-0.5 text-xs leading-snug">
          <Check className="size-3.5 shrink-0 text-emerald-600" strokeWidth={2.5} aria-hidden />
          {canHostCopy}
        </p>
      ) : null}

      <ListingVerificationRollupSection
        orgId={orgId}
        orgSlug={orgSlug}
        modalOpen={modalOpen}
        allowUpload={allowListingUpload}
        hideOpen={hideListingOpen}
      />
    </div>
  );
}

function RecommendedTierSubmittedDocs({
  orgId,
  modalOpen,
  checklist,
  tierStatus,
}: {
  orgId: string;
  modalOpen: boolean;
  checklist: ReturnType<typeof buildVerifiedTierChecklist>;
  tierStatus: OrgVerificationStatus;
}) {
  const documentChecklist = recommendedTierDocumentChecklistItems(checklist);
  const doneCount = documentChecklist.filter((item) => item.complete).length;

  if (documentChecklist.length === 0) return null;

  return (
    <VerificationSectionCard
      title="Submitted documents"
      meta={
        <VerificationSectionCount>
          {doneCount}/{documentChecklist.length}
        </VerificationSectionCount>
      }
      bodyClassName="px-0 pb-0"
    >
      <Suspense fallback={null}>
        <VerificationTier1SubmittedDocs
          orgId={orgId}
          enabled={modalOpen}
          items={checklist}
          tierStatus={tierStatus}
          tier="recommended"
          framed={false}
        />
      </Suspense>
    </VerificationSectionCard>
  );
}

function RecommendedTierStepPanel({
  tier,
  orgName,
  orgId,
  orgSlug,
  modalOpen,
  allowListingUpload,
  hideListingOpen,
  checklist,
  showSubmittedDocs,
  verifiedApproved,
  verifiedPending,
  enhancedStatus,
  enhancedRejectionKind,
  enhancedRejectionReason,
  selfie,
  platformAdmin,
  businessPermit,
  verifiedTouched,
  onSelfieChange,
  onPlatformAdminChange,
  onBusinessPermitChange,
}: {
  tier: VerificationTierDefinition;
  orgName?: string | null;
  orgId?: string;
  orgSlug?: string;
  modalOpen: boolean;
  allowListingUpload?: boolean;
  hideListingOpen?: boolean;
  checklist: ReturnType<typeof buildVerifiedTierChecklist>;
  showSubmittedDocs: boolean;
  verifiedApproved: boolean;
  verifiedPending: boolean;
  enhancedStatus: OrgVerificationStatus;
  enhancedRejectionKind: 'changes' | 'rejected' | null;
  enhancedRejectionReason: string | null;
  selfie: ProofSlot;
  platformAdmin: ProofSlot;
  businessPermit: ProofSlot;
  verifiedTouched: boolean;
  onSelfieChange: (file: File | null, previewUrl: string | null) => void;
  onPlatformAdminChange: (file: File | null, previewUrl: string | null) => void;
  onBusinessPermitChange: (file: File | null, previewUrl: string | null) => void;
}) {
  const listingRollup = (
    <ListingVerificationRollupSection
      orgId={orgId}
      orgSlug={orgSlug}
      modalOpen={modalOpen}
      allowUpload={allowListingUpload}
      hideOpen={hideListingOpen}
    />
  );
  const submittedDocsSection =
    showSubmittedDocs && orgId ? (
      <RecommendedTierSubmittedDocs
        orgId={orgId}
        modalOpen={modalOpen}
        checklist={checklist}
        tierStatus={tier.status}
      />
    ) : null;

  if (verifiedApproved) {
    return (
      <div className="space-y-3">
        <VerificationStatusBanner
          tone="success"
          title="Badge is live"
          detail={VERIFICATION_TIER2_APPROVED}
        />
        {submittedDocsSection}
        {listingRollup}
      </div>
    );
  }

  if (verifiedPending) {
    return (
      <div className="space-y-3">
        <VerificationStatusBanner
          tone="pending"
          title="In review"
          detail={VERIFICATION_REVIEW_TIMELINE}
        />
        {submittedDocsSection}
        {listingRollup}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {enhancedStatus === 'rejected' ? (
        <VerificationFeedbackAlert
          kind={enhancedRejectionKind === 'changes' ? 'changes' : 'rejected'}
          title={enhancedRejectionKind === 'changes' ? 'What to update' : 'Rejection reason'}
          message={enhancedRejectionReason ?? 'Replace the documents below and submit again.'}
        />
      ) : null}

      <VerificationSectionCard
        title="Documents"
        description="The selfie with your ID is required. The other two are optional."
      >
        <div className="space-y-3.5">
          <OnboardingProofUpload
            id="enhanced-selfie"
            label={VERIFICATION_TIER2_DOC_LABELS.selfie}
            help={VERIFICATION_TIER2_DOC_HELP.selfie}
            file={selfie.file}
            previewUrl={selfie.previewUrl}
            error={verifiedTouched && !slotReady(selfie) ? 'Required' : null}
            compact
            onFileChange={onSelfieChange}
          />
          <OnboardingProofUpload
            id="enhanced-platform-admin"
            label={`${VERIFICATION_TIER2_DOC_LABELS.platformAdmin} (optional)`}
            help={VERIFICATION_TIER2_DOC_HELP.platformAdmin}
            required={false}
            file={platformAdmin.file}
            previewUrl={platformAdmin.previewUrl}
            compact
            onFileChange={onPlatformAdminChange}
          />
          <OnboardingProofUpload
            id="enhanced-business-permit"
            label={`${VERIFICATION_TIER2_DOC_LABELS.businessPermit} (optional)`}
            help={VERIFICATION_TIER2_DOC_HELP.businessPermit}
            required={false}
            file={businessPermit.file}
            previewUrl={businessPermit.previewUrl}
            compact
            onFileChange={onBusinessPermitChange}
          />
        </div>
      </VerificationSectionCard>

      {submittedDocsSection && enhancedStatus === 'rejected' ? submittedDocsSection : null}

      <VerificationSectionCard title="Why upgrade">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,12rem)] sm:items-center sm:gap-4">
          <ul className="space-y-1.5">
            {VERIFICATION_BENEFIT_BULLETS.map((bullet) => (
              <li
                key={bullet}
                className="text-foreground flex items-start gap-2 text-xs leading-snug"
              >
                <Check
                  className="text-primary mt-px size-3.5 shrink-0"
                  strokeWidth={2.5}
                  aria-hidden
                />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
          <RecommendedBadgePreview hostName={orgName} />
        </div>
      </VerificationSectionCard>

      {listingRollup}
    </div>
  );
}

export function GetVerifiedModal({
  open,
  onOpenChange,
  forced = false,
  embedded = false,
  lockedStep,
  hideListingOpen = false,
}: Props) {
  const queryClient = useQueryClient();
  const org = useCurrentOrganization();
  const { canUse: canSubmitRecommendedBadge, isLoading: recommendedEntitlementsLoading } =
    useFeatureGate('recommendedBadgeEligible');
  const { data: hostRewardOffer } = useHostRewardOffer(org?.id);
  const rewardBypass = Boolean(hostRewardOffer?.enabled && hostRewardOffer.eligible);
  const canSubmitRecommended = canSubmitRecommendedBadge || rewardBypass;
  const { open: openUpgradeModal } = useUpgradeModal();
  const detail = readOrgVerificationDetail(org?.settings);
  const hostModes = resolveHostModes(org);
  const tiers = buildVerificationTiers(detail);
  const hostChecklist = buildHostTierChecklist(detail);
  const verifiedChecklist = buildVerifiedTierChecklist(detail);

  const hostRejected = detail.baseStatus === 'rejected';
  const hostChangesRequested = isHostVerificationChangesRequestedFromDetail(detail);
  const hostHardRejected = isHostVerificationHardRejectedFromDetail(detail);
  const blockDismiss = forced || hostChangesRequested;

  const showTier1SubmittedDocs = detail.baseStatus !== 'none';
  const showTier2SubmittedDocs = detail.enhancedStatus !== 'none';
  const allowListingUpload = org?.accessKind === 'owner' || org?.accessKind === 'platform_admin';

  const resolvedOpen = embedded || open;

  const [validId, setValidId] = useState<ProofSlot>(emptySlot);
  const [socialProof, setSocialProof] = useState<ProofSlot>(emptySlot);

  const [selfie, setSelfie] = useState<ProofSlot>(emptySlot);
  const [platformAdmin, setPlatformAdmin] = useState<ProofSlot>(emptySlot);
  const [businessPermit, setBusinessPermit] = useState<ProofSlot>(emptySlot);
  const [submitting, setSubmitting] = useState<'base' | 'enhanced' | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [hostTouched, setHostTouched] = useState(false);
  const [verifiedTouched, setVerifiedTouched] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  /** Set when the host captured their ID live; the server copies the photo into the asset. */
  const [liveValidId, setLiveValidId] = useState<string | null>(null);

  const isDirty = [validId, socialProof, selfie, platformAdmin, businessPermit].some(
    (slot) => slot.file !== null
  );
  const {
    onOpenChange: guardedOpenChange,
    requestClose,
    dialogProps,
  } = useGuardedClose({
    open: resolvedOpen,
    onOpenChange,
    isDirty,
    onSave: async () => {
      if (validId.file || socialProof.file) {
        if (!(await handleSubmitHost())) return false;
      }
      if (selfie.file || platformAdmin.file || businessPermit.file) {
        if (!(await handleSubmitVerified())) return false;
      }
      return true;
    },
  });

  const handleOpenChange = (next: boolean) => {
    if (embedded) return;
    if (blockDismiss && !next) return;
    guardedOpenChange(next);
  };

  useEffect(() => {
    if (!resolvedOpen || !org) return;
    const next = readOrgVerificationDetail(org.settings);
    const clearValidId = isHostVerificationChangesRequestedFromDetail(next);

    setValidId({
      file: null,
      previewUrl: null,
      path: clearValidId ? null : next.assets.validIdPath,
    });
    setSocialProof({
      file: null,
      previewUrl: null,
      path:
        clearValidId && next.baseChangesRequestedDocs.includes('socialProof')
          ? null
          : next.assets.socialProofPath,
    });
    setSelfie({ file: null, previewUrl: null, path: next.assets.selfieWithIdPath });
    setPlatformAdmin({
      file: null,
      previewUrl: null,
      path: next.assets.platformAdminProofPath,
    });
    setBusinessPermit({
      file: null,
      previewUrl: null,
      path: next.assets.businessPermitOrBirPath,
    });
    setHostTouched(false);
    setVerifiedTouched(false);
    setUploadError(null);
    setActiveStep(lockedStep ?? defaultVerificationStepIndex(buildVerificationTiers(next)));
  }, [lockedStep, org, resolvedOpen]);

  const hostTier = tiers[0]!;
  const verifiedTier = tiers[1]!;
  const verifiedApproved = verifiedTier.status === 'approved';
  const verifiedPending = verifiedTier.status === 'pending';
  const verifiedEditable = !verifiedApproved && !verifiedPending;

  const canSubmitHost = canSubmitHostTier(
    detail,
    hostModes,
    {
      validId: slotReady(validId) || Boolean(liveValidId),
      socialProof: slotReady(socialProof),
    },
    hostChangesRequested ? { changesRequestedDocs: detail.baseChangesRequestedDocs } : undefined
  );

  const canSubmitVerified = canSubmitVerifiedTier(detail, {
    selfie: slotReady(selfie),
  });

  const setSlot = (setter: typeof setSelfie) => (file: File | null, previewUrl: string | null) => {
    if (file) {
      const err = validateVerificationFile(file);
      if (err) {
        toast.error(err);
        setter(emptySlot());
        return;
      }
    }
    setter({ file, previewUrl, path: null });
  };

  const handleSubmitHost = async (): Promise<boolean> => {
    setHostTouched(true);
    setUploadError(null);
    if (!org || !canSubmitHost) return false;
    setSubmitting('base');
    try {
      if (validId.file) {
        const uploaded = await uploadVerificationAsset(org.id, 'valid_id', validId.file);
        setValidId({ file: null, previewUrl: uploaded.previewUrl, path: uploaded.path });
      }
      if (socialProof.file) {
        const uploaded = await uploadVerificationAsset(org.id, 'social_proof', socialProof.file);
        setSocialProof({ file: null, previewUrl: uploaded.previewUrl, path: uploaded.path });
      }

      await callEdgeFunction('submit-org-verification', {
        method: 'POST',
        body: JSON.stringify({
          orgId: org.id,
          tier: 'base',
          ...(liveValidId ? { identityVerificationId: liveValidId } : {}),
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY });
      toast.success(hostChangesRequested ? 'Verification resubmitted' : 'Verification submitted');
      if (!embedded) onOpenChange(false);
      return true;
    } catch (err) {
      if (isAiQuotaError(err)) {
        handleAiMutationError(err as Error);
        return false;
      }
      toast.error(err instanceof Error ? err.message : 'Submission failed');
      return false;
    } finally {
      setSubmitting(null);
    }
  };

  const handleSubmitVerified = async (): Promise<boolean> => {
    setVerifiedTouched(true);
    if (!org || !canSubmitVerified) return false;
    if (!canSubmitRecommended) {
      if (!recommendedEntitlementsLoading) openUpgradeModal('recommendedBadgeEligible');
      return false;
    }
    setSubmitting('enhanced');
    try {
      if (selfie.file) {
        const uploaded = await uploadVerificationAsset(org.id, 'selfie_with_id', selfie.file);
        setSelfie({ file: null, previewUrl: uploaded.previewUrl, path: uploaded.path });
      }
      if (platformAdmin.file) {
        const uploaded = await uploadVerificationAsset(
          org.id,
          'platform_admin_proof',
          platformAdmin.file
        );
        setPlatformAdmin({ file: null, previewUrl: uploaded.previewUrl, path: uploaded.path });
      }
      if (businessPermit.file) {
        const uploaded = await uploadVerificationAsset(
          org.id,
          'business_permit_bir',
          businessPermit.file
        );
        setBusinessPermit({ file: null, previewUrl: uploaded.previewUrl, path: uploaded.path });
      }

      await callEdgeFunction('submit-org-verification', {
        method: 'POST',
        body: JSON.stringify({
          orgId: org.id,
          tier: 'enhanced',
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: ['host-reward-offer', org.id] });
      await queryClient.invalidateQueries({ queryKey: ['org-plan'] });
      await queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey.some((part) => part === 'entitlements' || part === 'org-plan'),
      });
      toast.success('Recommended tier submitted');
      if (!embedded && !blockDismiss) onOpenChange(false);
      return true;
    } catch (err) {
      if (isAiQuotaError(err)) {
        handleAiMutationError(err as Error);
        return false;
      }
      toast.error(err instanceof Error ? err.message : 'Submission failed');
      return false;
    } finally {
      setSubmitting(null);
    }
  };

  const stepIndex = lockedStep ?? activeStep;
  const showHostPanel = hostChangesRequested || stepIndex === 0;
  const hostFirstUpload = stepIndex === 0 && detail.baseStatus === 'none' && !hostHardRejected;
  const showHostSubmit = hostChangesRequested || hostFirstUpload;

  const hostUploadFields = (
    <div className="space-y-4">
      <OnboardingHostVerificationSection
        file={validId.file}
        previewUrl={validId.previewUrl}
        error={liveValidId ? null : slotRequiredError(hostTouched, submitting !== null, validId)}
        onFileChange={(file, preview) => {
          setValidId({
            file,
            previewUrl: preview,
            path: file ? null : validId.path,
          });
        }}
        socialProofFile={socialProof.file}
        socialProofPreviewUrl={socialProof.previewUrl}
        socialProofError={slotRequiredError(hostTouched, submitting !== null, socialProof)}
        onSocialProofChange={(file, preview) => {
          setSocialProof({
            file,
            previewUrl: preview,
            path: file ? null : socialProof.path,
          });
        }}
        onUploadError={(message) => {
          setUploadError(message);
          if (message) toast.error(message);
        }}
        verifyAction={
          org && !validId.previewUrl && !validId.file ? (
            <HostIdentityVerifyButton
              organizationId={org.id}
              onDocumentCaptured={(file) =>
                setValidId({ file, previewUrl: URL.createObjectURL(file), path: null })
              }
              onVerified={(result) => setLiveValidId(result.verificationId)}
            />
          ) : null
        }
        framed={false}
        compact
      />
      {uploadError ? (
        <p role="alert" className="text-destructive text-xs">
          {uploadError}
        </p>
      ) : null}
    </div>
  );

  const flowBody = (
    <>
      {showHostPanel ? (
        <VerifiedTierStepPanel
          tier={hostTier}
          checklist={hostChecklist}
          pendingNote={detail.baseStatus === 'pending'}
          rejectionReason={hostRejected ? detail.baseRejectionReason : null}
          rejectionKind={hostRejected ? detail.baseRejectionKind : null}
          changesResubmit={hostChangesRequested}
          orgId={org?.id}
          orgSlug={org?.slug}
          modalOpen={resolvedOpen}
          allowListingUpload={allowListingUpload}
          hideListingOpen={hideListingOpen}
          showSubmittedDocs={showTier1SubmittedDocs}
        >
          {hostChangesRequested || hostFirstUpload ? (
            hostUploadFields
          ) : hostHardRejected ? (
            <p className="text-muted-foreground text-[13px] leading-relaxed">
              This verification was declined. Start a new application to try again with updated
              documents.
            </p>
          ) : null}
        </VerifiedTierStepPanel>
      ) : (
        <RecommendedTierStepPanel
          tier={verifiedTier}
          orgName={org?.name}
          orgId={org?.id}
          orgSlug={org?.slug}
          modalOpen={resolvedOpen}
          allowListingUpload={allowListingUpload}
          hideListingOpen={hideListingOpen}
          checklist={verifiedChecklist}
          showSubmittedDocs={showTier2SubmittedDocs}
          verifiedApproved={verifiedApproved}
          verifiedPending={verifiedPending}
          enhancedStatus={detail.enhancedStatus}
          enhancedRejectionKind={detail.enhancedRejectionKind}
          enhancedRejectionReason={detail.enhancedRejectionReason}
          selfie={selfie}
          platformAdmin={platformAdmin}
          businessPermit={businessPermit}
          verifiedTouched={verifiedTouched}
          onSelfieChange={setSlot(setSelfie)}
          onPlatformAdminChange={setSlot(setPlatformAdmin)}
          onBusinessPermitChange={setSlot(setBusinessPermit)}
        />
      )}
    </>
  );

  const submitActions = (
    <>
      {showHostSubmit ? (
        <Button
          type="button"
          disabled={submitting !== null || !canSubmitHost}
          onClick={() => void handleSubmitHost()}
          className="min-h-[44px] min-w-[8.5rem]"
        >
          {submitting === 'base' ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              Submitting…
            </>
          ) : hostChangesRequested ? (
            'Resubmit'
          ) : (
            'Submit for review'
          )}
        </Button>
      ) : null}
      {!hostChangesRequested && stepIndex === 1 && verifiedEditable ? (
        <Button
          type="button"
          disabled={submitting !== null || !canSubmitVerified}
          onClick={() => void handleSubmitVerified()}
          className="min-h-[44px] min-w-[8.5rem]"
        >
          {submitting === 'enhanced' ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              Submitting…
            </>
          ) : (
            'Submit for review'
          )}
        </Button>
      ) : null}
    </>
  );

  if (embedded) {
    return (
      <div className="flex flex-col gap-4">
        {flowBody}
        {showHostSubmit || (stepIndex === 1 && verifiedEditable) ? (
          <div className="flex justify-end">{submitActions}</div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <ResponsiveModal open={open} onOpenChange={handleOpenChange}>
        <ResponsiveModalContent
          sheetLayout="split"
          showCloseButton={!blockDismiss}
          onPointerDownOutside={(event) => {
            if (blockDismiss) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (blockDismiss) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (blockDismiss) event.preventDefault();
          }}
          className={cn(
            'flex h-[min(92dvh,44rem)] max-h-[min(92dvh,44rem)] w-[min(calc(100vw-1.5rem),44rem)] max-w-none flex-col gap-0 overflow-hidden p-0',
            'sm:h-[min(90dvh,46rem)] sm:max-h-[min(90dvh,46rem)] sm:w-[min(92vw,46rem)] sm:max-w-[46rem] sm:p-0'
          )}
        >
          <ResponsiveModalHeader
            className={cn(
              'border-border shrink-0 gap-3 space-y-0 border-b px-4 pb-3 pt-4 text-left sm:px-6 sm:pb-3.5 sm:pt-5',
              blockDismiss && 'pr-4 sm:pr-6'
            )}
          >
            <ResponsiveModalTitle className="flex items-center gap-2.5 text-left text-base font-semibold sm:text-lg">
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full sm:size-9',
                  hostChangesRequested
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                    : 'bg-primary/10 text-primary'
                )}
              >
                {hostChangesRequested ? (
                  <AlertCircle className="size-[18px]" aria-hidden />
                ) : (
                  <BadgeCheck className="size-[18px]" aria-hidden />
                )}
              </span>
              {hostChangesRequested
                ? 'Changes requested'
                : stepIndex === 1
                  ? 'Get Recommended'
                  : 'Get Verified'}
            </ResponsiveModalTitle>
            {!blockDismiss && lockedStep == null ? (
              <VerificationTierProgress
                tiers={tiers}
                activeStep={activeStep}
                onStepChange={setActiveStep}
                hostRejectionKind={detail.baseRejectionKind}
                verifiedRejectionKind={detail.enhancedRejectionKind}
              />
            ) : null}
          </ResponsiveModalHeader>

          <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 py-3.5 [-webkit-overflow-scrolling:touch] sm:px-6 sm:py-4">
            {flowBody}
          </div>

          <ResponsiveModalFooter className="border-border shrink-0 gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:px-6 sm:py-4">
            {!blockDismiss ? (
              <Button
                type="button"
                variant="outline"
                onClick={requestClose}
                disabled={submitting !== null}
              >
                Close
              </Button>
            ) : null}
            {submitActions}
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}

export function GetVerifiedSidebarCta({
  collapsed,
  variant = 'sidebar',
}: {
  collapsed?: boolean;
  variant?: 'sidebar' | 'icon';
}) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const org = useCurrentOrganization();
  const detail = readOrgVerificationDetail(org?.settings);
  const forced = isHostVerificationChangesRequestedFromDetail(detail);

  // Host/org verification lives on org routes only — listing shells use ListingVerificationSidebarCta.
  if (isPropertyAdminPath(location.pathname) || isParkingAdminPath(location.pathname)) {
    return null;
  }

  if (!org || !shouldShowGetVerifiedCta(detail)) return null;

  const label = verificationSidebarLabel(detail);

  if (variant === 'icon') {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          title={label}
          aria-label={label}
          className="border-primary/25 from-primary/[0.12] to-primary/[0.04] text-primary hover:from-primary/15 hover:to-primary/[0.08] flex size-10 shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br shadow-sm transition-colors"
        >
          <BadgeCheck className="size-4 shrink-0" aria-hidden />
        </button>
        {!forced ? <GetVerifiedModal open={open} onOpenChange={setOpen} /> : null}
      </>
    );
  }

  return (
    <>
      <div
        className={cn('border-sidebar-border shrink-0 border-t py-3', collapsed ? 'px-2' : 'px-3')}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          title={collapsed ? label : undefined}
          className={cn(
            'border-primary/25 from-primary/[0.12] to-primary/[0.04] text-primary hover:from-primary/15 hover:to-primary/[0.08] flex min-h-[44px] w-full items-center rounded-xl border bg-gradient-to-br shadow-sm transition-colors',
            collapsed ? 'justify-center px-2 py-2.5' : 'gap-2.5 px-3 py-2.5'
          )}
        >
          <span className="bg-primary/15 flex size-8 shrink-0 items-center justify-center rounded-full">
            <BadgeCheck className="size-4 shrink-0" aria-hidden />
          </span>
          {!collapsed ? (
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-semibold leading-tight">{label}</span>
              {detail.enhancedStatus === 'none' || detail.enhancedStatus === 'rejected' ? (
                <span className="text-primary/80 mt-0.5 block truncate text-[11px] font-medium leading-tight">
                  {VERIFICATION_SIDEBAR_SUBLABEL}
                </span>
              ) : null}
            </span>
          ) : null}
        </button>
      </div>
      {/* Forced modal is mounted once via HostVerificationChangesGate (avoids mobile+desktop double mount). */}
      {!forced ? <GetVerifiedModal open={open} onOpenChange={setOpen} /> : null}
    </>
  );
}

/** Non-dismissible Get Verified when Tier 1 has changes requested — mount once in AdminLayout. */
export function HostVerificationChangesGate() {
  const org = useCurrentOrganization();
  const detail = readOrgVerificationDetail(org?.settings);
  if (!org || !isHostVerificationChangesRequestedFromDetail(detail)) return null;
  // Members cannot upload/resubmit — don't trap them. Owners and platform/super-admins
  // (list-organizations returns accessKind: platform_admin for SUPER_ADMIN_EMAILS) must see the modal.
  if (org.accessKind === 'org_admin' || org.accessKind === 'property_member') return null;
  return <GetVerifiedModal open forced onOpenChange={() => {}} />;
}
