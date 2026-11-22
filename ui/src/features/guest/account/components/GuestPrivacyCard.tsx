import { useState } from 'react';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  downloadGuestDataExport,
  requestGuestAccountDeletion,
} from '@/features/guest/account/lib/guestAccountApi';

import { Button } from '@/components/ui/button';
import { LegalLink } from '@/components/legal/LegalLink';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';

function manilaDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
  }).format(date);
}

/**
 * Guest profile: policies, a self-service data download, and a reviewed deletion request.
 *
 * Intentionally not mounted on `/account/profile` (2026-11-22). Self-serve export/delete
 * is deferred; re-enable from `GuestProfilePage` when product wants it back. Do not delete
 * this component. Edge `data-subject-request` stays live.
 */
export function GuestPrivacyCard() {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [requestedDueAt, setRequestedDueAt] = useState<string | null>(null);

  const download = useMutation({
    mutationFn: downloadGuestDataExport,
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `kame-space-data-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      // Revoke after the browser has started the download (Safari aborts on an immediate revoke).
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('Download ready');
    },
    onError: (error: Error) => toast.error(error.message || 'Could not prepare your data'),
  });

  const requestDeletion = useMutation({
    mutationFn: () => requestGuestAccountDeletion(),
    onSuccess: (request) => {
      setRequestedDueAt(request.due_at);
      setDeleteOpen(false);
      toast.success('Deletion requested');
    },
    onError: (error: Error) => toast.error(error.message || 'Could not send the request'),
  });

  return (
    <div className="border-border space-y-3 rounded-xl border p-4">
      <div className="space-y-1.5">
        <p className="text-sm font-semibold">Privacy and data</p>
        <p className="text-muted-foreground text-sm">
          Read the <LegalLink doc="privacy" /> and <LegalLink doc="terms" />.
        </p>
      </div>

      {requestedDueAt ? (
        <p className="text-muted-foreground text-sm" role="status">
          {`Deletion requested. We review it by ${manilaDate(requestedDueAt)}.`}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px] sm:flex-1"
          onClick={() => download.mutate()}
          disabled={download.isPending}
        >
          {download.isPending ? 'Preparing' : 'Download my data'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="min-h-[44px] sm:flex-1"
          onClick={() => setDeleteOpen(true)}
          disabled={Boolean(requestedDueAt)}
        >
          Delete my account
        </Button>
      </div>

      <ResponsiveModal open={deleteOpen} onOpenChange={setDeleteOpen}>
        <ResponsiveModalContent className="pb-[max(env(safe-area-inset-bottom),1rem)]">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>Delete your account?</ResponsiveModalTitle>
            <ResponsiveModalDescription>
              We delete your profile and personal details. Bookings stay as financial records with
              your personal fields removed. This cannot be undone.
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>
          <ResponsiveModalFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] w-full sm:flex-1"
              onClick={() => setDeleteOpen(false)}
              disabled={requestDeletion.isPending}
            >
              Keep my account
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-[44px] w-full sm:flex-1"
              onClick={() => requestDeletion.mutate()}
              disabled={requestDeletion.isPending}
            >
              {requestDeletion.isPending ? 'Sending' : 'Request deletion'}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </div>
  );
}
