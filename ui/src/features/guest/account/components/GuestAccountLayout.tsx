import { Suspense } from 'react';

import { Outlet, useLocation } from 'react-router-dom';

import { GuestAccountSidebar } from '@/features/guest/account/components/GuestAccountSidebar';

import { GuestAccountRouteSuspenseFallback } from '@/components/skeletons/MarketingRouteFallback';
import { cn } from '@/lib/utils';

const MARKETING_HEADER_OFFSET = 'pt-[var(--public-nav-h)] lg:pt-[calc(var(--public-nav-h)+1rem)]';

/**
 * Guest account shell. Phone uses D10 bottom tabs + Account hub rows (no secondary
 * strip). Desktop keeps the sidebar.
 */
export function GuestAccountLayout() {
  const location = useLocation();

  return (
    <div className={cn('bg-muted/20 min-h-dvh', MARKETING_HEADER_OFFSET)}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex w-full gap-6 lg:gap-8 xl:gap-10">
          <aside
            className="border-sidebar-border bg-sidebar hidden w-[260px] shrink-0 self-start rounded-2xl border shadow-sm lg:sticky lg:top-24 lg:block lg:max-h-[calc(100dvh-7rem)] lg:overflow-hidden"
            aria-label="Account navigation"
          >
            <GuestAccountSidebar pathname={location.pathname} />
          </aside>

          <main className="w-full min-w-0 flex-1 pb-10 pt-4 sm:pb-12 md:pt-6 lg:pb-14 lg:pt-0">
            <div className="w-full">
              <Suspense fallback={<GuestAccountRouteSuspenseFallback />}>
                <Outlet />
              </Suspense>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
