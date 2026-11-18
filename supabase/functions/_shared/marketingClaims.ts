/**
 * Marketing Planner claims — the machine-checkable facts an item asserts.
 *
 * Every item stores what it says ("these nights are open", "from 3200 a night",
 * "4.9 from 38 reviews"). Pure code rebuilds and re-validates those claims before
 * the item is shown, when the calendar changes, and right before publishing, so a
 * post can never ship a date or price that stopped being true.
 *
 * Pure: no clock, no DB, no network.
 */

export type ClaimRating = { avg: number; count: number };

export type PlannerClaims = {
  /** Promoted nights, YYYY-MM-DD, Manila calendar. */
  openNights?: string[];
  /** Open check-in dates left in the promoted month. */
  nightsLeftInMonth?: number;
  /** Nightly rate the copy quotes, in PHP. */
  rateFrom?: number;
  rating?: ClaimRating;
  /** Guest review the item is built on. */
  reviewId?: string;
  /** Window the item claims is sold out. */
  fullyBookedWindow?: { from: string; to: string };
};

export type ClaimContext = {
  /** Nights that are occupied or blocked. */
  blockedNights: ReadonlySet<string>;
  /** Resolved live nightly rate for the promoted nights, or null when unknown. */
  liveRateFrom: number | null;
  /** Current published rating, or null when the property has none. */
  liveRating: ClaimRating | null;
  /** Review ids still eligible for social use. */
  liveReviewIds?: ReadonlySet<string>;
};

export type ClaimValidation = { ok: true } | { ok: false; reason: string };

export const CLAIMS_OK: ClaimValidation = { ok: true };

function monthKey(ymd: string): string {
  return ymd.slice(0, 7);
}

/** Count open nights remaining in the month of `anchorYmd`, from that day on. */
export function openNightsLeftInMonth(
  anchorYmd: string,
  blockedNights: ReadonlySet<string>
): number {
  const month = monthKey(anchorYmd);
  const [year, monthIndex] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  const startDay = Number(anchorYmd.slice(8, 10));
  let open = 0;
  for (let day = startDay; day <= daysInMonth; day += 1) {
    const ymd = `${month}-${String(day).padStart(2, '0')}`;
    if (!blockedNights.has(ymd)) open += 1;
  }
  return open;
}

function formatNightLabel(ymd: string): string {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/**
 * Availability-only check: nights, dates left, sold-out window. Cheap enough to run on
 * every plan read, since it needs nothing but the blocked-night set.
 */
export function validateAvailabilityClaims(
  claims: PlannerClaims,
  blockedNights: ReadonlySet<string>
): ClaimValidation {
  for (const night of claims.openNights ?? []) {
    if (blockedNights.has(night)) {
      return { ok: false, reason: `${formatNightLabel(night)} got booked` };
    }
  }

  if (claims.nightsLeftInMonth != null) {
    const anchor = claims.openNights?.[0];
    if (anchor) {
      const live = openNightsLeftInMonth(anchor, blockedNights);
      if (live < claims.nightsLeftInMonth) {
        return {
          ok: false,
          reason: `Only ${live} ${live === 1 ? 'date is' : 'dates are'} left this month, not ${claims.nightsLeftInMonth}`,
        };
      }
    }
  }

  if (claims.fullyBookedWindow) {
    const { from, to } = claims.fullyBookedWindow;
    const month = monthKey(from);
    const [year, monthIndex] = month.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      const ymd = `${month}-${String(day).padStart(2, '0')}`;
      if (ymd >= from && ymd <= to && !blockedNights.has(ymd)) {
        return { ok: false, reason: 'A date in that window is open again' };
      }
    }
  }

  return CLAIMS_OK;
}

/**
 * Validate an item's claims against live data. The first broken claim wins, so the
 * host gets one plain reason instead of a list.
 */
export function validateClaims(claims: PlannerClaims, ctx: ClaimContext): ClaimValidation {
  const availability = validateAvailabilityClaims(claims, ctx.blockedNights);
  if (!availability.ok) return availability;

  if (claims.rateFrom != null) {
    if (ctx.liveRateFrom == null) {
      return { ok: false, reason: 'The nightly rate is no longer available' };
    }
    if (Math.round(ctx.liveRateFrom) !== Math.round(claims.rateFrom)) {
      return { ok: false, reason: 'The nightly rate changed' };
    }
  }

  if (claims.rating) {
    const live = ctx.liveRating;
    if (!live) return { ok: false, reason: 'The rating is no longer available' };
    if (live.avg + 1e-9 < claims.rating.avg) {
      return { ok: false, reason: `The rating is now ${live.avg.toFixed(1)}` };
    }
    if (live.count < claims.rating.count) {
      return { ok: false, reason: 'The review count changed' };
    }
  }

  if (claims.reviewId && ctx.liveReviewIds && !ctx.liveReviewIds.has(claims.reviewId)) {
    return { ok: false, reason: 'That review can no longer be used' };
  }

  return CLAIMS_OK;
}

/** Claims that advertise specific nights must carry them. Guard against silent gaps. */
export function claimsAdvertiseAvailability(claims: PlannerClaims): boolean {
  return (claims.openNights?.length ?? 0) > 0;
}

/** Short machine hints used in plans and logs, never shown to a host. */
export function describeClaims(claims: PlannerClaims): string[] {
  const parts: string[] = [];
  if (claims.openNights?.length) parts.push(`open:${claims.openNights.join(',')}`);
  if (claims.nightsLeftInMonth != null) parts.push(`left:${claims.nightsLeftInMonth}`);
  if (claims.rateFrom != null) parts.push(`rate:${claims.rateFrom}`);
  if (claims.rating) parts.push(`rating:${claims.rating.avg}/${claims.rating.count}`);
  if (claims.reviewId) parts.push(`review:${claims.reviewId}`);
  if (claims.fullyBookedWindow) {
    parts.push(`full:${claims.fullyBookedWindow.from}..${claims.fullyBookedWindow.to}`);
  }
  return parts;
}
