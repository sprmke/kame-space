/**
 * marketing-trends-cron — the daily Marketing Trends run.
 * Plan: docs/workflow/in-progress/marketing-trending-topics.md
 *
 * Schedule: hosted pg_cron + pg_net (21:30 UTC = 05:30 Asia/Manila), NOT
 * config.toml. Optional header X-Marketing-Trends-Cron-Secret when
 * MARKETING_TRENDS_CRON_SECRET is set.
 *
 * The run is idempotent: the publish RPC takes an advisory lock and skips the
 * older run of the same date, so a second fire of the same morning never
 * publishes two lists.
 */

import { verifyCronSecret } from '../_shared/cronSecretGate.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { serveCronPost } from '../_shared/serveEdge.ts';
import { capturePostHogEvent } from '../_shared/posthog.ts';
import { runTrendsPipeline } from '../_shared/marketingTrends/pipeline.ts';

function cronSecretOk(req: Request): boolean {
  return verifyCronSecret(req, {
    envKey: 'MARKETING_TRENDS_CRON_SECRET',
    headerName: 'x-marketing-trends-cron-secret',
  });
}

serveCronPost('marketing-trends-cron', cronSecretOk, async () => {
  const supabase = createServiceClient();
  const result = await runTrendsPipeline({ supabase, trigger: 'cron' });

  await capturePostHogEvent('marketing_trends_run', {
    logPrefix: 'marketing-trends-cron',
    properties: {
      status: result.status,
      run_date: result.runDate,
      topic_count: result.topicCount,
      candidate_count: result.candidateCount,
    },
    system: true,
  });

  if (result.status !== 'published') {
    // The run ledger keeps the failure; the Sentry event comes from serveCronPost
    // when the handler throws. A failed run is not a crash: hosts keep the last
    // published list, so the run returns normally with the failure recorded.
    console.error('[marketing-trends-cron] run did not publish:', result.error);
  }

  return {
    status: result.status,
    runDate: result.runDate,
    topicCount: result.topicCount,
    candidateCount: result.candidateCount,
    sources: result.sourceStats,
    error: result.error,
  };
});
