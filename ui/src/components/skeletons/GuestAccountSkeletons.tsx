import { HelpCircle, LifeBuoy, MessageCircle, Search } from 'lucide-react';

import type { KameMascotPose } from '@/components/branding/kameMascotAssets';
import { KameMascotImage } from '@/components/branding/KameMascotImage';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function ProfileFieldSkeleton({
  label,
  textarea = false,
  embedded = false,
}: {
  label: string;
  textarea?: boolean;
  embedded?: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium leading-none">{label}</p>
      <Skeleton
        className={cn(
          'w-full rounded-md',
          textarea ? (embedded ? 'h-[88px]' : 'h-[120px]') : 'h-10'
        )}
      />
    </div>
  );
}

const PROFILE_FIELDS = [
  { label: 'Display name' },
  { label: 'Bio', textarea: true },
  { label: 'Phone' },
  { label: 'Location' },
  { label: 'ID verification' },
];

export function GuestProfileFormSkeleton({
  embedded = false,
  className,
}: {
  embedded?: boolean;
  className?: string;
} = {}) {
  if (embedded) {
    return (
      <div
        role="status"
        className={cn('space-y-4', className)}
        aria-busy="true"
        aria-label="Loading profile"
      >
        <div className="flex justify-center px-1 pb-1 pt-2">
          <Skeleton className="size-24 rounded-full sm:size-28" />
        </div>
        <div className="space-y-4">
          {PROFILE_FIELDS.map((field) => (
            <ProfileFieldSkeleton
              key={field.label}
              label={field.label}
              textarea={field.textarea}
              embedded
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      className={cn(
        'grid grid-cols-1 gap-6 md:gap-8 lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)] lg:items-start lg:gap-10',
        className
      )}
      aria-busy="true"
      aria-label="Loading profile"
    >
      <div className="flex flex-col items-center gap-5 text-center">
        <Skeleton className="size-28 shrink-0 rounded-full sm:size-32" />
        <div className="flex w-full max-w-[14rem] flex-col items-center gap-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3.5 w-44" />
        </div>
      </div>
      <div className="space-y-6 lg:space-y-8">
        {PROFILE_FIELDS.map((field) => (
          <ProfileFieldSkeleton key={field.label} label={field.label} textarea={field.textarea} />
        ))}
      </div>
    </div>
  );
}

/**
 * Matches `GuestAccountEmptyState`: real mascot pose, skeleton copy + CTA.
 * Use when the load hint is `empty` so we do not flash a fake list.
 */
export function GuestAccountEmptyStateSkeleton({
  mascotPose,
  className,
  ariaLabel = 'Loading',
}: {
  mascotPose: KameMascotPose;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={ariaLabel}
      className={cn(
        'border-border bg-card flex w-full min-h-full flex-1 flex-col items-center justify-center rounded-2xl border px-5 py-8 text-center shadow-sm sm:px-6 sm:py-10',
        className
      )}
    >
      <div className="motion-safe:animate-float relative w-36 sm:w-40" aria-hidden>
        <KameMascotImage pose={mascotPose} />
      </div>
      <div className="mt-5 flex w-full max-w-sm flex-col items-center gap-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3.5 w-full max-w-xs" />
        <Skeleton className="h-3.5 w-3/4 max-w-[14rem]" />
      </div>
      <Skeleton className="mt-6 h-11 w-full max-w-xs rounded-full" />
    </div>
  );
}

export function GuestVoucherRowSkeleton() {
  return (
    <div className="border-border bg-card rounded-xl border px-3 py-2.5 shadow-sm">
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-8 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-32 max-w-full" />
        </div>
        <Skeleton className="h-5 w-14 rounded-md" />
      </div>
    </div>
  );
}

/** Tab strip chrome for reviews (matches SlidingTabs compact inside the page card). */
export function GuestReviewsTabsSkeleton() {
  return (
    <div
      className="bg-muted/50 inline-flex h-9 max-w-full items-center gap-1 rounded-full p-1"
      aria-hidden
    >
      <Skeleton className="h-7 w-[4.75rem] rounded-full" />
      <Skeleton className="h-7 w-16 rounded-full" />
      <Skeleton className="h-7 w-[5.25rem] rounded-full" />
    </div>
  );
}

export function GuestReviewsPageSkeleton() {
  return (
    <div role="status" className="space-y-3" aria-busy="true" aria-label="Loading reviews">
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-28 w-full rounded-2xl" />
    </div>
  );
}

export function GuestVouchersPageSkeleton({ rows = 4 }: { rows?: number } = {}) {
  return (
    <div
      role="status"
      className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      aria-busy="true"
      aria-label="Loading vouchers"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <GuestVoucherRowSkeleton key={i} />
      ))}
    </div>
  );
}

/** Trip list rows (not voucher tiles). */
export function GuestTripsPageSkeleton({ rows = 3 }: { rows?: number } = {}) {
  return (
    <div role="status" className="space-y-2" aria-busy="true" aria-label="Loading trips">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl p-2">
          <Skeleton className="size-14 shrink-0 rounded-lg sm:size-16" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3 max-w-[12rem]" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="size-4 shrink-0 rounded" />
        </div>
      ))}
    </div>
  );
}

/** Favorites grid — matches `GuestWishlistPage` tracks. */
export function GuestFavoritesPageSkeleton({ cards = 4 }: { cards?: number } = {}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading favorites"
      className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,15rem)] sm:gap-x-4 sm:gap-y-5"
    >
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-[4/3] w-full rounded-xl" />
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/**
 * Account Help home: real mascot + Help chrome, skeleton topic tiles.
 * Matches `GuestAccountHelpPage` home layout (not the old stacked cards).
 */
export function GuestAccountHelpPageSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading help" className="pb-1">
      <div className="flex flex-col items-center px-4 pt-6 text-center sm:px-5 sm:pt-8">
        <div className="relative w-28 sm:w-32" aria-hidden>
          <KameMascotImage pose="help-support" />
        </div>
        <div className="mt-4 max-w-sm space-y-1.5">
          <p className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">Help</p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Answers about trips, messages, vouchers, etc.
          </p>
        </div>
      </div>

      <div className="px-4 pt-4 sm:px-5">
        <div
          className="border-input bg-background flex h-11 w-full items-center gap-2 rounded-md border px-3"
          aria-hidden
        >
          <Search className="text-muted-foreground size-4 shrink-0" />
          <span className="text-muted-foreground text-sm">Search help</span>
        </div>
      </div>

      <div className="bg-border/70 mt-4 grid grid-cols-1 gap-px sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-card flex min-h-[7.5rem] flex-col items-center justify-center gap-2 px-4 py-5 sm:min-h-[8.5rem]"
          >
            <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
              <HelpCircle className="size-4" aria-hidden />
            </div>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>

      <div className="border-border/70 flex flex-col gap-3 border-t px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-start gap-2.5">
          <LifeBuoy className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="min-w-0 space-y-1">
            <p className="text-foreground text-sm font-semibold">Still need help?</p>
            <p className="text-muted-foreground text-xs sm:text-sm">
              Send a ticket and we will reply in your account.
            </p>
          </div>
        </div>
        <span className="border-border inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border px-5 text-sm font-medium">
          <MessageCircle className="size-4 shrink-0" aria-hidden />
          Contact support
        </span>
      </div>
    </div>
  );
}
