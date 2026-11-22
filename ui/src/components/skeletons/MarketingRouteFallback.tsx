import type { ReactNode } from 'react';

import { useLocation } from 'react-router-dom';

import { GuestAccountContentCard } from '@/features/guest/account/components/GuestAccountContentCard';
import {
  guestAccountListLayoutStorageKey,
  readGuestAccountListLayoutHint,
} from '@/features/guest/account/lib/guestAccountListLayout';

import {
  GuestAccountEmptyStateSkeleton,
  GuestAccountHelpPageSkeleton,
  GuestFavoritesPageSkeleton,
  GuestProfileFormSkeleton,
  GuestReviewsPageSkeleton,
  GuestReviewsTabsSkeleton,
  GuestTripsPageSkeleton,
  GuestVouchersPageSkeleton,
} from '@/components/skeletons/GuestAccountSkeletons';
import {
  DevelopmentDetailPageSkeleton,
  GuestAccountGateSkeleton,
  ParkingDetailPageSkeleton,
  PropertyChatPageSkeleton,
  PropertyDetailPageSkeleton,
  PublicLandingPageSkeleton,
} from '@/components/skeletons/GuestMarketingSkeleton';
import {
  GuestDevelopmentDetailRouteSkeleton,
  GuestFormRouteSkeleton,
  GuestMarketingListRouteSkeleton,
  GuestSearchRouteSkeleton,
} from '@/components/skeletons/RouteSkeletons';
import { TicketsWorkspaceSkeleton } from '@/components/skeletons/TicketsWorkspaceSkeleton';

/** Path-aware Suspense fallback for `MarketingLayoutShell` (nav + footer stay mounted). */
export function MarketingRouteSuspenseFallback() {
  const { pathname } = useLocation();

  if (pathname === '/search') {
    return <GuestSearchRouteSkeleton />;
  }

  if (/^\/developments\/[^/]+\/?$/.test(pathname)) {
    return <GuestDevelopmentDetailRouteSkeleton />;
  }

  if (/^\/developments\/[^/]+\/(properties|parking)\/?$/.test(pathname)) {
    return <GuestMarketingListRouteSkeleton />;
  }

  if (/^\/developments(\/in\/[^/]+)?\/?$/.test(pathname)) {
    return <GuestMarketingListRouteSkeleton />;
  }

  if (
    /^\/properties(\/in\/[^/]+)?\/?$/.test(pathname) ||
    /^\/parkings(\/in\/[^/]+)?\/?$/.test(pathname)
  ) {
    return <GuestMarketingListRouteSkeleton />;
  }

  if (/^\/properties\/[^/]+\/?$/.test(pathname)) {
    return <PropertyDetailPageSkeleton />;
  }

  if (/^\/parkings\/[^/]+\/?$/.test(pathname)) {
    return <ParkingDetailPageSkeleton />;
  }

  if (
    /^\/parkings\/[^/]+\/form\/?$/.test(pathname) ||
    /^\/properties\/[^/]+\/form\/?$/.test(pathname)
  ) {
    return <GuestFormRouteSkeleton />;
  }

  if (/^\/hosts\/[^/]+\/?$/.test(pathname)) {
    return <DevelopmentDetailPageSkeleton />;
  }

  if (pathname.startsWith('/for-hosts')) {
    return <PublicLandingPageSkeleton />;
  }

  if (pathname === '/' || pathname.startsWith('/explore-preview')) {
    return <PublicLandingPageSkeleton />;
  }

  return <PublicLandingPageSkeleton />;
}

function GuestAccountListSuspenseFallback({
  page,
  emptyPose,
  list,
}: {
  page: string;
  emptyPose: Parameters<typeof GuestAccountEmptyStateSkeleton>[0]['mascotPose'];
  list: ReactNode;
}) {
  const hint = readGuestAccountListLayoutHint(guestAccountListLayoutStorageKey(page));
  if (hint === 'list') {
    return <GuestAccountContentCard>{list}</GuestAccountContentCard>;
  }
  return <GuestAccountEmptyStateSkeleton mascotPose={emptyPose} />;
}

/** Suspense fallback inside guest account shell (sidebar stays mounted). */
export function GuestAccountRouteSuspenseFallback() {
  const { pathname } = useLocation();

  if (pathname.includes('/account/stays') || pathname.includes('/account/messages')) {
    const hint = readGuestAccountListLayoutHint(guestAccountListLayoutStorageKey('messages'));
    if (hint === 'list') return <PropertyChatPageSkeleton />;
    return <GuestAccountEmptyStateSkeleton mascotPose="guest-inbox" ariaLabel="Loading messages" />;
  }

  if (pathname.includes('/account/profile') || pathname.includes('/account/settings')) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <GuestProfileFormSkeleton />
      </div>
    );
  }

  if (pathname.includes('/account/help')) {
    return (
      <GuestAccountContentCard bodyClassName="p-0">
        <GuestAccountHelpPageSkeleton />
      </GuestAccountContentCard>
    );
  }

  if (pathname.includes('/account/tickets')) {
    return (
      <GuestAccountContentCard bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0 sm:p-0">
        <TicketsWorkspaceSkeleton layout="empty" className="min-h-0 flex-1 border-0 shadow-none" />
      </GuestAccountContentCard>
    );
  }

  if (pathname.includes('/account/vouchers')) {
    return (
      <GuestAccountListSuspenseFallback
        page="vouchers"
        emptyPose="voucher"
        list={<GuestVouchersPageSkeleton />}
      />
    );
  }

  if (pathname.includes('/account/reviews')) {
    const hint = readGuestAccountListLayoutHint(
      guestAccountListLayoutStorageKey('reviews:to_write')
    );
    const isList = hint === 'list';
    return (
      <GuestAccountContentCard bodyClassName="flex min-h-0 flex-1 flex-col gap-0 p-0 sm:p-0">
        <div className="shrink-0 p-4 pb-0 sm:p-5 sm:pb-0">
          <GuestReviewsTabsSkeleton />
        </div>
        <div
          className={
            isList
              ? 'flex min-h-0 flex-1 flex-col p-4 pt-3 sm:p-5 sm:pt-3'
              : 'flex min-h-0 flex-1 flex-col justify-center p-4 pt-3 sm:p-5 sm:pt-3'
          }
        >
          {isList ? (
            <GuestReviewsPageSkeleton />
          ) : (
            <GuestAccountEmptyStateSkeleton
              mascotPose="guest-review"
              ariaLabel="Loading reviews"
              className="min-h-0 flex-1 rounded-none border-0 bg-transparent px-0 py-6 shadow-none sm:px-0 sm:py-8"
            />
          )}
        </div>
      </GuestAccountContentCard>
    );
  }

  if (pathname.includes('/account/favorites') || pathname.includes('/account/wishlist')) {
    return (
      <GuestAccountListSuspenseFallback
        page="favorites"
        emptyPose="favorites"
        list={<GuestFavoritesPageSkeleton />}
      />
    );
  }

  if (pathname.includes('/account/trips')) {
    return (
      <GuestAccountListSuspenseFallback
        page="trips"
        emptyPose="arrival"
        list={<GuestTripsPageSkeleton />}
      />
    );
  }

  return <GuestAccountGateSkeleton />;
}
