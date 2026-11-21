import { Skeleton } from '@/components/ui/skeleton';

/**
 * Shell-shaped loader for the super-admin guard. Keeps the sidebar and page frame
 * visible while capabilities resolve, instead of replacing the console with a
 * centered splash.
 */
export function SuperAdminShellSkeleton() {
  return (
    <div
      className="bg-background flex min-h-dvh"
      role="status"
      aria-live="polite"
      aria-label="Loading the Super Admin console"
    >
      <aside className="border-border bg-sidebar hidden w-[17.5rem] shrink-0 flex-col border-r p-3 lg:flex">
        <div className="flex items-center gap-2 px-2 py-2">
          <Skeleton className="size-9 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <Skeleton className="h-10 w-full rounded-lg" />
          <div className="space-y-1.5 pt-2">
            <Skeleton className="h-2.5 w-20" />
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-8 w-full rounded-md" />
            ))}
          </div>
          <div className="space-y-1.5 pt-2">
            <Skeleton className="h-2.5 w-24" />
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-8 w-full rounded-md" />
            ))}
          </div>
        </div>
        <div className="mt-auto flex items-center gap-2 pt-4">
          <Skeleton className="size-9 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2.5 w-32" />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 items-center gap-2 border-b px-4 lg:h-16">
          <Skeleton className="size-8 rounded-lg lg:hidden" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="mx-auto w-full max-w-6xl space-y-4 p-4 sm:p-6">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="border-border space-y-3 rounded-xl border p-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-6 w-10" />
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
