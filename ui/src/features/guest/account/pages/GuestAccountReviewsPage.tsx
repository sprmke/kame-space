import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { Link, useSearchParams } from 'react-router-dom';

import { Building2, Inbox, PencilLine, RefreshCw, Star } from 'lucide-react';

import { GuestAccountContentCard } from '@/features/guest/account/components/GuestAccountContentCard';
import { GuestAccountEmptyState } from '@/features/guest/account/components/GuestAccountEmptyState';
import {
  guestAccountListLayoutFromCount,
  guestAccountListLayoutStorageKey,
  readGuestAccountListLayoutHint,
  resolveGuestAccountListLoadState,
  writeGuestAccountListLayoutHint,
} from '@/features/guest/account/lib/guestAccountListLayout';
import { storeGuestBookingAccessToken } from '@/features/guest/form/lib/guestBookingAccess';
import { guestReviewPath } from '@/features/guest/lib/guestPublicPaths';

import { GuestReviewResponseSheet } from '@/features/reviews/components/GuestReviewResponseSheet';
import { ReportReviewSheet } from '@/features/reviews/components/ReportReviewSheet';
import { ReputationSummary } from '@/features/reviews/components/ReputationSummary';
import { ReviewResponseBlock } from '@/features/reviews/components/ReviewResponseBlock';
import { ReviewWindowBadge } from '@/features/reviews/components/ReviewWindowBadge';
import {
  useGuestMyReviews,
  useReportReviewAsGuest,
} from '@/features/reviews/hooks/useGuestMyReviews';
import type {
  GuestAboutYouItem,
  GuestByYouItem,
  GuestReviewListTab,
  GuestToWriteItem,
} from '@/features/reviews/lib/guestReviewsApi';

import { ResponsiveOverflowMenu } from '@/components/mobile/ResponsiveOverflowMenu';
import {
  GuestAccountEmptyStateSkeleton,
  GuestReviewsPageSkeleton,
} from '@/components/skeletons/GuestAccountSkeletons';
import { Button } from '@/components/ui/button';
import { SlidingTabs, SlidingTabsList, SlidingTabsTrigger } from '@/components/ui/sliding-tabs';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';
import { cn } from '@/lib/utils';
import { formatStayDateRange } from '@/utils/format/dates';

const TABS: Array<{ value: GuestReviewListTab; label: string; icon: typeof Star }> = [
  { value: 'to_write', label: 'To write', icon: PencilLine },
  { value: 'by_you', label: 'By you', icon: Star },
  { value: 'about_you', label: 'About you', icon: Inbox },
];

/** Nested review row inside the page card (avoids a second full content-card chrome). */
const REVIEW_ROW_CLASS = 'border-border bg-muted/20 rounded-xl border p-4 sm:p-5';

/** Same inset as `REVIEW_ROW_CLASS` so the tab strip lines up with row content. */
const REVIEWS_CARD_INSET = 'p-4 sm:p-5';

const EMBEDDED_EMPTY_CLASS =
  'border-0 bg-transparent shadow-none min-h-0 flex-1 rounded-none px-0 py-6 sm:px-0 sm:py-8';

