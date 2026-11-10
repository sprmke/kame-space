import { useEffect, useRef, useState } from 'react';

import { BadgeCheck, Camera, ImagePlus } from 'lucide-react';

import { useGuestSession } from '@/features/guest/auth/hooks/useGuestSession';

import { IdentityVerificationFlow } from '@/features/verification/components/IdentityVerificationFlow';
import { VerificationResultBadge } from '@/features/verification/components/VerificationResultBadge';
import { useMyIdentity } from '@/features/verification/hooks/useIdentitySession';
import type { IdentitySubmitResponse } from '@/features/verification/lib/identityApi';
import type { IdentityVerdict } from '@/features/verification/lib/identityVerdict';

import { FormControl, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';

import { GuestFormValidIdUpload } from './GuestFormValidIdUpload';

type GuestIdentityCaptureProps = {
  label: string;
  guestSlot: number;
  guestName: string;
  email: string;
  propertySlug: string;
  identityVerificationId: string | undefined;
  onIdentityChange: (id: string | undefined) => void;
  // File fallback — same contract as `GuestFormValidIdUpload`.
  preview: string | null;
  value: File | undefined;
  imageLoadError: boolean;
  onChange: (file: File | undefined) => void;
  onPreviewChange: (preview: string | null) => void;
  onImageLoadErrorChange: (hasError: boolean) => void;
  fieldProps?: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'value'>;
};

/**
 * One ID slot on the booking form.
 *
 * An ID is still required for guests aged 18+ (the host's GAF workflow attaches it), but the
 * *way* it is sent is the guest's choice: verify with the camera, or upload a photo. Both are
 * presented as equal options — neither is a "fallback" the guest is nudged away from.
 *
 * A signed-in primary guest who already holds a live verification gets it attached
 * automatically, so a returning guest never repeats the capture. Additional guests are
 * different people and are never given the booker's identity.
 */
export function GuestIdentityCapture({
  label,
  guestSlot,
  guestName,
  email,
  propertySlug,
  identityVerificationId,
  onIdentityChange,
  preview,
  value,
  imageLoadError,
  onChange,
  onPreviewChange,
  onImageLoadErrorChange,
  fieldProps,
}: GuestIdentityCaptureProps) {
  const [open, setOpen] = useState(false);
  const [upload, setUpload] = useState(false);
  const [verdict, setVerdict] = useState<IdentityVerdict | null>(null);
  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const reusedAccountIdentity = useRef(false);

  const { status: guestAuthStatus } = useGuestSession();
  const myIdentity = useMyIdentity(guestSlot === 1 && guestAuthStatus === 'authenticated');
  const accountVerification = guestSlot === 1 ? (myIdentity.data?.verification ?? null) : null;

  // Verify once, book again: attach the guest's own live verification to this booking.
  useEffect(() => {
    if (reusedAccountIdentity.current) return;
    if (!myIdentity.data?.hasIdentity || !accountVerification) return;
    if (identityVerificationId || value || preview) return;
    reusedAccountIdentity.current = true;
    setVerdict(accountVerification.verdict);
    setVerifiedName(accountVerification.maskedName);
    onIdentityChange(accountVerification.id);
  }, [
    accountVerification,
    identityVerificationId,
    myIdentity.data?.hasIdentity,
    onIdentityChange,
    preview,
    value,
  ]);

  const handleComplete = (result: IdentitySubmitResponse) => {
    setVerdict(result.verdict);
    setVerifiedName(result.maskedName);
    onIdentityChange(result.verificationId);
    setOpen(false);
    setUpload(false);
  };

  const resetToOptions = () => {
    onIdentityChange(undefined);
    setVerdict(null);
    setVerifiedName(null);
    setUpload(false);
  };

  if (identityVerificationId && !upload) {
    return (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <FormControl>
          <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
            <div className="flex min-w-0 items-center gap-2">
              <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {verifiedName || guestName || 'Guest'} verified
                </p>
                {verdict && <VerificationResultBadge verdict={verdict} />}
              </div>
            </div>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground shrink-0 text-xs underline"
              onClick={resetToOptions}
            >
              Use a different ID
            </button>
          </div>
        </FormControl>
        <FormMessage />
      </FormItem>
    );
  }

  if (upload || preview || value) {
    return (
      <>
        <GuestFormValidIdUpload
          label={label}
          preview={preview}
          value={value}
          imageLoadError={imageLoadError}
          onChange={onChange}
          onPreviewChange={onPreviewChange}
          onImageLoadErrorChange={onImageLoadErrorChange}
          fieldProps={fieldProps}
        />
        {!preview && !value && (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground -mt-2 ml-0 inline-flex text-xs underline"
            onClick={() => setUpload(false)}
          >
            Choose another way
          </button>
        )}
      </>
    );
  }

  const emailMissing = !email.trim();

  return (
    <FormItem>
      <FormLabel>
        {label} <span className="text-destructive">*</span>
      </FormLabel>
      <FormControl>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            className="hover:bg-muted focus-visible:ring-ring flex min-h-[72px] w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
            onClick={() => setUpload(true)}
          >
            <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
              <ImagePlus className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">Upload a photo</span>
              <span className="text-muted-foreground block text-xs">Photo or screenshot</span>
            </span>
          </button>

          <button
            type="button"
            disabled={emailMissing}
            className="hover:bg-muted focus-visible:ring-ring flex min-h-[72px] w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => setOpen(true)}
          >
            <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Camera className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">Verify with camera</span>
              <span className="text-muted-foreground block text-xs">Takes about a minute</span>
            </span>
          </button>
        </div>
      </FormControl>
      {emailMissing && (
        <p className="text-muted-foreground text-xs">Enter your email to verify with camera</p>
      )}
      <FormMessage />

      <ResponsiveModal open={open} onOpenChange={setOpen}>
        <ResponsiveModalContent sheetLayout="split" className="sm:max-w-md">
          <div className="flex items-center justify-between px-4 pt-4">
            <ResponsiveModalTitle>Verify your ID</ResponsiveModalTitle>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {open && (
              <IdentityVerificationFlow
                subjectKind="guest"
                guestSlot={guestSlot}
                email={email}
                propertySlug={propertySlug}
                onComplete={handleComplete}
                onCancel={() => setOpen(false)}
              />
            )}
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </FormItem>
  );
}
