import { useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { ChevronRight, Home } from 'lucide-react';
import { toast } from 'sonner';

import { OnboardingProofUpload } from '@/features/dashboard/org/components/onboarding/OnboardingProofUpload';
import { VerificationSectionCard } from '@/features/dashboard/org/components/verification/VerificationSectionCard';
import { VerificationStatusBadge } from '@/features/dashboard/org/components/verification/VerificationStatusBadge';
import {
  useListingAuthorizationAssets,
  useListingAuthorizationMutations,
  useOrgListingVerifications,
} from '@/features/dashboard/org/hooks/useListingAuthorization';
import type { OrgListingVerificationRollupRow } from '@/features/dashboard/org/lib/listingAuthorizationApi';
import {
  LISTING_VERIFICATION_DOC_LABELS,
  listingKindLabel,
} from '@/features/dashboard/org/lib/listingVerificationCopy';
import {
  validateVerificationFile,
  verificationRightsProofHelp,
} from '@/features/dashboard/org/lib/orgVerification';
import {
  parkingDashboardPath,
  propertyDashboardPath,
} from '@/features/dashboard/org/lib/tenantPaths';

import { ListRowsSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Button } from '@/components/ui/button';
import { friendlyToastError } from '@/lib/feedback/toastMessages';

type Props = {
  orgId: string;
  orgSlug: string;
  enabled?: boolean;
  /** Hide Open links — e.g. super-admin org review context. */
  readOnly?: boolean;
  /** Host Get Verified — upload missing listing proof inline. */
  allowUpload?: boolean;
  /** Hide Open links that navigate away (setup guide already has listing steps). */
  hideOpen?: boolean;
};

function listingOpenPath(orgSlug: string, row: OrgListingVerificationRollupRow): string {
  const base =
    row.listingKind === 'parking'
      ? parkingDashboardPath(orgSlug, row.slug)
      : propertyDashboardPath(orgSlug, row.slug);
  return `${base}?listingVerification=open`;
}

function ListingRollupProofUpload({
  orgId,
  orgSlug,
  row,
}: {
  orgId: string;
  orgSlug: string;
  row: OrgListingVerificationRollupRow;
}) {
  const sectionKind = row.listingKind === 'parking' ? 'parking' : 'property';
  const assetsQuery = useListingAuthorizationAssets(row.listingKind, row.listingId, true);
  const { upload } = useListingAuthorizationMutations({
    orgId,
    orgSlug,
    listingKind: row.listingKind,
    listingId: row.listingId,
  });
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const previewUrl = localPreview ?? assetsQuery.data?.assetUrls?.proofUrl ?? null;

  const handleUpload = async (file: File) => {
    const err = validateVerificationFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    try {
      const result = await upload.mutateAsync({ assetType: 'proof', file });
      setLocalPreview(result.previewUrl);
      toast.success('Uploaded');
    } catch (error) {
      toast.error(friendlyToastError(error, 'Upload failed'));
    }
  };

  return (
    <div className="border-border/70 bg-muted/20 space-y-2 border-t px-3 py-3 sm:px-4">
      <p className="text-muted-foreground text-[11px] font-medium leading-none">
        Add proof for {row.name}
      </p>
      <OnboardingProofUpload
        id={`${row.listingKind}-${row.listingId}-rollup-proof`}
        label={LISTING_VERIFICATION_DOC_LABELS.proof}
        help={verificationRightsProofHelp(row.relationship ?? '', sectionKind)}
        file={null}
        previewUrl={previewUrl}
        uploading={upload.isPending}
        compact
        onFileChange={(file) => {
          if (file) void handleUpload(file);
        }}
      />
    </div>
  );
}

export function OrgListingVerificationRollup({
  orgId,
  orgSlug,
  enabled = true,
  readOnly = false,
  allowUpload = false,
  hideOpen = false,
}: Props) {
  const navigate = useNavigate();
  const { data, isLoading } = useOrgListingVerifications(orgId, enabled);
  const listings = data?.listings ?? [];

  if (!enabled) return null;

  const needsAction = listings.filter((row) => row.baseStatus !== 'approved').length;

  return (
    <VerificationSectionCard
      title="Listings"
      description={
        readOnly
          ? 'Reviewed as separate queue rows.'
          : hideOpen
            ? 'Upload proof for each listing that still needs it.'
            : 'Each listing is verified separately.'
      }
      meta={
        needsAction > 0 ? (
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {needsAction} to do
          </span>
        ) : null
      }
      bodyClassName="px-0 pb-0"
    >
      {isLoading ? (
        <div className="px-4 pb-4">
          <ListRowsSkeleton rows={2} label="Loading listings" />
        </div>
      ) : listings.length === 0 ? (
        <p className="text-muted-foreground px-4 pb-4 text-[13px]">No listings yet.</p>
      ) : (
        <ul className="divide-border border-border/70 divide-y border-t">
          {listings.map((row) => {
            const showProofUpload = allowUpload && !readOnly && !row.hasProof;
            return (
              <li key={`${row.listingKind}-${row.listingId}`}>
                <div className="flex min-h-[52px] items-center gap-2.5 px-3 py-2.5 sm:px-4">
                  <span className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full">
                    <Home className="size-3.5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate text-[13px] font-medium leading-tight">
                      {row.name}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="text-muted-foreground text-[11px] leading-none">
                        {listingKindLabel(row.listingKind)}
                      </span>
                      <VerificationStatusBadge
                        status={row.baseStatus}
                        kind={row.baseRejectionKind}
                        showIcon
                      />
                      {row.recommendedStatus !== 'none' ? (
                        <VerificationStatusBadge
                          status={row.recommendedStatus}
                          kind={row.recommendedRejectionKind}
                          showIcon
                        />
                      ) : null}
                      {readOnly && row.missingDocs.length > 0 && row.baseStatus !== 'approved' ? (
                        <span className="text-muted-foreground text-[11px]">
                          {row.missingDocs.length} missing
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {!readOnly && !hideOpen ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="min-h-[36px] shrink-0 gap-0.5 px-2 text-xs"
                      onClick={() => navigate(listingOpenPath(orgSlug, row))}
                    >
                      Open
                      <ChevronRight className="size-3.5" aria-hidden />
                    </Button>
                  ) : null}
                </div>
                {showProofUpload ? (
                  <ListingRollupProofUpload orgId={orgId} orgSlug={orgSlug} row={row} />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </VerificationSectionCard>
  );
}
