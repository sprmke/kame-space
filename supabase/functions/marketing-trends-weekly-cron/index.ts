/**
 * marketing-trends-weekly-cron — refresh the slow sources.
 * Plan: docs/workflow/in-progress/marketing-trending-topics.md
 *
 * Schedule: hosted pg_cron + pg_net (20:00 UTC Tuesday = 04:00 Asia/Manila
 * Wednesday), NOT config.toml. Netflix publishes Tuesdays.
 *
 * The Netflix Top 10 download is 33 MB of every country and every week, so it
 * runs here once a week and the daily run reads the cache. A failed download
 * keeps the last good week: the cache row is only replaced on success.
 */

import { verifyCronSecret } from '../_shared/cronSecretGate.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { serveCronPost } from '../_shared/serveEdge.ts';
import { capturePostHogEvent } from '../_shared/posthog.ts';
import { manilaTodayYmd } from '../_shared/calendarAvailabilityManila.ts';
import { fetchNetflixTop10Ph } from '../_shared/marketingTrends/sources/netflixTop10.ts';

function cronSecretOk(req: Request): boolean {
  return verifyCronSecret(req, {
    envKey: 'MARKETING_TRENDS_CRON_SECRET',
    headerName: 'x-marketing-trends-cron-secret',
  });
}

serveCronPost('marketing-trends-weekly-cron', cronSecretOk, async () => {
  const supabase = createServiceClient();
  const result = await fetchNetflixTop10Ph();

  if (!result.ok) {
    // Keep the last good week. The daily run ignores a cache older than 14 days.
    console.error('[marketing-trends-weekly-cron] netflix fetch failed:', result.error);
    await supabase.from('marketing_trend_source_cache').upsert(
      {
        source: 'netflix',
        period_start: manilaTodayYmd(),
        items: [],
        fetched_at: new Date().toISOString(),
        error: result.error,
      },
      { onConflict: 'source,period_start' }
    );
    await capturePostHogEvent('marketing_trends_run', {
      logPrefix: 'marketing-trends-weekly-cron',
      properties: { status: 'failed', source: 'netflix' },
      system: true,
    });
    return { status: 'failed', source: 'netflix', count: 0, error: result.error };
  }

  const items = result.items.map((item, index) => ({
    title: item.title,
    rank: index + 1,
    context: item.context ?? null,
  }));

  await supabase.from('marketing_trend_source_cache').upsert(
    {
      source: 'netflix',
      period_start: manilaTodayYmd(),
      items,
      fetched_at: new Date().toISOString(),
      error: null,
    },
    { onConflict: 'source,period_start' }
  );

  await capturePostHogEvent('marketing_trends_run', {
    logPrefix: 'marketing-trends-weekly-cron',
    properties: { status: 'published', source: 'netflix', topic_count: items.length },
    system: true,
  });

  return { status: 'published', source: 'netflix', count: items.length, error: null };
});
