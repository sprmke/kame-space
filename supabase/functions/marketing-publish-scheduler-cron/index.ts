/**
 * marketing-publish-scheduler-cron — publish scheduled Marketing Planner items.
 *
 * Every minute: claim due `scheduled` publications, re-check the plan item's claims, then
 * publish through the existing Meta publishing seam. A false claim holds the post instead of
 * shipping a stale date or price. Failures retry on a ladder and then fail loudly.
 *
 * Schedule: hosted pg_cron + pg_net, NOT config.toml. See
 * docs/archive/operations/scheduled-jobs-and-testing.md.
 *
 * Meta-specific endpoints are documented but unverified until the Phase 0.2 spike runs on a
 * dev app. Nothing here runs without a real connection and a scheduled row.
 */

import { logActivity, buildActorContext } from '../_shared/activityLog.ts';
import { verifyCronSecret } from '../_shared/cronSecretGate.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { validateAvailabilityClaims } from '../_shared/marketingClaims.ts';
import {
  decidePublishAction,
  nextAttemptIso,
  publishTypeFor,
} from '../_shared/marketingPublishScheduler.ts';
import { publishMarketingPost } from '../_shared/marketingPublishAction.ts';
import { createOrCoalesceNotification } from '../_shared/notificationService.ts';
import { serveCronPost } from '../_shared/serveEdge.ts';

const LOG = 'marketing-publish-scheduler-cron';
const BATCH = 20;
const TIME_BUDGET_MS = 45_000;

type PublicationRow = {
  id: string;
  property_id: string;
  organization_id: string;
  connection_id: string;
  platform: string;
  publish_type: string;
  media_url: string;
  caption: string | null;
  scheduled_at: string | null;
  next_attempt_at: string | null;
  attempt_count: number | null;
  plan_item_id: string | null;
  status: string;
};

type PlanItemClaimsRow = {
  id: string;
  claims: Record<string, unknown> | null;
  tracked_url: string | null;
};

serveCronPost(
  LOG,
  (req) =>
    verifyCronSecret(req, {
      envKey: 'MARKETING_PUBLISH_CRON_SECRET',
      headerName: 'x-marketing-publish-cron-secret',
    }),
  async () => {
    const sb = createServiceClient();
    const startedAt = Date.now();
    const now = new Date();

    const { data: due, error } = await sb
      .from('marketing_publications')
      .select(
        'id, property_id, organization_id, connection_id, platform, publish_type, media_url, caption, scheduled_at, next_attempt_at, attempt_count, plan_item_id, status'
      )
      .eq('status', 'scheduled')
      .lte('scheduled_at', now.toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(BATCH);
    if (error) throw new Error(error.message);

    const rows = (due ?? []) as PublicationRow[];
    let published = 0;
    let held = 0;
    let retried = 0;
    let failed = 0;

    for (const row of rows) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) break;
      // A retry that is not due yet must wait.
      if (row.next_attempt_at && row.next_attempt_at > now.toISOString()) continue;

      // Claim optimistically: only one worker can move scheduled -> publishing.
      const { data: claimed } = await sb
        .from('marketing_publications')
        .update({ status: 'publishing' })
        .eq('id', row.id)
        .eq('status', 'scheduled')
        .select('id')
        .maybeSingle();
      if (!claimed) continue;

      const decision = await resolveDecision(sb, row, now);
      if (decision.kind === 'hold') {
        await holdPublication(sb, row, decision.reason);
        held += 1;
        continue;
      }
      if (decision.kind === 'retry') {
        await sb
          .from('marketing_publications')
          .update({
            status: 'scheduled',
            attempt_count: (row.attempt_count ?? 0) + 1,
            next_attempt_at: nextAttemptIso(now, decision.nextAttemptInMinutes),
          })
          .eq('id', row.id);
        retried += 1;
        continue;
      }
      if (decision.kind === 'fail') {
        await failPublication(sb, row, decision.reason);
        failed += 1;
        continue;
      }

      try {
        const result = await publishMarketingPost({
          propertyId: row.property_id,
          organizationId: row.organization_id,
          connectionId: row.connection_id,
          publishType: publishTypeFor(row),
          rawMediaUrl: row.media_url,
          caption: row.caption ?? '',
          createdBy: '00000000-0000-0000-0000-000000000000',
        });
        await sb
          .from('marketing_publications')
          .update({
            status: 'published',
            published_at: result.publishedAt ?? new Date().toISOString(),
            meta_post_id: result.metaPostId,
            attempt_count: (row.attempt_count ?? 0) + 1,
          })
          .eq('id', row.id);
        if (row.plan_item_id) {
          await sb
            .from('marketing_plan_items')
            .update({ status: 'published', posted_at: new Date().toISOString() })
            .eq('id', row.plan_item_id);
        }
        published += 1;
      } catch (publishError) {
        const attempts = (row.attempt_count ?? 0) + 1;
        const retry = decidePublishAction({
          claim: 'ok',
          attempts,
          connectionHealthy: true,
        });
        if (retry.kind === 'retry') {
          await sb
            .from('marketing_publications')
            .update({
              status: 'scheduled',
              attempt_count: attempts,
              next_attempt_at: nextAttemptIso(now, retry.nextAttemptInMinutes),
              error_message: (publishError as Error).message.slice(0, 500),
            })
            .eq('id', row.id);
          retried += 1;
        } else {
          await failPublication(sb, row, (publishError as Error).message);
          failed += 1;
        }
      }
    }

    return { checked: rows.length, published, held, retried, failed };
  }
);

