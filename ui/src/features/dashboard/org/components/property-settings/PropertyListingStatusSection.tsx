import { useState } from 'react';

import { Info, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import {
  usePropertyLifecycle,
  usePropertyLifecycleAction,
  usePropertyLifecycleImpact,
} from '@/features/dashboard/org/hooks/usePropertyLifecycle';
import { useDeleteProperty } from '@/features/dashboard/org/hooks/useDeleteProperty';
import {
  lifecyclePresentation,
  PROPERTY_LIFECYCLE_OPTIONS,
  type PropertyLifecycleAction,
  type PropertyLifecycleImpact,
} from '@/features/dashboard/org/lib/propertyLifecycle';
import { friendlyToastError } from '@/lib/feedback/toastMessages';
import { semanticBadgeClasses, semanticBadgeDotClasses } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';

import { AdminDialogShell } from '@/components/AdminDialogShell';
import {
  PropertyListingImpactSkeleton,
  PropertyListingStatusSectionSkeleton,
} from '@/components/skeletons/PropertyListingStatusSkeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const ACTION_LABELS: Record<PropertyLifecycleAction, string> = {
  pause: 'Pause bookings',
  resume: 'Resume bookings',
  archive: 'Archive property',
  restore: 'Restore property',
};

const ACTION_TITLES: Record<PropertyLifecycleAction, string> = {
  pause: 'Pause new bookings?',
  resume: 'Resume new bookings?',
  archive: 'Archive this property?',
  restore: 'Restore this property?',
};

function actionDescription(action: PropertyLifecycleAction, propertyName: string): string {
  switch (action) {
    case 'pause':
      return `${propertyName} stops taking new bookings. Guests who already booked keep their stay, guides, and messages.`;
    case 'resume':
      return `${propertyName} can accept new bookings again when your listing is approved.`;
    case 'archive':
      return `${propertyName} is retired from day-to-day hosting. Records stay; new bookings and automations turn off.`;
    case 'restore':
      return `${propertyName} comes back as paused. Turn calendar sync, posts, and automations back on when you are ready.`;
  }
}

const ARCHIVE_OUTCOME_BULLETS = [
  'No new bookings or guest form submissions',
  'Calendar sync and scheduled posts turn off',
  'Current guests keep stay guides, refunds, and reviews',
] as const;

