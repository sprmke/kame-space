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
  /** Per-source outcome of the last run, so a broken feed is named, not guessed at. */
  sources?: Array<{ label: string; ok: boolean; detail: string }>;
};

/** Human labels for the source ids in `source_stats`. */
const SOURCE_LABELS: Record<string, string> = {
  google_trends: 'Google Trends',
  wikimedia_ph: 'Wikipedia',
  wikimedia_tl: 'Wikipedia (Tagalog)',
  apple_music: 'Apple Music',
  netflix: 'Netflix',
  editor: 'Added by staff',
};

type SourceStat = { ok?: boolean; count?: number; error?: string | null; stale?: boolean };

/** Turn `source_stats` into the rows an operator reads. */
function summarizeSources(stats: unknown): Array<{ label: string; ok: boolean; detail: string }> {
  if (!stats || typeof stats !== 'object') return [];
  return Object.entries(stats as Record<string, SourceStat>).map(([id, stat]) => {
    const label = SOURCE_LABELS[id] ?? id;
    if (stat?.ok) return { label, ok: true, detail: `${stat.count ?? 0} items` };
    const reason = stat?.stale ? 'cached copy is stale' : (stat?.error ?? 'failed');
    return { label, ok: false, detail: reason };
  });
}

/** Read the latest published run and judge its age. */
export async function evaluateMarketingTrendsHealth(
  supabase: SupabaseClient,
  now: Date = new Date()
): Promise<MarketingTrendsHealth> {
  // The newest attempt, published or not: a failed latest run is the thing to see.
  const { data, error } = await supabase
    .from('marketing_trend_runs')
    .select('run_date, finished_at, started_at, status, source_stats, ai_error')
    .order('run_date', { ascending: false })
    .order('started_at', { ascending: false })
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
    | {
        run_date?: string;
        finished_at?: string | null;
        started_at?: string | null;
        status?: string;
        source_stats?: unknown;
        ai_error?: string | null;
      }
    | undefined;
  const sources = summarizeSources(row?.source_stats);
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

  if (row.status === 'failed') {
    return {
      status: 'warn',
      detail: `Last Marketing Trends run failed: ${row.ai_error ?? 'no reason recorded'}`,
      hint: 'Open /admin/marketing-trends for the per-source breakdown, then run the job.',
      runDate: row.run_date,
      publishedAt: row.finished_at ?? row.started_at ?? null,
      ageHours: null,
      sources,
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
      sources,
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
      sources,
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
      sources,
    };
  }

  return {
    status: 'ok',
    detail: `Last Marketing Trends list is ${Math.round(ageHours)} h old`,
    runDate: row.run_date,
    publishedAt,
    ageHours,
    sources,
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
    items: health.sources?.map((source) => ({
      label: source.label,
      detail: source.ok ? source.detail : `failed: ${source.detail}`,
    })),
  };
}
