/**
 * Marketing insights mapper — the one place that knows Meta's metric names.
 *
 * Meta renames and removes metrics (impressions went in 2025, reach moved to
 * `post_total_media_view_unique` in June 2026). Everything else in the planner works on the
 * normalized shape this module returns, so a rename is a change here and nowhere else.
 *
 * Pure: no clock, no DB, no network.
 */

export const METRIC_VERSION = '2026-11-09.1';

export type InsightSnapshot = {
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  interactions: number | null;
};

export type InsightAgeBucket = '24h' | '72h' | '7d' | '28d';

const EMPTY: InsightSnapshot = {
  views: null,
  reach: null,
  likes: null,
  comments: null,
  shares: null,
  saves: null,
  interactions: null,
};

type RawEntry = { name?: unknown; values?: unknown; value?: unknown };

function readValue(entry: RawEntry): number | null {
  const values = entry.values;
  if (Array.isArray(values) && values.length > 0) {
    const first = values[0] as { value?: unknown };
    const value = Number(first?.value);
    return Number.isFinite(value) ? value : null;
  }
  const direct = Number(entry.value);
  return Number.isFinite(direct) ? direct : null;
}

/** Meta returns `{ data: [{ name, values: [{ value }] }] }`; tolerate a bare array too. */
export function toMetricMap(raw: unknown): Map<string, number> {
  const out = new Map<string, number>();
  const rows = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data)
      ? ((raw as { data: unknown[] }).data as unknown[])
      : [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const entry = row as RawEntry;
    if (typeof entry.name !== 'string') continue;
    const value = readValue(entry);
    if (value != null) out.set(entry.name, value);
  }
  return out;
}

/** Instagram media insights. `views` replaced `impressions`; sends are not exposed. */
export function mapInstagramInsights(raw: unknown): InsightSnapshot {
  const metrics = toMetricMap(raw);
  return {
    ...EMPTY,
    views: metrics.get('views') ?? metrics.get('impressions') ?? null,
    reach: metrics.get('reach') ?? null,
    likes: metrics.get('likes') ?? null,
    comments: metrics.get('comments') ?? null,
    shares: metrics.get('shares') ?? metrics.get('sends') ?? null,
    saves: metrics.get('saved') ?? metrics.get('saves') ?? null,
    interactions: metrics.get('total_interactions') ?? null,
  };
}

/**
 * Facebook Page post insights. June 2026 moved reach to `post_total_media_view_unique`,
 * so both names are accepted while old posts still resolve.
 */
export function mapFacebookPostInsights(raw: unknown): InsightSnapshot {
  const metrics = toMetricMap(raw);
  const views =
    metrics.get('post_media_views') ??
    metrics.get('post_total_media_view_unique') ??
    metrics.get('post_impressions') ??
    null;
  const reactions = metrics.get('post_reactions_by_type_total');
  return {
    ...EMPTY,
    views,
    reach: metrics.get('post_total_media_view_unique') ?? metrics.get('post_impressions_unique') ?? null,
    likes: metrics.get('post_reactions_like_total') ?? null,
    comments: metrics.get('post_comments') ?? null,
    shares: metrics.get('post_shares') ?? null,
    saves: null,
    interactions: reactions ?? metrics.get('post_clicks') ?? null,
  };
}

/** Age bucket for a snapshot taken `hours` after publish, or null when it is not due yet. */
export function ageBucketFor(hours: number): InsightAgeBucket | null {
  if (hours < 24) return null;
  if (hours < 72) return '24h';
  if (hours < 168) return '72h';
  if (hours < 672) return '7d';
  return '28d';
}

/** Roll several snapshots into the single `results` blob an item shows. */
export function rollupSnapshots(
  snapshots: readonly (InsightSnapshot & { ageBucket: InsightAgeBucket })[]
): InsightSnapshot {
  const latestByBucket = [...snapshots].sort(
    (a, b) => bucketRank(a.ageBucket) - bucketRank(b.ageBucket)
  );
  const latest = latestByBucket[latestByBucket.length - 1];
  if (!latest) return { ...EMPTY };
  const { ageBucket: _ignored, ...snapshot } = latest;
  return snapshot;
}

function bucketRank(bucket: InsightAgeBucket): number {
  return ['24h', '72h', '7d', '28d'].indexOf(bucket);
}