function formatBlockingStatus(status: string): string {
  return status
    .split('_')
    .join(' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function ImpactBody({ impact }: { impact: PropertyLifecycleImpact }) {
  const bookingCount = impact.bookings.blockingCount;
  const visibleBlockers = impact.bookings.blocking.slice(0, 6);
  const hiddenBlockers = bookingCount - visibleBlockers.length;

  return (
    <div className="space-y-4 text-sm">
      {bookingCount > 0 ? (
        <div className="border-destructive/40 bg-destructive/5 space-y-2 rounded-lg border p-3">
          <p className="text-destructive text-[13px] font-medium">
            Finish or cancel {bookingCount} open booking{bookingCount === 1 ? '' : 's'} first.
          </p>
          <ul className="space-y-1.5">
            {visibleBlockers.map((booking) => (
              <li key={booking.id} className="text-muted-foreground text-xs leading-snug">
                {booking.guestName ?? 'Guest'}
                {booking.checkInDate ? ` · ${booking.checkInDate}` : ''}
                <span className="text-foreground"> · {formatBlockingStatus(booking.status)}</span>
              </li>
            ))}
          </ul>
          {hiddenBlockers > 0 ? (
            <p className="text-muted-foreground text-xs">+ {hiddenBlockers} more</p>
          ) : null}
        </div>
      ) : (
        <>
          <ul className="text-muted-foreground list-disc space-y-1.5 pl-4 text-[13px] leading-relaxed">
            {ARCHIVE_OUTCOME_BULLETS.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {impact.subscription.billed ? (
            <p className="text-muted-foreground text-xs">
              Billing for this property stops on the next plan cycle.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function DeleteBody({
  impact,
  propertyName,
  confirmName,
  onConfirmNameChange,
}: {
  impact: PropertyLifecycleImpact | undefined;
  propertyName: string;
  confirmName: string;
  onConfirmNameChange: (value: string) => void;
}) {
  const deleteBlocked = (impact?.deleteBlockers.total ?? 0) > 0;

  return (
    <div className="space-y-4 text-sm">
      {deleteBlocked ? (
        <p className="text-destructive text-[13px] leading-relaxed">
          This property still has bookings or records. Archive it instead of deleting.
        </p>
      ) : (
        <p className="text-muted-foreground text-[13px] leading-relaxed">
          Removes the profile, media, and linked records for this property.
        </p>
      )}

      <div className="space-y-1.5">
        <label htmlFor="delete-property-confirm" className="text-sm font-medium">
          Type {propertyName} to confirm
        </label>
        <Input
          id="delete-property-confirm"
          value={confirmName}
          onChange={(event) => onConfirmNameChange(event.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

export function PropertyListingStatusSection({
  orgSlug,
  propertyId,
  propertyName,
  canManage,
  canDelete,
  disabled = false,
  onPropertyChanged,
  onDeleted,
}: {
  orgSlug: string;
  propertyId: string;
  propertyName: string;
  canManage: boolean;
  canDelete: boolean;
  disabled?: boolean;
  onPropertyChanged?: (patch: {
    status: string;
    inactiveReason: string | null;
    archivedAt: string | null;
    pausedAt: string | null;
  }) => void;
  onDeleted?: () => void;
}) {
  const { data: lifecycle, isLoading, isError, refetch } = usePropertyLifecycle(propertyId);
  const lifecycleAction = usePropertyLifecycleAction(orgSlug);
  const deleteProperty = useDeleteProperty(orgSlug);

  const [compareOpen, setCompareOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PropertyLifecycleAction | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');

  const impactEnabled = pendingAction === 'archive' || deleteOpen;
  const impactQuery = usePropertyLifecycleImpact(propertyId, impactEnabled);
  const impact = impactQuery.data;

  const state = lifecycle?.state;
  const presentation = state ? lifecyclePresentation(state) : null;
  const allowed = new Set(lifecycle?.allowedActions ?? []);

  const runAction = async (action: PropertyLifecycleAction) => {
    try {
      const result = await lifecycleAction.mutateAsync({ propertyId, action });
      onPropertyChanged?.({
        status: result.property.status,
        inactiveReason: result.property.inactiveReason,
        archivedAt: result.property.archivedAt,
        pausedAt: result.property.pausedAt,
      });
      const labels: Record<PropertyLifecycleAction, string> = {
        pause: 'Bookings paused',
        resume: 'Bookings resumed',
        archive: 'Property archived',
        restore: 'Property restored',
      };
      toast.success(labels[action]);
      setPendingAction(null);
    } catch (error) {
      toast.error(friendlyToastError(error, `Could not ${action} this property`));
    }
  };

  const runDelete = async () => {
    try {
      await deleteProperty.mutateAsync({ propertyId, confirmName });
      toast.success('Property deleted');
      setDeleteOpen(false);
      onDeleted?.();
    } catch (error) {
      toast.error(friendlyToastError(error, 'Could not delete this property'));
    }
  };

  const pending = lifecycleAction.isPending;
  const deleteBlocked = (impact?.deleteBlockers.total ?? 0) > 0;

  return (
    <div className="space-y-4">
      {isLoading ? (
        <PropertyListingStatusSectionSkeleton showDelete={canDelete} />
      ) : isError || !lifecycle || !presentation ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <p className="text-muted-foreground text-sm">Could not load the listing status.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between sm:p-4">
            <div className="min-w-0 space-y-1">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
                  semanticBadgeClasses(presentation.variant)
                )}
              >
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    semanticBadgeDotClasses(presentation.variant)
                  )}
                  aria-hidden
                />
                {presentation.label}
              </span>
              <p className="text-card-description">{presentation.description}</p>
              {lifecycle.activationBlock ? (
                <p className="text-muted-foreground text-xs">{lifecycle.activationBlock.message}</p>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="settings-action gap-1.5"
                onClick={() => setCompareOpen(true)}
              >
                <Info className="size-3.5" aria-hidden />
                Compare options
              </Button>

              {allowed.has('pause') ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="settings-action"
                  disabled={disabled || pending || !canManage}
                  onClick={() => setPendingAction('pause')}
                >
                  Pause
                </Button>
              ) : null}

              {allowed.has('resume') ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="settings-action"
                  disabled={disabled || pending || !canManage}
                  onClick={() => setPendingAction('resume')}
                >
                  Resume
                </Button>
              ) : null}

              {allowed.has('archive') ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="settings-action"
                  disabled={disabled || pending || !canManage}
                  onClick={() => setPendingAction('archive')}
                >
                  Archive
                </Button>
              ) : null}

              {allowed.has('restore') ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="settings-action gap-1.5"
                  disabled={disabled || pending || !canManage}
                  onClick={() => setPendingAction('restore')}
                >
                  <ShieldCheck className="size-3.5" aria-hidden />
                  Restore
                </Button>
              ) : null}
            </div>
          </div>

          {canDelete ? (
            <div className="border-destructive/40 flex flex-col gap-2.5 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
              <div className="space-y-0.5">
                <p className="text-destructive text-xs font-semibold sm:text-sm">Delete property</p>
                <p className="text-card-description">
                  Only for a property with no records. This can't be undone.
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="settings-action w-full sm:w-auto"
                disabled={disabled || deleteProperty.isPending}
                onClick={() => {
                  setConfirmName('');
                  setDeleteOpen(true);
                }}
              >
                Delete
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <AdminDialogShell
        open={compareOpen}
        onOpenChange={setCompareOpen}
        title="Pause, archive, or delete"
        description="Pick the option that matches how long you need the listing offline."
        contentClassName="max-w-[min(calc(100vw-1.5rem),32rem)]"
        bodyClassName="py-3 sm:py-4"
        footer={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="settings-action w-full sm:w-auto"
            onClick={() => setCompareOpen(false)}
          >
            Close
          </Button>
        }
      >
        <div className="space-y-2.5">
          {PROPERTY_LIFECYCLE_OPTIONS.map((option) => (
            <div key={option.key} className="rounded-lg border p-3">
              <p className="text-sm font-semibold">{option.title}</p>
              <p className="text-muted-foreground mt-0.5 text-[13px] leading-relaxed">
                {option.summary}
              </p>
            </div>
          ))}
        </div>
      </AdminDialogShell>

      {pendingAction ? (
        <AdminDialogShell
          open
          onOpenChange={(open) => {
            if (!open && !pending) setPendingAction(null);
          }}
          title={ACTION_TITLES[pendingAction]}
          description={actionDescription(pendingAction, propertyName)}
          contentClassName="max-w-[min(calc(100vw-1.5rem),30rem)]"
          bodyClassName="py-3 sm:py-4"
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="settings-action w-full sm:w-auto"
                disabled={pending}
                onClick={() => setPendingAction(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="settings-action w-full sm:w-auto"
                disabled={
                  pending ||
                  (pendingAction === 'archive' && (impact?.bookings.blockingCount ?? 0) > 0)
                }
                onClick={() => void runAction(pendingAction)}
              >
                {pending ? 'Working…' : ACTION_LABELS[pendingAction]}
              </Button>
            </>
          }
        >
          {pendingAction === 'archive' ? (
            impactQuery.isLoading || !impact ? (
              <PropertyListingImpactSkeleton variant="archive" />
            ) : (
              <ImpactBody impact={impact} />
            )
          ) : pendingAction === 'restore' ? (
            <p className="text-muted-foreground text-[13px] leading-relaxed">
              Calendar sync, calendar export, scheduled posts, Smart Pricing, Telegram, and AI
              replies stay off until you turn them back on in property settings.
            </p>
          ) : null}
        </AdminDialogShell>
      ) : null}

      <AdminDialogShell
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open && !deleteProperty.isPending) setDeleteOpen(false);
        }}
        title={<span className="text-destructive">Delete {propertyName}?</span>}
        description="Only for a property with no records. This cannot be undone."
        contentClassName="max-w-[min(calc(100vw-1.5rem),30rem)]"
        bodyClassName="py-3 sm:py-4"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="settings-action w-full sm:w-auto"
              disabled={deleteProperty.isPending}
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="settings-action w-full sm:w-auto"
              disabled={
                deleteProperty.isPending ||
                deleteBlocked ||
                confirmName.trim() !== propertyName.trim()
              }
              onClick={() => void runDelete()}
            >
              {deleteProperty.isPending ? 'Deleting…' : 'Delete property'}
            </Button>
          </>
        }
      >
        {impactQuery.isLoading ? (
          <PropertyListingImpactSkeleton variant="delete" />
        ) : (
          <DeleteBody
            impact={impact}
            propertyName={propertyName}
            confirmName={confirmName}
            onConfirmNameChange={setConfirmName}
          />
        )}
      </AdminDialogShell>
    </div>
  );
}
