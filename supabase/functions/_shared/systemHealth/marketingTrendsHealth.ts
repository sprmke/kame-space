/**
 * System health — the Marketing Trends list.
 *
 * The job registry already warns when the cron stops running. This check
 * covers the other failure: the cron runs, but nothing was published, so hosts
 * see a stale list (or the evergreen fallback) with no obvious cause.
 *
 * > 36 h old: warn. > 72 h old: error.
 */

import type { SupabaseClient } from '../supabaseJs.ts';
import type { HealthCheck } from './types.ts';

/** A list older than this is stale. */
export const TRENDS_STALE_AFTER_HOURS = 36;
/** A list older than this is expired: the client shows seasonal ideas. */
export const TRENDS_EXPIRED_AFTER_HOURS = 72;

export type MarketingTrendsHealth = {
  status: HealthCheck['status'];
  detail: string;
  hint?: string;
  runDate: string | null;
  publishedAt: string | null;
  ageHours: number | null;
};

/** Read the latest published run and judge its age. */
export async function evaluateMarketingTrendsHealth(
  supabase: SupabaseClient,
  now: Date = new Date()
): Promise<MarketingTrendsHealth> {
  const { data, error } = await supabase
    .from('marketing_trend_runs')
    .select('run_date, finished_at, started_at')
    .eq('status', 'published')
    .order('run_date', { ascending: false })
    .limit(1);

  if (error) {
    return {
      status: 'unknown',
      detail: 'Could not read the Marketing Trends run ledger',
      hint: error.message,
      runDate: null,
      publishedAt: null,
      ageHours: null,
    };
  }

  const row = data?.[0] as
    | { run_date?: string; finished_at?: string | null; started_at?: string | null }
    | undefined;
  if (!row?.run_date) {
    return {
      status: 'warn',
      detail: 'No Marketing Trends list has been published yet',
      hint: 'Run the job from /admin/marketing-trends, or check the cron schedule.',
      runDate: null,
      publishedAt: null,
      ageHours: null,
    };
  }

  const publishedAt = row.finished_at ?? row.started_at ?? null;
  const ageHours = publishedAt
    ? (now.getTime() - Date.parse(publishedAt)) / 3_600_000
    : null;

  if (ageHours === null) {
    return {
      status: 'unknown',
      detail: 'The latest Marketing Trends run has no finish time',
      runDate: row.run_date,
      publishedAt: null,
      ageHours: null,
    };
  }

  if (ageHours > TRENDS_EXPIRED_AFTER_HOURS) {
    return {
      status: 'error',
      detail: `Last Marketing Trends list is ${Math.round(ageHours)} h old (hosts see seasonal ideas)`,
      hint: 'Open /admin/marketing-trends and run the job, or read the cron run log.',
      runDate: row.run_date,
      publishedAt,
      ageHours,
    };
  }

  if (ageHours > TRENDS_STALE_AFTER_HOURS) {
    return {
      status: 'warn',
      detail: `Last Marketing Trends list is ${Math.round(ageHours)} h old`,
      hint: 'Open /admin/marketing-trends and run the job.',
      runDate: row.run_date,
      publishedAt,
      ageHours,
    };
  }

  return {
    status: 'ok',
    detail: `Last Marketing Trends list is ${Math.round(ageHours)} h old`,
    runDate: row.run_date,
    publishedAt,
    ageHours,
  };
}

/** The same check as a `/admin/health` row. */
export function marketingTrendsHealthCheck(health: MarketingTrendsHealth): HealthCheck {
  return {
    id: 'marketing.trends.list',
    category: 'jobs',
    group: 'Scheduled jobs',
    label: 'Marketing trends list',
    status: health.status,
    detail: health.detail,
    hint: health.hint,
    features: ['Marketing Studio'],
    fixHref: '/admin/marketing-trends',
  };
}
