/**
 * Billing period math — pure, no DB. Calendar months in Asia/Manila (UTC+8, no DST) with an
 * anchor day so a subscription started on the 31st renews on the last day of short months and
 * returns to the 31st afterwards (Jan 31 → Feb 28 → Mar 31), instead of drifting to Mar 3.
 *
 * Client preview mirror (display only): ui/src/features/dashboard/plans/lib/billingPeriod.ts
 */

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toManilaWallClock(date: Date): Date {
  return new Date(date.getTime() + MANILA_OFFSET_MS);
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Day of month (1-31) of an instant, as seen in Manila. */
export function manilaDayOfMonth(date: Date): number {
  return toManilaWallClock(date).getUTCDate();
}

/**
 * Same wall-clock time `months` calendar months later in Manila, on `anchorDay` (clamped to the
 * length of the target month). `anchorDay` defaults to the source date's own day.
 */
export function addBillingMonths(from: Date, anchorDay?: number | null, months = 1): Date {
  const wall = toManilaWallClock(from);
  const rawMonth = wall.getUTCMonth() + months;
  const year = wall.getUTCFullYear() + Math.floor(rawMonth / 12);
  const monthIndex = ((rawMonth % 12) + 12) % 12;
  const anchor =
    anchorDay != null && Number.isFinite(anchorDay) && anchorDay >= 1 && anchorDay <= 31
      ? Math.floor(anchorDay)
      : wall.getUTCDate();
  const day = Math.min(anchor, daysInMonth(year, monthIndex));
  const result = Date.UTC(
    year,
    monthIndex,
    day,
    wall.getUTCHours(),
    wall.getUTCMinutes(),
    wall.getUTCSeconds(),
    wall.getUTCMilliseconds()
  );
  return new Date(result - MANILA_OFFSET_MS);
}

/** First period end after `now`, stepping a month at a time from `start` (cron-outage catch-up). */
export function nextPeriodEndAfter(start: Date, anchorDay: number | null, now: Date): Date {
  let end = addBillingMonths(start, anchorDay, 1);
  let guard = 0;
  while (end.getTime() <= now.getTime() && guard < 48) {
    end = addBillingMonths(end, anchorDay, 1);
    guard += 1;
  }
  return end;
}

export type PeriodRemaining = {
  /** Fraction of the period still unused, clamped to [0, 1]. */
  fraction: number;
  /** Whole days left, rounded up (what a host reads as "3 days left"). */
  remainingDays: number;
  /** Whole days in the period. */
  totalDays: number;
};

export function periodRemaining(periodStart: Date, periodEnd: Date, now: Date): PeriodRemaining {
  const totalMs = Math.max(1, periodEnd.getTime() - periodStart.getTime());
  const effectiveNow = Math.max(now.getTime(), periodStart.getTime());
  const remainingMs = Math.max(0, periodEnd.getTime() - effectiveNow);
  return {
    fraction: Math.min(1, remainingMs / totalMs),
    remainingDays: Math.ceil(remainingMs / MS_PER_DAY),
    totalDays: Math.max(1, Math.round(totalMs / MS_PER_DAY)),
  };
}

/**
 * Credit for the unused share of what was actually paid for the current period (whole pesos).
 * Zero once the period has ended, for trials and admin grants (paid = 0), and never more than
 * what was paid.
 */
export function computeUnusedCreditPhp(input: {
  periodPaidPhp: number;
  periodStart: Date | null;
  periodEnd: Date | null;
  now: Date;
}): number {
  const paid = Math.max(0, Number(input.periodPaidPhp) || 0);
  if (paid <= 0 || !input.periodStart || !input.periodEnd) return 0;
  if (input.periodEnd.getTime() <= input.now.getTime()) return 0;
  const { fraction } = periodRemaining(input.periodStart, input.periodEnd, input.now);
  return Math.min(Math.round(paid), Math.round(paid * fraction));
}

/** Whole days from `now` until `target` (can be negative). Ceil, so "ends in 1 day" holds for <24h. */
export function daysUntil(target: Date, now: Date): number {
  return Math.ceil((target.getTime() - now.getTime()) / MS_PER_DAY);
}

/** "Dec 3, 2026" in Manila time, for emails and activity copy. */
export function formatManilaDateLabel(date: Date): string {
  return date.toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
