import { useEffect } from 'react';

import { Building2 } from 'lucide-react';

import { GuestAccountContentCard } from '@/features/guest/account/components/GuestAccountContentCard';
import { GuestAccountEmptyState } from '@/features/guest/account/components/GuestAccountEmptyState';
import { WishlistPropertyCard } from '@/features/guest/account/components/WishlistPropertyCard';
import {
  guestAccountListLayoutFromCount,
  guestAccountListLayoutStorageKey,
  readGuestAccountListLayoutHint,
  resolveGuestAccountListLoadState,
  writeGuestAccountListLayoutHint,
} from '@/features/guest/account/lib/guestAccountListLayout';
import { useSavedPropertySlugsQuery } from '@/features/guest/marketing/properties/hooks/useSavedPropertySlugsQuery';

import {
  GuestAccountEmptyStateSkeleton,
  GuestFavoritesPageSkeleton,
} from '@/components/skeletons/GuestAccountSkeletons';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';

/** Fixed ~240px tracks (same scale as explore carousels); 2-up on mobile. */
const WISHLIST_GRID_CLASS =
  'grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,15rem)] sm:gap-x-4 sm:gap-y-5';

const LAYOUT_KEY = guestAccountListLayoutStorageKey('favorites');

export function GuestWishlistPage() {
  usePageTitle(publicPageTitle('Favorites'));
  const { data, isLoading } = useSavedPropertySlugsQuery();
  const slugs = data ?? [];
  const loadState = resolveGuestAccountListLoadState({
    isPending: isLoading,
    itemCount: data !== undefined ? data.length : undefined,
    hint: readGuestAccountListLayoutHint(LAYOUT_KEY),
    coldDefault: 'empty',
  });

  useEffect(() => {
    if (loadState !== 'ready') return;
    writeGuestAccountListLayoutHint(LAYOUT_KEY, guestAccountListLayoutFromCount(slugs.length));
  }, [loadState, slugs.length]);

  if (loadState === 'empty') {
    return (
      <GuestAccountEmptyStateSkeleton mascotPose="favorites" ariaLabel="Loading favorites" />
    );
  }

  if (loadState === 'list') {
    return (
      <GuestAccountContentCard>
        <GuestFavoritesPageSkeleton />
      </GuestAccountContentCard>
    );
  }

  if (slugs.length === 0) {
    return (
      <GuestAccountEmptyState
        mascotPose="favorites"
        title="No favorites yet"
        description="Save places you like so you can find them later."
        actionLabel="Browse properties"
        actionIcon={Building2}
        actionHref="/properties"
      />
    );
  }

  return (
    <GuestAccountContentCard>
      <div className={WISHLIST_GRID_CLASS}>
        {slugs.map((slug) => (
          <WishlistPropertyCard key={slug} slug={slug} />
        ))}
      </div>
    </GuestAccountContentCard>
  );
}
