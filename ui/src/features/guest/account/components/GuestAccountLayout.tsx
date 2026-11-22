import { Suspense } from 'react';

import { Outlet, useLocation } from 'react-router-dom';

import { GuestAccountMobileNav } from '@/features/guest/account/components/GuestAccountMobileNav';
import { GuestAccountSidebar } from '@/features/guest/account/components/GuestAccountSidebar';

import { GuestAccountRouteSuspenseFallback } from '@/components/skeletons/MarketingRouteFallback';
import { cn } from '@/lib/utils';

const MARKETING_HEADER_OFFSET = 'pt-[var(--public-nav-h)] lg:pt-[calc(var(--public-nav-h)+1rem)]';

/**
 * Guest account shell. On `lg+`, sidebar and main share one stretch height
 * (taller column wins) so content cards and the nav card align at the bottom.
 */
export function GuestAccountLayout() {
  const location = useLocation();

  return (
    <div className={cn('bg-muted/20 min-h-dvh', MARKETING_HEADER_OFFSET)}>
      <GuestAccountMobileNav
        pathname={location.pathname}
        className="sticky top-[var(--public-nav-h)] z-30 lg:hidden"
      />

      <div className="container mx-auto px-4 pb-10 pt-4 sm:px-6 sm:pb-12 md:pt-6 lg:px-8 lg:pb-14 lg:pt-0">
        <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-8 xl:gap-10">
          <aside
            className="border-sidebar-border bg-sidebar hidden w-[260px] shrink-0 flex-col overflow-hidden rounded-2xl border shadow-sm lg:flex"
            aria-label="Account navigation"
          >
            <GuestAccountSidebar pathname={location.pathname} />
          </aside>

          <main className="flex min-w-0 flex-1 flex-col">
            <Suspense fallback={<GuestAccountRouteSuspenseFallback />}>
              <div className="flex w-full flex-1 flex-col [&>*]:flex-1">
                <Outlet />
              </div>
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  );
}
