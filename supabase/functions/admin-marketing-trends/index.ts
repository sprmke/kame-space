/**
 * admin-marketing-trends — super-admin moderation for Marketing Trends.
 * Plan: docs/workflow/in-progress/marketing-trending-topics.md
 * UI: `/admin/marketing-trends`.
 *
 * GET  runs (last 14) + today's topics + overrides + manual topics
 * POST hide | pin | unhide | add-topic | remove-topic | run-now
 *
 * A hide applies at read time, so it reaches hosts within five minutes without
 * a rerun. "Run now" calls the same pipeline the cron calls, rate limited to
 * one run every ten minutes.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonError, jsonResponse, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';
import { logSuperAdminAction } from '../_shared/superAdminAudit.ts';
import { capturePostHogEvent } from '../_shared/posthog.ts';
import { runTrendsPipeline } from '../_shared/marketingTrends/pipeline.ts';
import { manilaTodayYmd } from '../_shared/calendarAvailabilityManila.ts';
import type { TrendCategory } from '../_shared/marketingTrends/types.ts';

/** One manual run every ten minutes. */
const RUN_COOLDOWN_MS = 10 * 60_000;

const TREND_CATEGORIES: readonly TrendCategory[] = [
  'tv_film',
  'music',
  'celebrity',
  'sports',
  'food',
  'travel',
  'holiday_event',
  'lifestyle',
  'gaming',
  'tech',
  'other',
];

function isCategory(value: unknown): value is TrendCategory {
  return typeof value === 'string' && (TREND_CATEGORIES as readonly string[]).includes(value);
}

