/**
 * Freed dates — a cancellation opens nights, which is the most time-sensitive marketing
 * opportunity the planner has. Runs from the workflow orchestrator's cancellation branch, so
 * every cancel path (dashboard, guest, cron, OTA) is covered once.
 *
 * Never throws: a planner write must not fail a cancellation.
 */

import { addDaysYmd, calendarDaysBetween, manilaTodayYmd } from './calendarAvailabilityManila.ts';
import { buildActorContext, logActivity, type ActorContext } from './activityLog.ts';
import { buildTrackedPath, campaignCode, formatShortCode } from './marketingTrackedLinks.ts';
import { fillTemplate, resolveCopyTemplate } from './marketingCopyLibrary.ts';
import { createOrCoalesceNotification } from './notificationService.ts';
import { createServiceClient } from './orgAuth.ts';
import { isFeatureEnabled } from './planFeatures.ts';
import { resolvePropertyEntitlements } from './planEntitlements.ts';
import { resolvePropertySlugById } from './propertyScope.ts';

/** How far ahead a freed date is worth promoting. */
export const FREED_DATES_HORIZON_DAYS = 30;

/**
 * Nights a cancellation frees, clamped to the promoted window. Half-open, matching the
 * calendar model: check-in inclusive, check-out exclusive.
 */
export function freedNightsInWindow(input: {
  checkInYmd: string;
  checkOutYmd: string;
  todayYmd: string;
  horizonDays?: number;
}): string[] {
  const horizonEnd = addDaysYmd(
    input.todayYmd,
    input.horizonDays ?? FREED_DATES_HORIZON_DAYS
  );
  const nights: string[] = [];
  let cursor = input.checkInYmd;
  while (cursor < input.checkOutYmd) {
    if (cursor >= input.todayYmd && cursor <= horizonEnd) nights.push(cursor);
    cursor = addDaysYmd(cursor, 1);
  }
  return nights;
}

/** Manila minutes from midnight. */
export function manilaMinuteOfDay(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

/**
 * Next slot a freed-date post can go out: 09:00 today if that has not passed, otherwise
 * 19:00 today, otherwise 09:00 tomorrow.
 */
export function nextFreedDatesSlot(now: Date = new Date()): string {
  // Derive the date from `now` so the slot is deterministic for a given clock.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(now);
  const minute = manilaMinuteOfDay(now);
  if (minute < 9 * 60) return `${today}T09:00:00+08:00`;
  if (minute < 19 * 60) return `${today}T19:00:00+08:00`;
  return `${addDaysYmd(today, 1)}T09:00:00+08:00`;
}

function formatNights(nights: readonly string[]): string {
  return nights
    .map((ymd) => {
      const [year, month, day] = ymd.split('-').map(Number);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(Date.UTC(year, month - 1, day)));
    })
    .join(', ');
}

export type FreedDatesResult = 'created' | 'skipped' | 'not_entitled' | 'failed';

/**
 * Create one `freed_dates` item and its urgent notification. Idempotent per check-in date:
 * the partial unique index on `(property_id, opportunity_key)` rejects a duplicate.
 */
export async function maybeCreateFreedDatesOpportunity(input: {
  organizationId: string;
  propertyId: string;
  checkInYmd: string;
  checkOutYmd: string;
  /** Optional: falls back to a system actor when the caller has none. */
  actor?: ActorContext | null;
  now?: Date;
}): Promise<FreedDatesResult> {
  const actor = input.actor ?? buildActorContext('cron', { cron: 'workflow-orchestrator' });
  try {
    const today = manilaTodayYmd();
    const nights = freedNightsInWindow({
      checkInYmd: input.checkInYmd,
      checkOutYmd: input.checkOutYmd,
      todayYmd: today,
    });
    if (nights.length === 0) return 'skipped';

    const entitlements = await resolvePropertyEntitlements(input.propertyId);
    if (!isFeatureEnabled(entitlements, 'marketingPlanner')) return 'not_entitled';

    const supabase = createServiceClient();
    const { data: settings } = await supabase
      .from('marketing_planner_settings')
      .select('property_id, language')
      .eq('property_id', input.propertyId)
      .maybeSingle();

    const language =
      settings?.language === 'fil' || settings?.language === 'taglish'
        ? (settings.language as 'fil' | 'taglish')
        : 'en';

    const shortCode = formatShortCode(crypto.getRandomValues(new Uint8Array(12)));
    const propertySlug = await resolvePropertySlugById(input.propertyId).catch(() => null);
    const copy = fillTemplate(resolveCopyTemplate('freed_dates', language), {
      dates: formatNights(nights),
    });

    const { data: inserted, error } = await supabase
      .from('marketing_plan_items')
      .insert({
        short_code: shortCode,
        property_id: input.propertyId,
        organization_id: input.organizationId,
        plan_id: null,
        source: 'event',
        opportunity_type: 'freed_dates',
        opportunity_key: `freed_dates:${input.checkInYmd}`,
        title: copy.title,
        pillar: 'offers',
        channel_kind: 'facebook_page',
        manual_targets: [],
        format: 'story',
        scheduled_for: nextFreedDatesSlot(input.now ?? new Date()),
        post_by: `${today}T23:59:59+08:00`,
        target_from: nights[0],
        target_to: addDaysYmd(nights[nights.length - 1], 1),
        claims: { openNights: nights },
        brief: { hook: copy.hook, message: copy.message, cta: copy.cta, why: 'A cancellation just opened these nights.' },
        status: 'planned',
        tracked_url: propertySlug
          ? buildTrackedPath(`/properties/${propertySlug}`, {
              channel: 'facebook_page',
              shortCode,
            })
          : null,
        created_by: actor.userId ?? null,
      })
      .select('id')
      .maybeSingle();

    if (error) {
      // 23505 = the same check-in date is already promoted; nothing to do.
      if ((error as { code?: string }).code === '23505') return 'skipped';
      console.error('[marketingFreedDates] insert failed:', error.message);
      return 'failed';
    }

    const itemId = inserted?.id ? String(inserted.id) : null;

    await createOrCoalesceNotification({
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      type: 'marketing_opportunity_urgent',
      title: 'Dates just opened',
      body: `${formatNights(nights)} just became free.`,
      dedupeKey: `marketing_opportunity_urgent:${input.checkInYmd}`,
      metadata: { planItemId: itemId, nights },
    });

    await logActivity({
      action: 'marketing.opportunity_created',
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      actor,
      targetId: itemId,
      metadata: { type: 'freed_dates', count: nights.length },
    });

    return 'created';
  } catch (error) {
    console.error('[marketingFreedDates] skipped:', (error as Error).message);
    return 'failed';
  }
}

/** Kept for tests: the campaign code an item of this shape would carry. */
export function freedDatesCampaign(shortCode: string): string {
  return campaignCode(shortCode);
}

/** Days between today and the latest freed night, for logging. */
export function freedWindowDays(nights: readonly string[], today: string): number {
  if (nights.length === 0) return 0;
  return calendarDaysBetween(today, nights[nights.length - 1]);
}

/**
 * Should tonight raise an urgent "still open" nudge? Only when the night is free AND the
 * property has nothing already planned for today, so a host who planned work is not pinged twice.
 */
export function shouldNotifyTonightOpen(input: {
  tonightOpen: boolean;
  hasActiveItemToday: boolean;
}): boolean {
  return input.tonightOpen && !input.hasActiveItemToday;
}
