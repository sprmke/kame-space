import { Skeleton } from '@/components/ui/skeleton';

/** Matches `PropertyListingStatusSection` status row + optional owner delete row. */
export function PropertyListingStatusSectionSkeleton({
  showDelete = false,
}: {
  showDelete?: boolean;
}) {
  return (
    <div role="status" className="space-y-3" aria-busy="true" aria-label="Loading listing status">
      <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between sm:p-4">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-5 w-[4.5rem] rounded-md" />
          <Skeleton className="h-3.5 w-full max-w-[16rem]" />
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Skeleton className="settings-action h-9 w-[7.5rem] rounded-lg" />
          <Skeleton className="settings-action h-9 w-16 rounded-lg" />
          <Skeleton className="settings-action h-9 w-[4.5rem] rounded-lg" />
        </div>
      </div>
      {showDelete ? (
        <div className="border-destructive/40 flex flex-col gap-2.5 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-full max-w-xs" />
          </div>
          <Skeleton className="settings-action h-9 w-full rounded-lg sm:w-20" />
        </div>
      ) : null}
    </div>
  );
}

/** Scrollable region inside archive / delete confirm sheets while impact loads. */
export function PropertyListingImpactSkeleton({
  variant = 'archive',
}: {
  variant?: 'archive' | 'delete';
}) {
  if (variant === 'delete') {
    return (
      <div role="status" className="space-y-4" aria-busy="true" aria-label="Loading delete details">
        <Skeleton className="h-3.5 w-full max-w-sm" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="space-y-2.5"
      aria-busy="true"
      aria-label="Loading archive details"
    >
      <Skeleton className="h-3.5 w-full max-w-[18rem]" />
      <Skeleton className="h-3.5 w-full max-w-[15rem]" />
      <Skeleton className="h-3.5 w-full max-w-[17rem]" />
    </div>
  );
}
