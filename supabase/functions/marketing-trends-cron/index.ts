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
import { captureSentryException } from '../_shared/sentry.ts';
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
    // A run that cannot publish is not a crash, so `serveCronPost` never sees it.
    // It is still the failure that matters: hosts silently keep the last list and
    // then fall back to seasonal ideas. Report it explicitly, with the source
    // breakdown, so the alert names the source that broke rather than the cron.
    console.error('[marketing-trends-cron] run did not publish:', result.error);
    // `serveCronPost` calls the run callback without the request, so the event is
    // attributed by tag and fingerprint rather than by URL.
    await captureSentryException(new Error(`marketing trends run failed: ${result.error}`), {
      logPrefix: 'cron:marketing-trends-cron',
      tags: { cron: 'marketing-trends-cron', run_status: result.status },
      fingerprint: ['cron', 'marketing-trends-cron'],
      extra: {
        runId: result.runId,
        runDate: result.runDate,
        candidateCount: result.candidateCount,
        sources: result.sourceStats,
      },
    });
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