serveSuperAdmin('admin-marketing-trends', async (req, user) => {
  const supabase = createServiceClient();

  if (req.method === 'GET') {
    const { data: runs, error: runsError } = await supabase
      .from('marketing_trend_runs')
      .select(
        'id, run_date, status, trigger, source_stats, ai_provider, ai_model, ai_error, candidate_count, topic_count, ai_input_tokens, ai_output_tokens, ai_cost_usd, started_at, finished_at'
      )
      .order('run_date', { ascending: false })
      .order('started_at', { ascending: false })
      .limit(14);
    if (runsError) return jsonError(req, runsError.message, 500);

    const latestRunId = (runs ?? []).find(
      (row) => (row as { status: string }).status === 'published'
    ) as { id: string } | undefined;

    const { data: topics } = latestRunId
      ? await supabase
          .from('marketing_trend_topics')
          .select(
            'id, topic_key, title, summary, category, stay_fit, score, momentum, days_trending, sources, angles, caption_idea, hashtags, brand_guard, pinned, manual, rank'
          )
          .eq('run_id', latestRunId.id)
          .eq('window', 'today')
          .order('rank', { ascending: true })
          .limit(50)
      : { data: [] as unknown[] };

    const { data: overrides } = await supabase
      .from('marketing_trend_overrides')
      .select('topic_key, action, note, expires_at, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    const { data: manualTopics } = await supabase
      .from('marketing_trend_manual_topics')
      .select('id, title, notes, category, active_from, active_to, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    return jsonSuccess(req, {
      runs: runs ?? [],
      topics: topics ?? [],
      overrides: overrides ?? [],
      manualTopics: manualTopics ?? [],
      latestRunId: latestRunId?.id ?? null,
    });
  }

  if (req.method !== 'POST') return jsonError(req, 'Method not allowed', 405);

  const body = await readJsonBody(req);
  const action = typeof body.action === 'string' ? body.action : '';

  if (action === 'hide' || action === 'pin') {
    const topicKey = typeof body.topicKey === 'string' ? body.topicKey.trim() : '';
    if (!topicKey) return jsonError(req, 'topicKey is required', 400);
    const { error } = await supabase.from('marketing_trend_overrides').upsert(
      {
        topic_key: topicKey,
        action,
        note: typeof body.note === 'string' ? body.note.slice(0, 200) : null,
        expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
        created_by: user.id ?? null,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'topic_key' }
    );
    if (error) return jsonError(req, error.message, 500);
    await logSuperAdminAction(user, {
      action: action === 'hide' ? 'marketing_trend_hidden' : 'marketing_trend_pinned',
      targetType: 'marketing_trend',
      targetId: topicKey,
      summary: `${action === 'hide' ? 'Hid' : 'Pinned'} marketing trend ${topicKey}`,
    });
    return jsonSuccess(req, { ok: true, topicKey, action });
  }

  if (action === 'unhide') {
    const topicKey = typeof body.topicKey === 'string' ? body.topicKey.trim() : '';
    if (!topicKey) return jsonError(req, 'topicKey is required', 400);
    const { error } = await supabase
      .from('marketing_trend_overrides')
      .delete()
      .eq('topic_key', topicKey);
    if (error) return jsonError(req, error.message, 500);
    await logSuperAdminAction(user, {
      action: 'marketing_trend_unhidden',
      targetType: 'marketing_trend',
      targetId: topicKey,
      summary: `Unhid marketing trend ${topicKey}`,
    });
    return jsonSuccess(req, { ok: true, topicKey });
  }

  if (action === 'add-topic') {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) return jsonError(req, 'title is required', 400);
    const category = isCategory(body.category) ? body.category : 'other';
    const { data, error } = await supabase
      .from('marketing_trend_manual_topics')
      .insert({
        title: title.slice(0, 120),
        notes: typeof body.notes === 'string' ? body.notes.slice(0, 500) : null,
        category,
        active_from: manilaTodayYmd(),
        active_to: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
        created_by: user.id ?? null,
      })
      .select('id')
      .single();
    if (error) return jsonError(req, error.message, 500);
    await logSuperAdminAction(user, {
      action: 'marketing_trend_manual_added',
      targetType: 'marketing_trend',
      targetId: (data as { id: string }).id,
      summary: `Added marketing trend "${title}"`,
    });
    return jsonSuccess(req, { ok: true, id: (data as { id: string }).id });
  }

  if (action === 'remove-topic') {
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    if (!id) return jsonError(req, 'id is required', 400);
    const { error } = await supabase.from('marketing_trend_manual_topics').delete().eq('id', id);
    if (error) return jsonError(req, error.message, 500);
    await logSuperAdminAction(user, {
      action: 'marketing_trend_manual_removed',
      targetType: 'marketing_trend',
      targetId: id,
      summary: 'Removed a manual marketing trend',
    });
    return jsonSuccess(req, { ok: true, id });
  }

  if (action === 'run-now') {
    // One manual run every ten minutes, so a double click cannot start two.
    const { data: recent } = await supabase
      .from('marketing_trend_runs')
      .select('started_at, trigger')
      .eq('trigger', 'manual')
      .order('started_at', { ascending: false })
      .limit(1);
    const lastManual = (recent?.[0] as { started_at?: string } | undefined)?.started_at;
    if (lastManual && Date.now() - Date.parse(lastManual) < RUN_COOLDOWN_MS) {
      return jsonError(req, 'A manual run started less than 10 minutes ago.', 429);
    }

    const result = await runTrendsPipeline({
      supabase,
      trigger: 'manual',
      triggeredBy: user.id ?? null,
    });

    await logSuperAdminAction(user, {
      action: 'marketing_trend_run_triggered',
      targetType: 'marketing_trend',
      targetId: result.runId,
      summary: `Ran Marketing Trends manually (${result.status}, ${result.topicCount} topics)`,
    });
    await capturePostHogEvent('marketing_trends_run', {
      logPrefix: 'admin-marketing-trends',
      distinctId: user.id ?? undefined,
      properties: {
        status: result.status,
        run_date: result.runDate,
        topic_count: result.topicCount,
        candidate_count: result.candidateCount,
        trigger: 'manual',
      },
    });

    if (result.status !== 'published') {
      // The operator needs to know which source failed, not just that the run did.
      return jsonResponse(
        req,
        {
          success: false,
          error: result.error ?? 'The run did not publish.',
          data: {
            runId: result.runId,
            runDate: result.runDate,
            status: result.status,
            sources: result.sourceStats,
          },
        },
        502
      );
    }
    return jsonSuccess(req, {
      ok: true,
      status: result.status,
      runDate: result.runDate,
      topicCount: result.topicCount,
      sources: result.sourceStats,
    });
  }

  return jsonError(req, 'Unknown action', 400);
});