export function GuestAccountReviewsPage() {
  usePageTitle(publicPageTitle('Reviews'));
  const [searchParams, setSearchParams] = useSearchParams();
  const tabRaw = searchParams.get('tab');
  const tab: GuestReviewListTab =
    tabRaw === 'by_you' || tabRaw === 'about_you' ? tabRaw : 'to_write';
  const query = useGuestMyReviews(tab);
  const report = useReportReviewAsGuest();
  const [respond, setRespond] = useState<{ bookingId: string; text: string | null } | null>(null);
  const [reportTarget, setReportTarget] = useState<string | null>(null);

  const items = useMemo(
    () =>
      (query.data?.pages ?? []).flatMap(
        (page) => page.items as Array<GuestToWriteItem | GuestByYouItem | GuestAboutYouItem>
      ),
    [query.data?.pages]
  );
  const reputation = query.data?.pages[0]?.reputation ?? null;
  const layoutKey = guestAccountListLayoutStorageKey(`reviews:${tab}`);
  const loadState = resolveGuestAccountListLoadState({
    isPending: query.isLoading,
    itemCount: query.data ? items.length : undefined,
    hint: readGuestAccountListLayoutHint(layoutKey),
    coldDefault: 'empty',
  });

  // `/guest-review` reads the booking access token from sessionStorage, so the
  // links below work without putting the token in the URL.
  useEffect(() => {
    for (const item of items) {
      if (item.accessToken) storeGuestBookingAccessToken(item.bookingId, item.accessToken);
    }
  }, [items]);

  useEffect(() => {
    if (loadState !== 'ready') return;
    writeGuestAccountListLayoutHint(layoutKey, guestAccountListLayoutFromCount(items.length));
  }, [loadState, layoutKey, items.length]);

  const setTab = (next: GuestReviewListTab) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === 'to_write') params.delete('tab');
        else params.set('tab', next);
        return params;
      },
      { replace: true }
    );
  };

  let body: ReactNode;
  if (loadState === 'empty') {
    body = (
      <GuestAccountEmptyStateSkeleton
        mascotPose="guest-review"
        ariaLabel="Loading reviews"
        className={EMBEDDED_EMPTY_CLASS}
      />
    );
  } else if (loadState === 'list') {
    body = <GuestReviewsPageSkeleton />;
  } else if (query.isError) {
    body = (
      <GuestAccountEmptyState
        className={EMBEDDED_EMPTY_CLASS}
        mascotPose="gentle-failure"
        title="Couldn't load reviews"
        description="Check your connection and try again."
        actionLabel="Try again"
        actionIcon={RefreshCw}
        onAction={() => void query.refetch()}
      />
    );
  } else if (items.length === 0) {
    body = (
      <GuestAccountEmptyState
        className={EMBEDDED_EMPTY_CLASS}
        mascotPose="guest-review"
        title={
          tab === 'to_write'
            ? 'No stays to review'
            : tab === 'about_you'
              ? 'No reviews about you'
              : 'No reviews yet'
        }
        description={
          tab === 'to_write'
            ? 'After checkout, stays waiting for your review appear here.'
            : tab === 'about_you'
              ? 'Host reviews of your stays will show up here.'
              : 'Reviews you leave after a stay will show up here.'
        }
        actionLabel="Browse properties"
        actionIcon={Building2}
        actionHref="/properties"
      />
    );
  } else {
    body = (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {tab === 'about_you' && reputation ? <ReputationSummary reputation={reputation} /> : null}
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={'id' in item ? item.id : item.bookingId}>
              {tab === 'to_write' ? (
                <ToWriteCard item={item as GuestToWriteItem} />
              ) : tab === 'by_you' ? (
                <ByYouCard item={item as GuestByYouItem} />
              ) : (
                <AboutYouCard
                  item={item as GuestAboutYouItem}
                  onRespond={() =>
                    setRespond({
                      bookingId: item.bookingId,
                      text: (item as GuestAboutYouItem).responseText,
                    })
                  }
                  onReport={() => setReportTarget((item as GuestAboutYouItem).id)}
                />
              )}
            </li>
          ))}
        </ul>
        {query.hasNextPage ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] w-full"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <GuestAccountContentCard bodyClassName="flex min-h-0 flex-1 flex-col gap-0 p-0 sm:p-0">
        <div className={cn('shrink-0', REVIEWS_CARD_INSET, 'pb-0 sm:pb-0')}>
          <SlidingTabs value={tab} onValueChange={(value) => setTab(value as GuestReviewListTab)}>
            <SlidingTabsList size="compact" className="w-fit max-w-full" aria-label="Reviews">
              {TABS.map((item) => (
                <SlidingTabsTrigger key={item.value} value={item.value} className="gap-1.5 px-3">
                  <item.icon className="size-3.5 shrink-0" aria-hidden />
                  {item.label}
                </SlidingTabsTrigger>
              ))}
            </SlidingTabsList>
          </SlidingTabs>
        </div>
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col',
            REVIEWS_CARD_INSET,
            'pt-3 sm:pt-3',
            items.length === 0 && loadState === 'ready' && !query.isError && 'justify-center'
          )}
        >
          {body}
        </div>
      </GuestAccountContentCard>

      <GuestReviewResponseSheet
        open={respond != null}
        onOpenChange={(open) => {
          if (!open) setRespond(null);
        }}
        bookingId={respond?.bookingId ?? ''}
        existingText={respond?.text ?? null}
      />
      <ReportReviewSheet
        open={reportTarget != null}
        onOpenChange={(open) => {
          if (!open) setReportTarget(null);
        }}
        reviewKind="host_guest_review"
        reviewId={reportTarget ?? ''}
        onSubmit={(input) => report.mutateAsync(input)}
        shell="guest"
      />
    </>
  );
}

