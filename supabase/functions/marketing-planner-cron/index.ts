/**
 * marketing-planner-cron — the planner's own sweep.
 *
 * Every 15 minutes:
 *  - run the weekly rules plan for properties whose chosen day and time has arrived,
 *  - expire items whose post-by date has passed,
 *  - remind the host about a manual item that is due within their lead time.
 *
 * AI plans are not generated here: a cron never spends credits without an explicit opt-in
 * and a credit cap (Phase 6.1). Rules plans are free.
 *
 * Schedule: hosted pg_cron + pg_net, NOT config.toml.
 */

import { logActivity, buildActorContext } from '../_shared/activityLog.ts';
import { manilaTodayYmd } from '../_shared/calendarAvailabilityManila.ts';
import { verifyCronSecret } from '../_shared/cronSecretGate.ts';
import { generatePlan } from '../_shared/marketingPlanner.ts';
import {
  isItemDueForReminder,
  reminderLeadMinutes,
} from '../_shared/marketingPublishScheduler.ts';
import { createOrCoalesceNotification } from '../_shared/notificationService.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { serveCronPost } from '../_shared/serveEdge.ts';

const LOG = 'marketing-planner-cron';
const PLAN_BATCH = 5;
const TIME_BUDGET_MS = 50_000;

/** Manila weekday (0 = Sunday) and `HH:mm`. */
export function manilaClock(now: Date = new Date()): { weekday: number; time: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Manila',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const weekdayLabel = parts.find((part) => part.type === 'weekday')?.value ?? 'Mon';
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  const order = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return { weekday: Math.max(0, order.indexOf(weekdayLabel)), time: `${hour}:${minute}` };
}

/** True when the property's weekly slot is this quarter-hour. */
export function isWeeklyPlanDue(input: {
  planWeekday: number;
  planTime: string;
  clock: { weekday: number; time: string };
}): boolean {
  if (input.planWeekday !== input.clock.weekday) return false;
  const [planHour, planMinute] = input.planTime.split(':').map(Number);
  const [nowHour, nowMinute] = input.clock.time.split(':').map(Number);
  if ([planHour, planMinute, nowHour, nowMinute].some((value) => Number.isNaN(value))) return false;
  // Fire within the 15-minute window that starts at the chosen time.
  const planMinutes = planHour * 60 + planMinute;
  const nowMinutes = nowHour * 60 + nowMinute;
  return nowMinutes >= planMinutes && nowMinutes < planMinutes + 15;
}

serveCronPost(
  LOG,
  (req) => verifyCronSecret(req, { envKey: 'MARKETING_PLANNER_CRON_SECRET' }),
  async () => {
    const sb = createServiceClient();
    const startedAt = Date.now();
    const now = new Date();

    const weekly = await runWeeklyPlans(sb, now, startedAt);
    const expired = await expireStaleItems(sb, now);
    const reminders = await sendDueReminders(sb, now);

    return { weekly, expired, reminders };
  }
);