/**
 * Re-check the linked plan item's claims before publishing. Missing item or missing claims
 * is not a reason to hold: only a demonstrably false claim is.
 */
async function resolveDecision(
  sb: ReturnType<typeof createServiceClient>,
  row: PublicationRow,
  now: Date
): Promise<ReturnType<typeof decidePublishAction>> {
  const healthy = await connectionHealthy(sb, row);

  if (!row.plan_item_id) {
    return decidePublishAction({
      claim: 'ok',
      attempts: row.attempt_count ?? 0,
      connectionHealthy: healthy,
    });
  }

  const { data: item } = await sb
    .from('marketing_plan_items')
    .select('id, claims, tracked_url')
    .eq('id', row.plan_item_id)
    .maybeSingle();
  const claims = ((item as PlanItemClaimsRow | null)?.claims ?? null) as {
    openNights?: string[];
    nightsLeftInMonth?: number;
    fullyBookedWindow?: { from: string; to: string };
  } | null;

  if (!claims) {
    return decidePublishAction({
      claim: 'ok',
      attempts: row.attempt_count ?? 0,
      connectionHealthy: healthy,
    });
  }

  const blocked = await loadBlockedNights(sb, row.property_id);
  const check = validateAvailabilityClaims(claims, blocked);
  return decidePublishAction({
    claim: check.ok ? 'ok' : 'broken',
    claimReason: check.ok ? null : check.reason,
    attempts: row.attempt_count ?? 0,
    connectionHealthy: healthy,
  });
}

async function connectionHealthy(
  sb: ReturnType<typeof createServiceClient>,
  row: PublicationRow
): Promise<boolean> {
  const { data } = await sb
    .from('social_channel_connections')
    .select('id, encrypted_access_token, meta_page_id')
    .eq('id', row.connection_id)
    .eq('organization_id', row.organization_id)
    .maybeSingle();
  return Boolean(data?.encrypted_access_token && data?.meta_page_id);
}

async function loadBlockedNights(
  sb: ReturnType<typeof createServiceClient>,
  propertyId: string
): Promise<Set<string>> {
  const blocked = new Set<string>();
  const { data: bookings } = await sb
    .from('guest_submissions')
    .select('check_in_date, check_out_date, status')
    .eq('property_id', propertyId)
    .neq('status', 'CANCELLED')
    .neq('status', 'IMPORTED')
    .limit(2000);
  for (const row of bookings ?? []) {
    const start = toYmd(row.check_in_date);
    const end = toYmd(row.check_out_date);
    if (!start || !end || start > end) continue;
    let cursor = start;
    while (cursor < end) {
      blocked.add(cursor);
      cursor = addDay(cursor);
    }
  }
  return blocked;
}

function toYmd(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const m = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
}

function addDay(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}

async function holdPublication(
  sb: ReturnType<typeof createServiceClient>,
  row: PublicationRow,
  reason: string
): Promise<void> {
  await sb
    .from('marketing_publications')
    .update({ status: 'held', last_error_code: 'claim_changed', error_message: reason.slice(0, 500) })
    .eq('id', row.id);
  if (row.plan_item_id) {
    await sb
      .from('marketing_plan_items')
      .update({ status: 'held', status_reason: reason.slice(0, 200) })
      .eq('id', row.plan_item_id);
  }
  await createOrCoalesceNotification({
    organizationId: row.organization_id,
    propertyId: row.property_id,
    type: 'marketing_publish_held',
    title: 'Post held',
    body: reason.slice(0, 200),
    dedupeKey: `marketing_publish_held:${row.id}`,
    metadata: { publicationId: row.id, planItemId: row.plan_item_id },
  });
  await logActivity({
    action: 'marketing.scheduled_publish_held',
    organizationId: row.organization_id,
    propertyId: row.property_id,
    actor: buildActorContext('cron', { cron: LOG }),
    targetId: row.id,
    metadata: { reason: reason.slice(0, 200) },
  });
}

async function failPublication(
  sb: ReturnType<typeof createServiceClient>,
  row: PublicationRow,
  reason: string
): Promise<void> {
  await sb
    .from('marketing_publications')
    .update({ status: 'failed', error_message: reason.slice(0, 500) })
    .eq('id', row.id);
  if (row.plan_item_id) {
    await sb
      .from('marketing_plan_items')
      .update({ status: 'failed', status_reason: reason.slice(0, 200) })
      .eq('id', row.plan_item_id);
  }
  await createOrCoalesceNotification({
    organizationId: row.organization_id,
    propertyId: row.property_id,
    type: 'marketing_publish_failed',
    title: 'Post failed',
    body: reason.slice(0, 200),
    dedupeKey: `marketing_publish_failed:${row.id}`,
    metadata: { publicationId: row.id, planItemId: row.plan_item_id },
  });
}
