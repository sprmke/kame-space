import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import type { TicketsWorkspaceLayout } from '@/features/dashboard/help-support/lib/ticketsWorkspaceLayout';

type Props = {
  layout?: TicketsWorkspaceLayout;
  className?: string;
};

/** Matches TicketsWorkspacePage empty vs list chrome while tickets load. */
export function TicketsWorkspaceSkeleton({ layout = 'empty', className }: Props) {
  const isEmpty = layout === 'empty';

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading tickets"
      className={cn(
        'border-border/80 bg-card flex min-h-[20rem] overflow-hidden rounded-xl border shadow-sm lg:min-h-[480px]',
        className
      )}
    >
      <div
        className={cn(
          'border-border/80 flex min-h-0 flex-col',
          isEmpty ? 'w-full' : 'w-full lg:w-[min(100%,400px)] lg:border-r'
        )}
      >
        {/* Title only when we expect a list — empty chrome must not flash "My Tickets". */}
        {isEmpty ? null : (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b px-3 py-2.5">
            <p className="text-sm font-semibold">My Tickets</p>
            <span className="border-border inline-flex h-11 items-center rounded-md border px-3 text-sm font-medium sm:h-9">
              New
            </span>
          </div>
        )}

        {isEmpty ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-4">
            <Skeleton className="size-14 rounded-2xl" />
            <div className="flex w-full max-w-sm flex-col items-center gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-full max-w-xs" />
              <Skeleton className="h-3 w-3/4 max-w-[14rem]" />
            </div>
            <Skeleton className="mt-1 h-11 w-36 rounded-md" />
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-1 overflow-hidden p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="space-y-2 rounded-lg px-1 py-2.5"
                style={{ opacity: 1 - i * 0.08 }}
              >
                <div className="flex items-start justify-between gap-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-10 shrink-0" />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isEmpty ? null : (
        <div className="text-muted-foreground hidden flex-1 items-center justify-center p-8 text-sm lg:flex">
          Pick a ticket
        </div>
      )}
    </div>
  );
}
