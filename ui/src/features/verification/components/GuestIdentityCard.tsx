import { useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { useGuestSession } from '@/features/guest/auth/hooks/useGuestSession';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { cn } from '@/lib/utils';

import { IdentityVerificationFlow } from './IdentityVerificationFlow';
import { VerificationResultBadge } from './VerificationResultBadge';
import { myIdentityQueryKey, useMyIdentity } from '../hooks/useIdentitySession';
import { deleteIdentityVerification } from '../lib/identityApi';

function formatDate(value: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

type GuestIdentityCardProps = {
  className?: string;
};

/**
 * Profile field for ID verification (below Location on `/account/profile`).
 * Verify once, reuse across bookings; delete without contacting support.
 * Outside the profile draft dirty state on purpose.
 */
export function GuestIdentityCard({ className }: GuestIdentityCardProps) {
  const { session } = useGuestSession();
  const { data, isLoading } = useMyIdentity(Boolean(session));
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const verification = data?.verification ?? null;

  const handleDelete = async () => {
    if (!verification) return;
    setDeleting(true);
    try {
      await deleteIdentityVerification(verification.id);
      await queryClient.invalidateQueries({ queryKey: myIdentityQueryKey });
      toast.success('Verification deleted');
      setConfirmDelete(false);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const statusLine = (() => {
    if (isLoading) {
      return <span className="bg-muted inline-block h-3.5 w-28 animate-pulse rounded" aria-hidden />;
    }
    if (!verification) {
      return <p className="text-muted-foreground text-sm">Not verified</p>;
    }
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <VerificationResultBadge
          verdict={verification.verdict}
          flags={verification.flags}
          withTooltip={false}
        />
        {verification.maskedName ? (
          <span className="text-muted-foreground truncate text-sm">{verification.maskedName}</span>
        ) : null}
        {verification.expiresAt ? (
          <span className="text-muted-foreground text-sm">
            Until {formatDate(verification.expiresAt)}
          </span>
        ) : null}
      </div>
    );
  })();

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor="guest-identity-verify">ID verification</Label>

      <div
        id="guest-identity-verify"
        className="border-input bg-background flex min-h-11 items-center gap-3 rounded-md border px-3 py-2"
      >
        <div className="min-w-0 flex-1">{statusLine}</div>

        {verification ? (
          <BadgeCheck className="size-4 shrink-0 text-emerald-500" aria-hidden />
        ) : null}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0 px-3"
          onClick={() => setOpen(true)}
          disabled={isLoading}
        >
          {verification ? 'Verify again' : 'Verify'}
        </Button>
      </div>

      {verification && !confirmDelete ? (
        <button
          type="button"
          className="text-destructive hover:text-destructive/90 text-sm underline-offset-2 hover:underline"
          onClick={() => setConfirmDelete(true)}
        >
          Delete verification
        </button>
      ) : null}

      {confirmDelete ? (
        <div className="border-destructive/30 bg-destructive/5 flex flex-col gap-2 rounded-lg border p-3">
          <p className="text-muted-foreground text-sm">
            Removes this verification and its photos. Bookings keep any ID you already uploaded.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="min-h-9"
              disabled={deleting}
              onClick={() => void handleDelete()}
            >
              {deleting ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : null}
              Delete
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-9"
              disabled={deleting}
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <ResponsiveModal open={open} onOpenChange={setOpen}>
        <ResponsiveModalContent sheetLayout="split" className="sm:max-w-md">
          <div className="px-4 pt-4">
            <ResponsiveModalTitle>Verify your ID</ResponsiveModalTitle>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {open ? (
              <IdentityVerificationFlow
                subjectKind="guest"
                email={session?.user?.email ?? ''}
                onComplete={() => {
                  setOpen(false);
                  void queryClient.invalidateQueries({ queryKey: myIdentityQueryKey });
                }}
                onCancel={() => setOpen(false)}
              />
            ) : null}
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </div>
  );
}