function StayMeta({
  propertyName,
  checkInDate,
  checkOutDate,
}: {
  propertyName: string;
  checkInDate: string | null;
  checkOutDate: string | null;
}) {
  const range = formatStayDateRange(checkInDate, checkOutDate);
  return (
    <div className="min-w-0">
      <p className="truncate font-medium">{propertyName}</p>
      {range ? <p className="text-muted-foreground text-sm">{range}</p> : null}
    </div>
  );
}

function ToWriteCard({ item }: { item: GuestToWriteItem }) {
  return (
    <div className={REVIEW_ROW_CLASS}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <StayMeta
          propertyName={item.propertyName}
          checkInDate={item.checkInDate}
          checkOutDate={item.checkOutDate}
        />
        <div className="flex shrink-0 items-center justify-between gap-2 sm:ml-auto sm:justify-end">
          <ReviewWindowBadge closesAt={item.closesAt} />
          {item.propertySlug ? (
            <Button asChild className="min-h-[44px]">
              <Link to={guestReviewPath(item.propertySlug, item.bookingId)}>Write review</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ByYouCard({ item }: { item: GuestByYouItem }) {
  const pending = item.status !== 'published';
  return (
    <div className={REVIEW_ROW_CLASS}>
      <div className="flex items-start gap-3">
        <StayMeta
          propertyName={item.propertyName}
          checkInDate={item.checkInDate}
          checkOutDate={item.checkOutDate}
        />
        {pending ? (
          <span className="bg-muted text-muted-foreground ml-auto rounded-full px-2 py-0.5 text-xs font-medium">
            Pending
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm">
        {'★'.repeat(Math.max(0, Math.min(5, item.starRating)))}
        {item.reviewText ? ` · ${item.reviewText}` : ''}
      </p>
      <ReviewResponseBlock responseText={item.responseText} label="Host response" />
      {pending && item.propertySlug ? (
        <Button asChild variant="outline" className="mt-3 min-h-[44px]">
          <Link to={guestReviewPath(item.propertySlug, item.bookingId)}>Edit</Link>
        </Button>
      ) : null}
    </div>
  );
}

function AboutYouCard({
  item,
  onRespond,
  onReport,
}: {
  item: GuestAboutYouItem;
  onRespond: () => void;
  onReport: () => void;
}) {
  if (item.hiddenUntilYouReview) {
    return (
      <div className={REVIEW_ROW_CLASS}>
        <StayMeta
          propertyName={item.propertyName}
          checkInDate={item.checkInDate}
          checkOutDate={item.checkOutDate}
        />
        <p className="mt-2 text-sm">Hidden until you review</p>
        {item.propertySlug ? (
          <Button asChild className="mt-3 min-h-[44px]">
            <Link to={guestReviewPath(item.propertySlug, item.bookingId)}>Write review</Link>
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <div className={REVIEW_ROW_CLASS}>
      <div className="flex items-start gap-2">
        <StayMeta
          propertyName={item.propertyName}
          checkInDate={item.checkInDate}
          checkOutDate={item.checkOutDate}
        />
        <div className="ml-auto">
          <ResponsiveOverflowMenu
            label="Review actions"
            actionGroups={[[{ key: 'report', label: 'Report', onSelect: onReport }]]}
          />
        </div>
      </div>
      <p className="mt-2 text-sm">
        {item.overallRating != null ? `${'★'.repeat(item.overallRating)} ` : ''}
        {item.reviewText}
      </p>
      {item.privateNote ? (
        <p className="text-muted-foreground mt-2 text-sm">Private note: {item.privateNote}</p>
      ) : null}
      <ReviewResponseBlock responseText={item.responseText} />
      <Button type="button" variant="outline" className="mt-3 min-h-[44px]" onClick={onRespond}>
        {item.responseText ? 'Edit response' : 'Respond'}
      </Button>
    </div>
  );
}
