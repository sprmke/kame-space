import { addDays, format, startOfWeek } from 'date-fns';

import type { PricingHolidayRuleDto } from '@/features/dashboard/pricing/lib/phHolidayRules';
import {
  propertyPricingDefaultsFromDto,
  resolveNightlyRateForDate,
  type PropertyPricingDefaults,
} from '@/features/dashboard/pricing/lib/pricingCompute';
import type { PropertyPricingDto } from '@/features/dashboard/pricing/lib/propertyPricingApi';

import { isoFromManilaParts } from '@/lib/date/manilaPeriod';

export type DashboardRateNightStatus = 'open' | 'booked' | 'blocked';

export type DashboardRateNight = {
  dateKey: string;
  weekdayShort: string;
  dayNum: number;
  /** e.g. Nov 24 */
  dayLabel: string;
  status: DashboardRateNightStatus;
  /** Live rate guests would see (overrides + smart + holiday). */
  rate: number | null;
  /** Weekday/weekend/holiday base with that night's override removed (no smart). */
  baseRate: number | null;
  /** Applied smart recommendation when it differs from base. */
  smartRate: number | null;
};

export type DashboardOpenNightBucket = {
  id: string;
  label: string;
  nights: DashboardRateNight[];
};

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const DASHBOARD_OPEN_HORIZON_DAYS = 60;
export const DASHBOARD_OPEN_NIGHT_LIMIT = 6;

