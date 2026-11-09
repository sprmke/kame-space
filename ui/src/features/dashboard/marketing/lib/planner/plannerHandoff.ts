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
  output?: 'post' | 'image' | 'clip';
};

export type PlannerHandoffPayload = {
  itemId: string;
  title: string;
  hook: string;
  message: string;
  cta: string;
  dates: string[];
  trackedUrl: string | null;
  photoIds: string[];
};

/** Format first, then the opportunity type as a tie-break. */
export function resolveHandoffTarget(
  format: string,
  opportunityType: string | null
): PlannerHandoffTarget {
  if (format === 'calendar') return { tab: 'calendar' };
  if (format === 'reel') return { tab: 'video', output: 'clip' };
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
