/**
 * Marketing Planner signals — turn data the app already holds into ranked
 * opportunities. Pure: no clock, no DB, no network.
 *
 * The engine decides which dates and slots to promote. The AI (when enabled) only
 * writes words for these items; it can never add a date, a time or a channel.
 */

import { addDaysYmd, calendarDaysBetween } from './calendarAvailabilityManila.ts';
import type { PlannerClaims } from './marketingClaims.ts';
import { openNightsLeftInMonth } from './marketingClaims.ts';
import {
  DEFAULT_MEDIAN_LEAD_DAYS,
  MAX_ITEMS_PER_RUN,
  OPPORTUNITIES,
  type ForwardOccupancyState,
  type MarketingFormat,
  type MarketingOpportunityType,
  type Pillar,
} from './marketingPlaybook.ts';

export type PlannerCalendarEvent = {
  id: string;
  scope: 'platform' | 'property';
  kind: string;
  name: string;
  startsOn: string;
  endsOn: string;
  weight: number;
};

export type PlannerReviewCandidate = {
  id: string;
  rating: number;
  createdAt: string;
};

export type PlannerSignalsInput = {
  /** Manila today, YYYY-MM-DD. Computed once per run and passed down. */
  today: string;
  horizonEnd: string;
  blockedNights: ReadonlySet<string>;
  forwardOccupancyState: ForwardOccupancyState;
  medianLeadDays: number | null;
  /** 1 to 2 night gaps detected by the analytics bundle / Smart Pricing orphan logic. */
  gapNights: readonly string[];
  events: readonly PlannerCalendarEvent[];
  reviews: readonly PlannerReviewCandidate[];
  liveRateFrom: number | null;
  /** Rate before a live Smart Pricing drop, when one applied. */
  referenceRateFrom: number | null;
  /** ADR used to weigh nights at stake. */
  nightlyValue: number;
  goals: readonly string[];
  channels: readonly string[];
  lastFeedPostOn: string | null;
  lastReelOn: string | null;
  minStayNights: number;
  usedOpportunityKeys: ReadonlySet<string>;
  usedReviewIds: ReadonlySet<string>;
  usedAmenities: ReadonlySet<string>;
  amenities: readonly string[];
  topReviewTags: readonly string[];
  partySizePeak: number | null;
  photoCount: number;
  unusedPhotoCount: number;
  otaShareTop: number | null;
  /** Months (YYYY-MM) sold out inside the horizon. */
  monthsFullyBooked: readonly string[];
  reviewAvg: number | null;
  reviewCount: number | null;
};

export type PlannerOpportunity = {
  type: MarketingOpportunityType;
  /** Dedupe key. One live item per key per property. */
  key: string;
  pillar: Pillar;
  targetFrom: string | null;
  targetTo: string | null;
  postBy: string;
  nightsAtStake: number;
  claims: PlannerClaims;
  /** One plain line the host reads as "why this". */
  evidence: string;
  /** Event or amenity name when the copy needs it. */
  label?: string | null;
  formats: readonly MarketingFormat[];
  score: number;
};

