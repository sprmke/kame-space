import { Suspense } from 'react';

import { Outlet, useLocation } from 'react-router-dom';

import { GuestAccountMobileNav } from '@/features/guest/account/components/GuestAccountMobileNav';
import { GuestAccountSidebar } from '@/features/guest/account/components/GuestAccountSidebar';

import { GuestAccountRouteSuspenseFallback } from '@/components/skeletons/MarketingRouteFallback';
import { cn } from '@/lib/utils';

const MARKETING_HEADER_OFFSET = 'pt-[var(--public-nav-h)] lg:pt-[calc(var(--public-nav-h)+1rem)]';

/**
 * Guest account shell. On `lg+`, the main column stretches to at least the
 * sidebar card height so empty pages keep a consistent panel height.
 */
export function GuestAccountLayout() {
  const location = useLocation();

  return (
    <div className={cn('bg-muted/20 min-h-dvh', MARKETING_HEADER_OFFSET)}>
      <GuestAccountMobileNav
        pathname={location.pathname}
        className="sticky top-[var(--public-nav-h)] z-30 lg:hidden"
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex w-full gap-6 lg:items-stretch lg:gap-8 xl:gap-10">
          <aside
            className="border-sidebar-border bg-sidebar hidden w-[260px] shrink-0 rounded-2xl border shadow-sm lg:sticky lg:top-24 lg:block lg:max-h-[calc(100dvh-7rem)] lg:overflow-hidden"
            aria-label="Account navigation"
          >
            <GuestAccountSidebar pathname={location.pathname} />
          </aside>

          <main className="flex w-full min-w-0 flex-1 flex-col pb-10 pt-4 sm:pb-12 md:pt-6 lg:pb-14 lg:pt-0">
            <div className="flex min-h-full w-full flex-1 flex-col">
              <Suspense fallback={<GuestAccountRouteSuspenseFallback />}>
                <div className="flex min-h-full w-full flex-1 flex-col [&>*]:min-h-full [&>*]:flex-1">
                  <Outlet />
                </div>
              </Suspense>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
