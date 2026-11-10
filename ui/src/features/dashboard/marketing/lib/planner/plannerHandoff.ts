/**
 * Which editor a planner item opens, and the payload it carries.
 *
 * The scheduler decides the format; this table decides where the host finishes the work.
 * Editors consume the payload through `plannerHandoff`'s one-shot store, the same pattern as
 * the review and photo handoffs, so nothing ends up in the URL.
 */

export type PlannerEditorTab = 'design' | 'video' | 'calendar' | 'generate';

export type PlannerHandoffTarget = {
  tab: PlannerEditorTab;
  /** AI Studio output type, when the item is best finished there. */
  output?: 'post' | 'image' | 'video';
};

export type PlannerHandoffPayload = {
  itemId: string;
  title: string;
  hook: string;
  message: string;
  cta: string;
  /** Promoted nights, YYYY-MM-DD. */
  dates: string[];
  trackedUrl: string | null;
  photoIds: string[];
  /** Quoted nightly rate, when the item claims one. */
  rateFrom?: number | null;
};

/** Format first, then the opportunity type as a tie-break. */
export function resolveHandoffTarget(
  format: string,
  opportunityType: string | null
): PlannerHandoffTarget {
  if (format === 'calendar') return { tab: 'calendar' };
  if (format === 'reel') return { tab: 'video' };
  if (format === 'story' || format === 'carousel' || format === 'post') {
    if (isAiFirst(opportunityType)) return { tab: 'generate', output: 'post' };
    return { tab: 'design' };
  }
  return { tab: 'design' };
}

/** Types that read better as a generated image than as a hand-built design. */
function isAiFirst(opportunityType: string | null): boolean {
  return (
    opportunityType === 'amenity_spotlight' ||
    opportunityType === 'seasonal_moment' ||
    opportunityType === 'audience_fit' ||
    opportunityType === 'content_refresh' ||
    opportunityType === 'cadence_gap'
  );
}

let pending: PlannerHandoffPayload | null = null;

export function setPendingPlannerDraft(payload: PlannerHandoffPayload | null): void {
  pending = payload;
}

/** Consumed once by the next editor that mounts. */
export function takePendingPlannerDraft(): PlannerHandoffPayload | null {
  const value = pending;
  pending = null;
  return value;
}

/** One-line description an AI Studio draft can start from. */
export function handoffDescription(payload: PlannerHandoffPayload): string {
  return [payload.hook, payload.message, payload.cta].filter(Boolean).join(' ');
}

export type PlannerDesignSeed = {
  propertyName: string;
  propertyPhoto: string | null;
  propertyMedia?: Array<{ url: string; type: 'image' | 'video' }>;
  nightlyRate: string;
  availabilityText: string;
  monthLabel: string;
  monthShort: string;
  openSlots: Array<{ dateNum: string; dayName: string }>;
};

function monthName(ymd: string): string {
  const [year, month] = ymd.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString('en-US', { month: 'long' });
}

function dayLabel(ymd: string): { dateNum: string; dayName: string } {
  const [year, month, day] = ymd.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return {
    dateNum: String(day),
    dayName: date
      .toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
      .toUpperCase(),
  };
}

/**
 * Merge a planner item onto a design binding: only the fields the plan is authoritative for
 * (dates, month, rate). Property facts and photos stay as the binding resolved them.
 */
export function applyPlannerSeedToDesignBinding<T extends PlannerDesignSeed>(
  binding: T,
  seed: PlannerHandoffPayload | null | undefined
): T {
  if (!seed || seed.dates.length === 0) return binding;
  const first = seed.dates[0];
  const month = monthName(first);
  const merged: T = {
    ...binding,
    availabilityText:
      seed.dates.length === 1 ? '1 night available' : `${seed.dates.length} nights available`,
    monthLabel: `${month} ${first.slice(0, 4)}`,
    monthShort: month,
    openSlots: seed.dates.slice(0, 5).map(dayLabel),
  };
  if (seed.rateFrom != null && seed.rateFrom > 0) {
    merged.nightlyRate = `₱${seed.rateFrom.toLocaleString('en-PH')} / night`;
  }
  return merged;
}
