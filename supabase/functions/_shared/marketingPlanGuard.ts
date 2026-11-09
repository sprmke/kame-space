/**
 * Marketing Planner copy guard — deterministic grounding check for AI-written words.
 *
 * The model may choose phrasing, order and one call to action. It may not introduce a
 * number, a date or a month that the item's claims do not already support. Anything
 * flagged drops that item back to rules copy; the plan is never blocked.
 *
 * Pure: no clock, no DB, no network.
 */

import type { PlannerClaims } from './marketingClaims.ts';

export type GuardFacts = {
  propertyName?: string;
  amenities?: readonly string[];
};

export type GuardViolation = {
  kind: 'number' | 'month' | 'empty';
  value: string;
  reason: string;
};

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

const MONTH_ABBREVIATIONS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function monthIndexOf(ymd: string): number {
  return Number(ymd.slice(5, 7));
}

/** Numbers the claims already justify. Everything else is an invention. */
export function allowedNumbers(claims: PlannerClaims): Set<number> {
  const allowed = new Set<number>();
  const open = claims.openNights ?? [];
  allowed.add(open.length);
  if (open.length === 1) allowed.add(1);

  if (claims.nightsLeftInMonth != null) {
    allowed.add(claims.nightsLeftInMonth);
    allowed.add(1);
  }
  if (claims.rateFrom != null) {
    allowed.add(Math.round(claims.rateFrom));
    allowed.add(Math.round(claims.rateFrom / 1000));
    allowed.add(Math.round(claims.rateFrom / 100) / 10);
  }
  if (claims.rating) {
    allowed.add(Math.round(claims.rating.count));
    allowed.add(Math.round(claims.rating.avg * 10));
    allowed.add(Math.round(claims.rating.avg));
    allowed.add(Math.floor(claims.rating.avg));
    allowed.add(5);
    allowed.add(10);
  }
  if (claims.fullyBookedWindow) {
    allowed.add(Number(claims.fullyBookedWindow.from.slice(0, 4)));
  }
  for (const night of open) allowed.add(Number(night.slice(8, 10)));
  // A year the copy might legitimately print.
  for (const night of open) allowed.add(Number(night.slice(0, 4)));
  return allowed;
}

/** Months the claims already justify, as 1 to 12. */
export function allowedMonths(claims: PlannerClaims): Set<number> {
  const months = new Set<number>();
  for (const night of claims.openNights ?? []) months.add(monthIndexOf(night));
  if (claims.fullyBookedWindow) {
    months.add(Number(claims.fullyBookedWindow.from.slice(5, 7)));
  }
  return months;
}

function numbersIn(text: string): string[] {
  return text.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
}

function normaliseNumber(raw: string): number {
  return Math.round(Number(raw.replace(/,/g, '')));
}

function monthsIn(text: string): { month: number; label: string }[] {
  const lower = text.toLowerCase();
  const found: { month: number; label: string }[] = [];
  for (let index = 0; index < MONTHS.length; index += 1) {
    if (lower.includes(MONTHS[index])) found.push({ month: index + 1, label: MONTHS[index] });
  }
  for (const [label, month] of Object.entries(MONTH_ABBREVIATIONS)) {
    const re = new RegExp(`\\b${label}\\.?\\b`, 'i');
    if (re.test(text)) found.push({ month, label });
  }
  return found;
}

/**
 * Check one piece of copy. Empty copy is a violation too: a blank hook is worse than
 * the rules template it replaced.
 */
export function guardPlanCopy(text: string, claims: PlannerClaims): GuardViolation[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [{ kind: 'empty', value: '', reason: 'empty copy' }];
  }

  const violations: GuardViolation[] = [];
  const allowed = allowedNumbers(claims);
  for (const raw of numbersIn(trimmed)) {
    const value = normaliseNumber(raw);
    if (!Number.isFinite(value)) continue;
    if (allowed.has(value)) continue;
    violations.push({ kind: 'number', value: raw, reason: 'number is not in the claims' });
  }

  const allowedMonthSet = allowedMonths(claims);
  for (const { month, label } of monthsIn(trimmed)) {
    if (allowedMonthSet.has(month)) continue;
    violations.push({ kind: 'month', value: label, reason: 'month is not in the claims' });
  }

  return violations;
}

export type GuardedItemCopy = {
  itemKey: string;
  title?: string;
  hook?: string;
  message?: string;
  cta?: string;
};

export type GuardResult = {
  accepted: GuardedItemCopy[];
  rejected: Array<{ itemKey: string; violations: GuardViolation[] }>;
};

/**
 * Check a batch of per-item copy. Item keys that are not in `claimsByKey` are rejected
 * rather than trusted: the model may drop or merge items, never invent one.
 */
export function guardPlanBriefs(
  copies: readonly GuardedItemCopy[],
  claimsByKey: ReadonlyMap<string, PlannerClaims>
): GuardResult {
  const accepted: GuardedItemCopy[] = [];
  const rejected: Array<{ itemKey: string; violations: GuardViolation[] }> = [];

  for (const copy of copies) {
    const claims = claimsByKey.get(copy.itemKey);
    if (!claims) {
      rejected.push({
        itemKey: copy.itemKey,
        violations: [{ kind: 'empty', value: copy.itemKey, reason: 'unknown item key' }],
      });
      continue;
    }
    const violations = [
      ...guardPlanCopy(copy.title ?? '', claims),
      ...guardPlanCopy(copy.hook ?? '', claims),
      ...guardPlanCopy(copy.message ?? '', claims),
      ...guardPlanCopy(copy.cta ?? '', claims),
    ];
    if (violations.length > 0) {
      rejected.push({ itemKey: copy.itemKey, violations });
      continue;
    }
    accepted.push(copy);
  }

  return { accepted, rejected };
}
