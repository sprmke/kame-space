import { Star } from 'lucide-react';

import { spokenRating, starFillRatio } from '@/features/reviews/lib/ratingFill';

import { cn } from '@/lib/utils';

type Props = {
  /** 0–5. Fractional averages fill the matching part of a star. */
  value: number;
  className?: string;
};

/**
 * Read-only star rating for review cards and tables. The input picker is
 * `GuestReviewStarRating`; this one is not focusable and reads as one label.
 *
 * Fractional values draw a partially filled star instead of rounding: a 3.6 average used to
 * show four full stars next to the number 3.6, which disagreed with itself.
 */
export function RatingStars({ value, className }: Props) {
  const rating = Math.min(5, Math.max(0, Number(value) || 0));
  return (
    <span
      role="img"
      aria-label={`${spokenRating(rating)} out of 5 stars`}
      className={cn('inline-flex items-center gap-0.5', className)}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = starFillRatio(rating, star);
        return (
          <span key={star} className="relative inline-flex shrink-0">
            <Star aria-hidden strokeWidth={1.5} className="text-muted-foreground/35 size-4" />
            {fill > 0 ? (
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star strokeWidth={0} className="size-4 fill-amber-400 text-amber-400" />
              </span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}