async function runWeeklyPlans(
  sb: ReturnType<typeof createServiceClient>,
  now: Date,
  startedAt: number
): Promise<number> {
  const clock = manilaClock(now);
  const { data } = await sb
    .from('marketing_planner_settings')
    .select('property_id, organization_id, plan_weekday, plan_time, auto_plan')
    .eq('auto_plan', true)
    .limit(200);

  let created = 0;
  for (const row of data ?? []) {
    if (Date.now() - startedAt > TIME_BUDGET_MS || created >= PLAN_BATCH) break;
    if (
      !isWeeklyPlanDue({
        planWeekday: Number(row.plan_weekday ?? 1),
        planTime: String(row.plan_time ?? '08:00'),
        clock,
      })
    ) {
      continue;
    }

    // One plan per property per Manila day: the unique horizon guard is the plan row itself.
    const today = manilaTodayYmd();
    const { data: existing } = await sb
      .from('marketing_plans')
      .select('id')
      .eq('property_id', row.property_id)
      .eq('trigger', 'weekly_cron')
      .gte('created_at', `${today}T00:00:00+08:00`)
      .limit(1);
    if (existing && existing.length > 0) continue;

    try {
      const result = await generatePlan({
        propertyId: String(row.property_id),
        organizationId: String(row.organization_id),
        actor: buildActorContext('cron', { cron: LOG }),
        trigger: 'weekly_cron',
      });
      created += 1;
      // Only tell the host when the run actually added something.
      if (result.created > 0) {
        await createOrCoalesceNotification({
          organizationId: String(row.organization_id),
          propertyId: String(row.property_id),
          type: 'marketing_plan_ready',
          title: 'Your plan for this week is ready',
          body: `${result.created} ${result.created === 1 ? 'item' : 'items'} planned.`,
          dedupeKey: `marketing_plan_ready:${today}`,
          metadata: { planId: String(result.plan.id), count: result.created },
        });
      }
    } catch (error) {
      console.error('[marketing-planner-cron] weekly plan failed:', error);
    }
  }

  if (created > 0) {
    await logActivity({
      action: 'marketing.plan_generated',
      organizationId: String(data?.[0]?.organization_id ?? ''),
      actor: buildActorContext('cron', { cron: LOG }),
      metadata: { mode: 'rules', trigger: 'weekly_cron', count: created },
    });
  }
  return created;
}

async function expireStaleItems(
  sb: ReturnType<typeof createServiceClient>,
  now: Date
): Promise<number> {
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await sb
    .from('marketing_plan_items')
    .update({ status: 'expired', status_reason: 'The date passed before it was posted' })
    .in('status', ['suggested', 'planned', 'ready'])
    .lt('post_by', cutoff)
    .is('deleted_at', null)
    .select('id')
    .limit(200);
  return data?.length ?? 0;
}

/**
 * Remind the host before a manual item is due. The window comes from the property's own
 * `reminders.leadMinutes`, so a host who wants an hour of warning gets one.
 */
async function sendDueReminders(
  sb: ReturnType<typeof createServiceClient>,
  now: Date
): Promise<number> {
  // The widest window any property can ask for, so one query covers them all.
  const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const { data } = await sb
    .from('marketing_plan_items')
    .select('id, property_id, organization_id, title, channel_kind, scheduled_for, status')
    .in('status', ['planned', 'ready', 'scheduled'])
    .not('scheduled_for', 'is', null)
    .gte('scheduled_for', now.toISOString())
    .lte('scheduled_for', soon)
    .limit(100);
  if (!data || data.length === 0) return 0;

  const propertyIds = [...new Set(data.map((item) => String(item.property_id)))];
  const { data: settings } = await sb
    .from('marketing_planner_settings')
    .select('property_id, reminders')
    .in('property_id', propertyIds)
    .limit(100);

  const leadByProperty = new Map<string, number>();
  for (const row of settings ?? []) {
    const reminders = row.reminders;
    const raw =
      reminders && typeof reminders === 'object'
        ? (reminders as Record<string, unknown>).leadMinutes
        : undefined;
    leadByProperty.set(String(row.property_id), reminderLeadMinutes(raw));
  }

  let sent = 0;
  for (const item of data) {
    const leadMinutes = leadByProperty.get(String(item.property_id)) ?? 30;
    if (
      !isItemDueForReminder({
        status: String(item.status ?? ''),
        scheduledFor: item.scheduled_for ? String(item.scheduled_for) : null,
        nowIso: now.toISOString(),
        leadMinutes,
      })
    ) {
      continue;
    }
    await createOrCoalesceNotification({
      organizationId: String(item.organization_id),
      propertyId: String(item.property_id),
      type: 'marketing_item_due',
      title: 'Time to post',
      body: String(item.title ?? '').slice(0, 200),
      dedupeKey: `marketing_item_due:${item.id}`,
      metadata: { planItemId: item.id, channel: item.channel_kind, leadMinutes },
    });
    sent += 1;
  }
  return sent;
}