function parseIsoLocal(dateKey: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function addDaysIso(dateKey: string, days: number): string | null {
  const date = parseIsoLocal(dateKey);
  if (!date) return null;
  date.setDate(date.getDate() + days);
  return isoFromManilaParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** Month keys (YYYY-MM) covering startIso for `count` nights. */
export function dashboardRatesMonthKeys(startIso: string, count: number): string[] {
  const keys = new Set<string>();
  for (let i = 0; i < count; i += 1) {
    const day = addDaysIso(startIso, i);
    if (!day) continue;
    keys.add(day.slice(0, 7));
  }
  return [...keys];
}

export function mergePropertyPricingSlices(
  slices: Array<PropertyPricingDto | undefined>
): {
  defaults: PropertyPricingDefaults;
  dateOverrides: Record<string, number>;
  holidayRules: PricingHolidayRuleDto[];
  smartRecommendations: Record<string, number>;
  smartPricingEnabled: boolean;
  bookedDateKeys: Set<string>;
  blockedDateKeys: Set<string>;
} {
  const dateOverrides: Record<string, number> = {};
  const smartRecommendations: Record<string, number> = {};
  const bookedDateKeys = new Set<string>();
  const blockedDateKeys = new Set<string>();
  let defaults = propertyPricingDefaultsFromDto(undefined);
  let holidayRules: PricingHolidayRuleDto[] = [];
  let smartPricingEnabled = false;

  for (const slice of slices) {
    if (!slice) continue;
    defaults = propertyPricingDefaultsFromDto(slice);
    holidayRules = slice.holidayRules ?? holidayRules;
    smartPricingEnabled = Boolean(slice.smartPricingEnabled) || smartPricingEnabled;
    Object.assign(dateOverrides, slice.dateOverrides ?? {});
    Object.assign(smartRecommendations, slice.smartRecommendations ?? {});
    for (const key of slice.bookedDateKeys ?? []) bookedDateKeys.add(key);
    for (const key of slice.blockedDateKeys ?? []) blockedDateKeys.add(key);
  }

  return {
    defaults,
    dateOverrides,
    holidayRules,
    smartRecommendations,
    smartPricingEnabled,
    bookedDateKeys,
    blockedDateKeys,
  };
}

function baseRateForDateKey(
  date: Date,
  dateKey: string,
  defaults: PropertyPricingDefaults,
  dateOverrides: Record<string, number>,
  holidayRules: PricingHolidayRuleDto[] | null | undefined
): number {
  const overridesWithout = { ...dateOverrides };
  delete overridesWithout[dateKey];
  return resolveNightlyRateForDate(date, defaults, {
    dateOverrides: overridesWithout,
    holidayRules,
  });
}

/** Walk the horizon and keep the first N open nights (skip booked/blocked). */
export function buildOpenRateHorizon(input: {
  startIso: string;
  horizonDays?: number;
  limit?: number;
  defaults: PropertyPricingDefaults;
  dateOverrides?: Record<string, number>;
  holidayRules?: PricingHolidayRuleDto[] | null;
  smartRecommendations?: Record<string, number> | null;
  smartPricingEnabled?: boolean;
  bookedDateKeys?: Iterable<string>;
  blockedDateKeys?: Iterable<string>;
}): DashboardRateNight[] {
  const horizonDays = input.horizonDays ?? DASHBOARD_OPEN_HORIZON_DAYS;
  const limit = input.limit ?? DASHBOARD_OPEN_NIGHT_LIMIT;
  const booked = new Set(input.bookedDateKeys ?? []);
  const blocked = new Set(input.blockedDateKeys ?? []);
  const overrides = input.dateOverrides ?? {};
  const smart = input.smartRecommendations ?? {};
  const nights: DashboardRateNight[] = [];

  for (let i = 0; i < horizonDays && nights.length < limit; i += 1) {
    const dateKeyStr = addDaysIso(input.startIso, i);
    if (!dateKeyStr) continue;
    if (booked.has(dateKeyStr) || blocked.has(dateKeyStr)) continue;

    const date = parseIsoLocal(dateKeyStr);
    if (!date) continue;

    const baseRate = baseRateForDateKey(
      date,
      dateKeyStr,
      input.defaults,
      overrides,
      input.holidayRules
    );
    const liveRate = resolveNightlyRateForDate(date, input.defaults, {
      dateOverrides: overrides,
      holidayRules: input.holidayRules,
      smartRecommendations: input.smartPricingEnabled ? smart : null,
    });
    const smartRaw = input.smartPricingEnabled ? smart[dateKeyStr] : undefined;
    const smartRate =
      smartRaw != null && Number.isFinite(smartRaw) && smartRaw !== baseRate ? smartRaw : null;

    nights.push({
      dateKey: dateKeyStr,
      weekdayShort: WEEKDAY_SHORT[date.getDay()] ?? '',
      dayNum: date.getDate(),
      dayLabel: format(date, 'MMM d'),
      status: 'open',
      rate: liveRate,
      baseRate,
      smartRate,
    });
  }

  return nights;
}

/** Group open nights into This week / Next week / Later (Sun-start weeks). */
export function groupOpenNightsByWeek(
  nights: DashboardRateNight[],
  todayIso: string
): DashboardOpenNightBucket[] {
  const today = parseIsoLocal(todayIso);
  if (!today || nights.length === 0) return [];

  const thisWeekStart = startOfWeek(today, { weekStartsOn: 0 });
  const nextWeekStart = addDays(thisWeekStart, 7);
  const laterStart = addDays(thisWeekStart, 14);

  const buckets: DashboardOpenNightBucket[] = [
    { id: 'this-week', label: 'This week', nights: [] },
    { id: 'next-week', label: 'Next week', nights: [] },
    { id: 'later', label: 'Later', nights: [] },
  ];

  for (const night of nights) {
    const date = parseIsoLocal(night.dateKey);
    if (!date) continue;
    if (date < nextWeekStart) buckets[0]!.nights.push(night);
    else if (date < laterStart) buckets[1]!.nights.push(night);
    else buckets[2]!.nights.push(night);
  }

  return buckets.filter((bucket) => bucket.nights.length > 0);
}

export function parseRateNightDates(dateKeys: string[]): Date[] {
  return dateKeys
    .map((key) => parseIsoLocal(key))
    .filter((date): date is Date => date != null)
    .sort((a, b) => a.getTime() - b.getTime());
}