const MAX_HORIZON_DAYS = 120;

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function dayOfWeek(ymd: string): number {
  const [year, month, day] = ymd.split('-').map(Number);
  // 0 = Sunday ... 6 = Saturday
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function maxYmd(a: string, b: string): string {
  return a > b ? a : b;
}

function minYmd(a: string, b: string): string {
  return a < b ? a : b;
}

function resolveLeadDays(medianLeadDays: number | null): number {
  return clampInt(Math.round(medianLeadDays ?? DEFAULT_MEDIAN_LEAD_DAYS), 2, 60);
}

function shortDate(ymd: string): string {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function listDatesHuman(ymds: readonly string[]): string {
  return ymds.map(shortDate).join(', ');
}

function nightsAtStake(nights: readonly string[], nightlyValue: number): number {
  return Math.round(nights.length * Math.max(0, nightlyValue));
}

function score(
  type: MarketingOpportunityType,
  postBy: string,
  today: string,
  value: number,
  fit: number
): number {
  const definition = OPPORTUNITIES[type];
  const daysUntil = Math.max(0, calendarDaysBetween(today, postBy));
  const urgency = 1 / (1 + daysUntil / Math.max(1, definition.urgencyHours / 24));
  const valueScore = Math.min(1, value / 20_000);
  const raw =
    urgency * 0.45 + valueScore * 0.25 + definition.valueWeight * 0.2 + fit * 0.1;
  return Math.round(raw * 1000) / 1000;
}

function goalFit(type: MarketingOpportunityType, goals: readonly string[]): number {
  const definition = OPPORTUNITIES[type];
  const wantsFill = goals.includes('fill_open_nights') || goals.includes('weekends');
  const wantsDirect = goals.includes('direct_bookings');
  const wantsLonger = goals.includes('longer_stays');
  const wantsBrand = goals.includes('brand');

  if (definition.pillar === 'offers' && wantsFill) return 1;
  if (type === 'direct_booking_push' && wantsDirect) return 1;
  if ((type === 'amenity_spotlight' || type === 'content_refresh') && wantsLonger) return 1;
  if (
    (type === 'rating_milestone' || type === 'new_review' || type === 'fully_booked') &&
    wantsBrand
  ) return 1;
  return 0.6;
}

/** First Friday at or after `today`, within the horizon. */
function nextWeekendStart(today: string, horizonEnd: string): string | null {
  let cursor = today;
  for (let i = 0; i <= 14 && cursor <= horizonEnd; i += 1) {
    if (dayOfWeek(cursor) === 5) return cursor;
    cursor = addDaysYmd(cursor, 1);
  }
  return null;
}

function nightsBetween(fromYmd: string, toYmd: string): string[] {
  const out: string[] = [];
  let cursor = fromYmd;
  while (cursor < toYmd) {
    out.push(cursor);
    cursor = addDaysYmd(cursor, 1);
  }
  return out;
}

function pushOpportunity(
  list: PlannerOpportunity[],
  input: PlannerSignalsInput,
  opportunity: Omit<PlannerOpportunity, 'score'>
): void {
  if (input.usedOpportunityKeys.has(opportunity.key)) return;
  list.push({
    ...opportunity,
    score: score(
      opportunity.type,
      opportunity.postBy,
      input.today,
      opportunity.nightsAtStake,
      goalFit(opportunity.type, input.goals)
    ),
  });
}

/**
 * Build every opportunity the property qualifies for inside the horizon.
 * Ranking and scheduling happen in `marketingScheduler.ts`.
 */
export function buildOpportunities(input: PlannerSignalsInput): PlannerOpportunity[] {
  const out: PlannerOpportunity[] = [];
  const horizonDays = calendarDaysBetween(input.today, input.horizonEnd);
  const horizonEnd =
    horizonDays > MAX_HORIZON_DAYS ? addDaysYmd(input.today, MAX_HORIZON_DAYS) : input.horizonEnd;
  const lead = resolveLeadDays(input.medianLeadDays);
  const isOpen = (ymd: string) =>
    ymd >= input.today && ymd <= horizonEnd && !input.blockedNights.has(ymd);

  // 1. Tonight / tomorrow -----------------------------------------------------
  for (const candidate of [input.today, addDaysYmd(input.today, 1)]) {
    if (!isOpen(candidate)) continue;
    const nights = [candidate];
    const tomorrow = candidate !== input.today;
    pushOpportunity(out, input, {
      type: 'tonight_tomorrow',
      key: `tonight_tomorrow:${candidate}`,
      pillar: OPPORTUNITIES.tonight_tomorrow.pillar,
      targetFrom: candidate,
      targetTo: addDaysYmd(candidate, 1),
      postBy: candidate,
      nightsAtStake: nightsAtStake(nights, input.nightlyValue),
      claims: { openNights: nights },
      evidence: tomorrow
        ? `${shortDate(candidate)} is still open for a same day or next day booking.`
        : `Tonight is still open at ${shortDate(candidate)}.`,
      formats: OPPORTUNITIES.tonight_tomorrow.formats,
    });
  }

  // 2. Open weekend -----------------------------------------------------------
  const weekendStart = nextWeekendStart(input.today, horizonEnd);
  if (weekendStart) {
    const fri = weekendStart;
    const sat = addDaysYmd(fri, 1);
    const open = [fri, sat].filter(isOpen);
    if (open.length > 0) {
      pushOpportunity(out, input, {
        type: 'weekend_open',
        key: `weekend_open:${fri}`,
        pillar: OPPORTUNITIES.weekend_open.pillar,
        targetFrom: fri,
        targetTo: addDaysYmd(sat, 1),
        postBy: maxYmd(input.today, addDaysYmd(fri, -lead)),
        nightsAtStake: nightsAtStake(open, input.nightlyValue),
        claims: { openNights: open },
        evidence:
          open.length === 1
            ? `Only ${shortDate(open[0])} is left that weekend.`
            : `Both nights that weekend are open (${listDatesHuman(open)}).`,
        formats: OPPORTUNITIES.weekend_open.formats,
      });
    }
  }

  // 3. Gap nights -------------------------------------------------------------
  const gapRuns: string[][] = [];
  for (const night of [...input.gapNights].sort()) {
    if (night < input.today || night > horizonEnd || input.blockedNights.has(night)) continue;
    const last = gapRuns[gapRuns.length - 1];
    if (last && addDaysYmd(last[last.length - 1], 1) === night && last.length < 2) {
      last.push(night);
    } else {
      gapRuns.push([night]);
    }
  }
  for (const run of gapRuns) {
    pushOpportunity(out, input, {
      type: 'gap_nights',
      key: `gap_nights:${run[0]}`,
      pillar: OPPORTUNITIES.gap_nights.pillar,
      targetFrom: run[0],
      targetTo: addDaysYmd(run[run.length - 1], 1),
      postBy: maxYmd(input.today, addDaysYmd(run[0], -Math.min(lead, 7))),
      nightsAtStake: nightsAtStake(run, input.nightlyValue),
      claims: { openNights: run },
      evidence: `${run.length === 1 ? 'A single night' : 'Two nights'} opens up on ${listDatesHuman(run)}.`,
      formats: OPPORTUNITIES.gap_nights.formats,
    });
  }

  // 4. Last slots this month --------------------------------------------------
  const openLeft = openNightsLeftInMonth(input.today, input.blockedNights);
  if (openLeft > 0 && openLeft <= 5) {
    const month = input.today.slice(0, 7);
    const [year, monthIndex] = [Number(month.slice(0, 4)), Number(month.slice(5, 7))];
    const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(
      new Date(Date.UTC(year, monthIndex - 1, 15))
    );
    const openDates: string[] = [];
    const daysInMonth = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      const ymd = `${month}-${String(day).padStart(2, '0')}`;
      if (ymd >= input.today && !input.blockedNights.has(ymd)) openDates.push(ymd);
    }
    pushOpportunity(out, input, {
      type: 'last_slots_month',
      key: `last_slots_month:${month}`,
      pillar: OPPORTUNITIES.last_slots_month.pillar,
      targetFrom: openDates[0] ?? null,
      targetTo: openDates.length ? addDaysYmd(openDates[openDates.length - 1], 1) : null,
      postBy: input.today,
      nightsAtStake: nightsAtStake(openDates, input.nightlyValue),
      claims: { openNights: openDates, nightsLeftInMonth: openLeft },
      evidence: `${openLeft} ${openLeft === 1 ? 'date is' : 'dates are'} left in ${monthLabel}.`,
      formats: OPPORTUNITIES.last_slots_month.formats,
    });
  }

  // 5 and 6. Long weekends and seasonal moments -------------------------------
  for (const event of input.events) {
    const startsOn = event.startsOn < input.today ? input.today : event.startsOn;
    if (startsOn > horizonEnd) continue;
    const windowEnd = minYmd(addDaysYmd(event.endsOn, 1), addDaysYmd(horizonEnd, 1));
    const open = nightsBetween(startsOn, windowEnd).filter(isOpen);
    if (open.length === 0) continue;

    if (event.kind === 'regular_holiday' || event.kind === 'special_non_working') {
      pushOpportunity(out, input, {
        type: 'long_weekend',
        key: `long_weekend:${event.id}`,
        pillar: OPPORTUNITIES.long_weekend.pillar,
        targetFrom: open[0],
        targetTo: addDaysYmd(open[open.length - 1], 1),
        postBy: maxYmd(input.today, addDaysYmd(startsOn, -Math.min(21, lead + 7))),
        nightsAtStake: nightsAtStake(open, input.nightlyValue),
        claims: { openNights: open },
        evidence: `${event.name} on ${shortDate(startsOn)} and the nights around it are still open.`,
        label: event.name,
        formats: OPPORTUNITIES.long_weekend.formats,
      });
      continue;
    }

    if (
      event.kind === 'season' ||
      event.kind === 'commercial' ||
      event.kind === 'school_break' ||
      event.kind === 'local_event'
    ) {
      const isLocal = event.kind === 'local_event';
      pushOpportunity(out, input, {
        type: isLocal ? 'local_event' : 'seasonal_moment',
        key: `${isLocal ? 'local_event' : 'seasonal_moment'}:${event.id}`,
        pillar: isLocal ? OPPORTUNITIES.local_event.pillar : OPPORTUNITIES.seasonal_moment.pillar,
        targetFrom: open[0],
        targetTo: addDaysYmd(open[open.length - 1], 1),
        postBy: maxYmd(input.today, addDaysYmd(startsOn, -Math.min(21, lead + 7))),
        nightsAtStake: nightsAtStake(open, input.nightlyValue),
        claims: { openNights: open },
        evidence: `${event.name} starts ${shortDate(startsOn)} and you still have open nights.`,
        label: event.name,
        formats: isLocal ? OPPORTUNITIES.local_event.formats : OPPORTUNITIES.seasonal_moment.formats,
      });
    }
  }

  // 7. live rate drop (never from a recommendation alone) ---------------------
  if (
    input.liveRateFrom != null &&
    input.referenceRateFrom != null &&
    input.liveRateFrom > 0 &&
    input.liveRateFrom <= input.referenceRateFrom * 0.92
  ) {
    const nights: string[] = [];
    const windowDays = Math.min(7, Math.max(1, horizonDays));
    for (let index = 0; index < windowDays; index += 1) {
      const ymd = addDaysYmd(input.today, index);
      if (isOpen(ymd)) nights.push(ymd);
    }
    if (nights.length > 0) {
      pushOpportunity(out, input, {
        type: 'rate_live_drop',
        key: `rate_live_drop:${input.today}`,
        pillar: OPPORTUNITIES.rate_live_drop.pillar,
        targetFrom: nights[0],
        targetTo: addDaysYmd(nights[nights.length - 1], 1),
        postBy: input.today,
        nightsAtStake: nightsAtStake(nights, input.nightlyValue),
        claims: { openNights: nights, rateFrom: Math.round(input.liveRateFrom) },
        evidence: `Smart Pricing lowered the rate to ${Math.round(input.liveRateFrom)} a night.`,
        formats: OPPORTUNITIES.rate_live_drop.formats,
      });
    }
  }

  // 8. Fully booked months ----------------------------------------------------
  for (const month of input.monthsFullyBooked) {
    if (month < input.today.slice(0, 7)) continue;
    const [year, monthIndex] = [Number(month.slice(0, 4)), Number(month.slice(5, 7))];
    const daysInMonth = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
    const from = `${month}-01`;
    const to = `${month}-${String(daysInMonth).padStart(2, '0')}`;
    if (from > horizonEnd) continue;
    pushOpportunity(out, input, {
      type: 'fully_booked',
      key: `fully_booked:${month}`,
      pillar: OPPORTUNITIES.fully_booked.pillar,
      targetFrom: from,
      targetTo: to,
      postBy: minYmd(input.today, horizonEnd),
      nightsAtStake: 0,
      claims: { fullyBookedWindow: { from, to } },
      evidence: `${month} is sold out.`,
      formats: OPPORTUNITIES.fully_booked.formats,
    });
  }

  // 9. New reviews ------------------------------------------------------------
  for (const review of input.reviews) {
    if (review.rating < 4) continue;
    if (input.usedReviewIds.has(review.id)) continue;
    const age = calendarDaysBetween(review.createdAt.slice(0, 10), input.today);
    if (age > 7) continue;
    pushOpportunity(out, input, {
      type: 'new_review',
      key: `new_review:${review.id}`,
      pillar: OPPORTUNITIES.new_review.pillar,
      targetFrom: null,
      targetTo: null,
      postBy: minYmd(addDaysYmd(input.today, 2), horizonEnd),
      nightsAtStake: 0,
      claims: { reviewId: review.id },
      evidence: `A guest rated the stay ${review.rating} out of 5.`,
      formats: OPPORTUNITIES.new_review.formats,
    });
  }

  // 10. Rating milestone ------------------------------------------------------
  if (
    input.reviewAvg != null &&
    input.reviewCount != null &&
    input.reviewAvg >= 4.8 &&
    input.reviewCount >= 10 &&
    input.reviewCount % 10 === 0
  ) {
    pushOpportunity(out, input, {
      type: 'rating_milestone',
      key: `rating_milestone:${input.reviewCount}`,
      pillar: OPPORTUNITIES.rating_milestone.pillar,
      targetFrom: null,
      targetTo: null,
      postBy: minYmd(addDaysYmd(input.today, 3), horizonEnd),
      nightsAtStake: 0,
      claims: {
        rating: { avg: Math.round(input.reviewAvg * 10) / 10, count: input.reviewCount },
      },
      evidence: `${input.reviewCount} guests average ${input.reviewAvg.toFixed(1)} stars.`,
      formats: OPPORTUNITIES.rating_milestone.formats,
    });
  }

  // 11. Amenity spotlight -----------------------------------------------------
  const topTag = input.topReviewTags.find(
    (tag) => !input.usedAmenities.has(tag) && input.amenities.some((a) => a.includes(tag))
  );
  const amenity =
    topTag ?? input.amenities.find((item) => !input.usedAmenities.has(item)) ?? null;
  if (amenity) {
    pushOpportunity(out, input, {
      type: 'amenity_spotlight',
      key: `amenity_spotlight:${amenity}`,
      pillar: OPPORTUNITIES.amenity_spotlight.pillar,
      targetFrom: null,
      targetTo: null,
      postBy: minYmd(addDaysYmd(input.today, 4), horizonEnd),
      nightsAtStake: 0,
      claims: {},
      evidence: `Guests keep mentioning ${amenity}.`,
      label: amenity,
      formats: OPPORTUNITIES.amenity_spotlight.formats,
    });
  }

  // 12. Audience fit ----------------------------------------------------------
  if (input.partySizePeak != null && input.partySizePeak >= 5) {
    pushOpportunity(out, input, {
      type: 'audience_fit',
      key: `audience_fit:groups:${input.today.slice(0, 7)}`,
      pillar: OPPORTUNITIES.audience_fit.pillar,
      targetFrom: null,
      targetTo: null,
      postBy: minYmd(addDaysYmd(input.today, 5), horizonEnd),
      nightsAtStake: 0,
      claims: {},
      evidence: `Most of your bookings are groups of ${input.partySizePeak} or more.`,
      formats: OPPORTUNITIES.audience_fit.formats,
    });
  }

  // 13. Direct booking push ---------------------------------------------------
  const wantsDirect = input.goals.includes('direct_bookings');
  if (wantsDirect || (input.otaShareTop != null && input.otaShareTop >= 0.7)) {
    pushOpportunity(out, input, {
      type: 'direct_booking_push',
      key: `direct_booking_push:${input.today.slice(0, 7)}`,
      pillar: OPPORTUNITIES.direct_booking_push.pillar,
      targetFrom: null,
      targetTo: null,
      postBy: minYmd(addDaysYmd(input.today, 3), horizonEnd),
      nightsAtStake: 0,
      claims: {},
      evidence:
        input.otaShareTop != null && input.otaShareTop >= 0.7
          ? `${Math.round(input.otaShareTop * 100)}% of bookings come from one OTA.`
          : 'You asked for more direct bookings.',
      formats: OPPORTUNITIES.direct_booking_push.formats,
    });
  }

  // 14. Content refresh -------------------------------------------------------
  if (input.photoCount > 0 && input.unusedPhotoCount > 0) {
    pushOpportunity(out, input, {
      type: 'content_refresh',
      key: `content_refresh:${input.today.slice(0, 7)}`,
      pillar: OPPORTUNITIES.content_refresh.pillar,
      targetFrom: null,
      targetTo: null,
      postBy: minYmd(addDaysYmd(input.today, 6), horizonEnd),
      nightsAtStake: 0,
      claims: {},
      evidence: `${input.unusedPhotoCount} of your photos have never been posted.`,
      formats: OPPORTUNITIES.content_refresh.formats,
    });
  }

  // 15. Cadence gap -----------------------------------------------------------
  const feedAge = input.lastFeedPostOn
    ? calendarDaysBetween(input.lastFeedPostOn, input.today)
    : Number.POSITIVE_INFINITY;
  const reelAge = input.lastReelOn
    ? calendarDaysBetween(input.lastReelOn, input.today)
    : Number.POSITIVE_INFINITY;
  if (feedAge >= 5 || reelAge >= 10) {
    pushOpportunity(out, input, {
      type: 'cadence_gap',
      key: `cadence_gap:${input.today}`,
      pillar: OPPORTUNITIES.cadence_gap.pillar,
      targetFrom: null,
      targetTo: null,
      postBy: minYmd(addDaysYmd(input.today, 2), horizonEnd),
      nightsAtStake: 0,
      claims: {},
      evidence:
        reelAge >= 10
          ? 'You have not posted a reel in over a week.'
          : 'You have not posted in five days.',
      formats: OPPORTUNITIES.cadence_gap.formats,
    });
  }

  // 16. Payday weekend (low weight hypothesis) --------------------------------
  const payday = paydayWeekendStart(input.today, horizonEnd);
  if (payday) {
    const open = nightsBetween(payday, addDaysYmd(payday, 2)).filter(isOpen);
    if (open.length > 0) {
      pushOpportunity(out, input, {
        type: 'payday_weekend',
        key: `payday_weekend:${payday}`,
        pillar: OPPORTUNITIES.payday_weekend.pillar,
        targetFrom: open[0],
        targetTo: addDaysYmd(open[open.length - 1], 1),
        postBy: maxYmd(input.today, addDaysYmd(payday, -3)),
        nightsAtStake: nightsAtStake(open, input.nightlyValue),
        claims: { openNights: open },
        evidence: `Payday weekend on ${shortDate(payday)} still has open nights.`,
        formats: OPPORTUNITIES.payday_weekend.formats,
      });
    }
  }

  return out
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ITEMS_PER_RUN);
}

/** Saturday after the 15th or after the last day of the month, when it is near. */
function paydayWeekendStart(today: string, horizonEnd: string): string | null {
  for (let offset = 0; offset <= 7; offset += 1) {
    const ymd = addDaysYmd(today, offset);
    if (ymd > horizonEnd) return null;
    const day = Number(ymd.slice(8, 10));
    if (dayOfWeek(ymd) !== 6) continue;
    const [year, month] = [Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7))];
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const previousDays = [15, daysInMonth];
    const hit = previousDays.some((payday) => day - payday >= 0 && day - payday <= 5);
    if (hit) return ymd;
  }
  return null;
}
