import type { ReactNode } from 'react';

import { Link, useNavigate } from 'react-router-dom';

import {
  ExternalLink,
  Flag,
  Megaphone,
  PencilLine,
  Reply,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';

import { propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';

import { RatingStars } from '@/features/reviews/components/RatingStars';
import { ReviewAvatar } from '@/features/reviews/components/ReviewAvatar';
import type { ReviewScopeProps } from '@/features/reviews/components/ReviewsTable';
import { ReviewWindowBadge } from '@/features/reviews/components/ReviewWindowBadge';
import type {
  ReceivedReviewItem,
  ToWriteItem,
  WrittenReviewItem,
} from '@/features/reviews/lib/propertyReviewsApi';

import { AdminListCardOverflowMenu } from '@/components/mobile/AdminListCardOverflowMenu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatManilaLongDate, formatStayDateRange } from '@/utils/format/dates';

/** Same grid as the other admin card views (Maintenance / Finance stays). */
function CardGrid({ children }: { children: ReactNode }) {
  return (
    <div className="native-stagger grid grid-cols-1 items-stretch gap-2 sm:grid-cols-2 sm:gap-3.5 lg:grid-cols-3 xl:grid-cols-4">
      {children}
    </div>
  );
}

/**
 * One card. The whole surface opens the review through a single overlay button that is a
 * sibling of the content, not a wrapper: wrapping it in `role="button"` hid the ⋯ menu and the
 * Reply button from screen readers and from role-based queries. The interactive children sit
 * above the overlay (`z-20`), everything else is covered by it, so tapping anywhere on the card
 * that is not an action still opens the review.
 */
function ReviewCard({
  children,
  onOpen,
  openLabel,
}: {
  children: ReactNode;
  onOpen?: () => void;
  openLabel: string;
}) {
  return (
    <div className="surface-card relative flex min-h-[8.5rem] flex-col gap-2 p-3.5 text-left">
      {children}
      {onOpen ? (
        <button
          type="button"
          aria-label={openLabel}
          onClick={onOpen}
          className="focus-visible:ring-primary/40 absolute inset-0 z-0 rounded-[inherit] outline-none focus-visible:ring-2"
        />
      ) : null}
    </div>
  );
}

function CardHeader({ name, trailing }: { name: string; trailing?: ReactNode }) {
  return (
    <div className="pointer-events-none relative z-10 flex items-start justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <ReviewAvatar name={name} className="size-8 shrink-0" />
        <p className="text-foreground min-w-0 truncate text-[13px] font-semibold">{name}</p>
      </div>
      {trailing ? (
        <div className="pointer-events-auto relative z-20 shrink-0">{trailing}</div>
      ) : null}
    </div>
  );
}

function CardFooter({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none relative z-20 mt-auto flex items-center justify-between gap-2 pt-1">
      {children}
    </div>
  );
}

export function ReceivedReviewsCardGrid({
  rows,
  orgSlug,
  resolvePropertySlug,
  resolvePropertyName,
  showProperty = false,
  canRespond,
  onOpen,
  onRespond,
  onReport,
}: ReviewScopeProps<ReceivedReviewItem> & {
  rows: ReceivedReviewItem[];
  canRespond: (review: ReceivedReviewItem) => boolean;
  onOpen: (review: ReceivedReviewItem) => void;
  onRespond: (review: ReceivedReviewItem) => void;
  onReport: (review: ReceivedReviewItem) => void;
}) {
  const navigate = useNavigate();

  return (
    <CardGrid>
      {rows.map((review) => {
        const guestName = review.guestName || 'Guest';
        const stayRange = formatStayDateRange(review.checkInDate, review.checkOutDate);
        const propertySlug = resolvePropertySlug(review);
        const propertyName = resolvePropertyName?.(review) ?? '';
        const mayRespond = canRespond(review);
        const bookingHref = `${propertySectionPath(orgSlug, propertySlug, 'bookings')}/${review.bookingId}`;
        const marketingHref = `${propertySectionPath(orgSlug, propertySlug, 'marketing')}?tab=design&reviewId=${encodeURIComponent(review.id)}`;

        return (
          <ReviewCard
            key={review.id}
            openLabel={`Open ${guestName}'s review`}
            onOpen={() => onOpen(review)}
          >
            <CardHeader
              name={guestName}
              trailing={
                <AdminListCardOverflowMenu
                  label={`Actions for ${guestName}'s review`}
                  sheetTitle={guestName}
                  actions={[
                    {
                      key: 'booking',
                      label: 'Open booking',
                      icon: <ExternalLink className="size-5" aria-hidden />,
                      onSelect: () => navigate(bookingHref),
                    },
                    {
                      key: 'marketing',
                      label: 'Use in marketing',
                      icon: <Megaphone className="size-5" aria-hidden />,
                      onSelect: () => navigate(marketingHref),
                    },
                    ...(mayRespond
                      ? [
                          {
                            key: 'report',
                            label: 'Report',
                            icon: <Flag className="size-5" aria-hidden />,
                            destructive: true,
                            onSelect: () => onReport(review),
                          },
                        ]
                      : []),
                  ]}
                />
              }
            />
            <div className="space-y-1">
              <RatingStars value={review.starRating} />
              {showProperty && propertyName ? (
                <p className="text-foreground truncate text-xs font-medium">{propertyName}</p>
              ) : null}
              {stayRange ? <p className="text-data-secondary truncate">{stayRange}</p> : null}
            </div>
            {review.reviewText?.trim() ? (
              <p className="text-muted-foreground line-clamp-3 text-xs leading-relaxed">
                {review.reviewText}
              </p>
            ) : null}
            <CardFooter>
              {review.responseText ? (
                <Badge variant="success" className="font-medium">
                  Responded
                </Badge>
              ) : (
                <span />
              )}
              {/* The page's primary job, on the surface hosts actually use. It used to live
                  only inside the ⋯ sheet. */}
              {mayRespond ? (
                <Button
                  type="button"
                  variant="outline"
                  className="pointer-events-auto min-h-[44px] shrink-0 px-3"
                  onClick={() => onRespond(review)}
                >
                  <Reply className="mr-1.5 size-4" aria-hidden />
                  {review.responseText ? 'Edit reply' : 'Reply'}
                </Button>
              ) : null}
            </CardFooter>
          </ReviewCard>
        );
      })}
    </CardGrid>
  );
}

export function WrittenReviewsCardGrid({
  rows,
  resolvePropertyName,
  showProperty = false,
  onOpen,
}: Pick<ReviewScopeProps<WrittenReviewItem>, 'resolvePropertyName' | 'showProperty'> & {
  rows: WrittenReviewItem[];
  onOpen: (review: WrittenReviewItem) => void;
}) {
  return (
    <CardGrid>
      {rows.map((review) => {
        const guestName = review.guestName || 'Guest';
        const submitted = formatManilaLongDate(review.submittedAt);
        const propertyName = resolvePropertyName?.(review) ?? '';

        return (
          <ReviewCard
            key={review.id}
            openLabel={`Open ${guestName}'s guest review`}
            onOpen={() => onOpen(review)}
          >
            <CardHeader
              name={guestName}
              trailing={
                review.status === 'submitted' ? (
                  <Badge variant="outline" className="font-medium">
                    Hidden until publish
                  </Badge>
                ) : undefined
              }
            />
            <div className="space-y-1">
              <RatingStars value={review.overallRating} />
              {showProperty && propertyName ? (
                <p className="text-foreground truncate text-xs font-medium">{propertyName}</p>
              ) : null}
              {submitted ? <p className="text-data-secondary truncate">{submitted}</p> : null}
            </div>
            {review.reviewText?.trim() ? (
              <p className="text-muted-foreground line-clamp-3 text-xs leading-relaxed">
                {review.reviewText}
              </p>
            ) : null}
            <CardFooter>
              <Badge
                variant={review.wouldHostAgain ? 'success' : 'destructive'}
                className="font-medium"
              >
                {review.wouldHostAgain ? (
                  <ThumbsUp className="size-3" aria-hidden />
                ) : (
                  <ThumbsDown className="size-3" aria-hidden />
                )}
                {review.wouldHostAgain ? 'Would host again' : 'Would not host again'}
              </Badge>
            </CardFooter>
          </ReviewCard>
        );
      })}
    </CardGrid>
  );
}

export function ToWriteReviewsCardGrid({
  rows,
  orgSlug,
  resolvePropertySlug,
  resolvePropertyName,
  showProperty = false,
  canWrite,
  onWrite,
}: ReviewScopeProps<ToWriteItem> & {
  rows: ToWriteItem[];
  canWrite: (row: ToWriteItem) => boolean;
  onWrite: (row: ToWriteItem) => void;
}) {
  return (
    <CardGrid>
      {rows.map((row) => {
        const guestName = row.guestName || 'Guest';
        const stayRange = formatStayDateRange(row.checkInDate, row.checkOutDate);
        const propertyName = resolvePropertyName?.(row) ?? '';
        const mayWrite = canWrite(row);
        const bookingHref = `${propertySectionPath(orgSlug, resolvePropertySlug(row), 'bookings')}/${row.bookingId}`;

        return (
          <ReviewCard
            key={row.bookingId}
            openLabel={`Open ${guestName}'s stay`}
            onOpen={mayWrite ? () => onWrite(row) : undefined}
          >
            <CardHeader name={guestName} trailing={<ReviewWindowBadge closesAt={row.closesAt} />} />
            <div className="space-y-1">
              {showProperty && propertyName ? (
                <p className="text-foreground truncate text-xs font-medium">{propertyName}</p>
              ) : null}
              {stayRange ? <p className="text-data-secondary truncate">{stayRange}</p> : null}
            </div>
            <CardFooter>
              {mayWrite ? (
                <Button
                  type="button"
                  variant="outline"
                  className="pointer-events-auto min-h-[44px] w-full"
                  onClick={() => onWrite(row)}
                >
                  <PencilLine className="mr-1.5 size-4" aria-hidden />
                  Write review
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="pointer-events-auto min-h-[44px] w-full"
                  asChild
                >
                  <Link to={bookingHref}>Open booking</Link>
                </Button>
              )}
            </CardFooter>
          </ReviewCard>
        );
      })}
    </CardGrid>
  );
}
