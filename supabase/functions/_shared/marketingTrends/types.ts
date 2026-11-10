/**
 * Marketing Trends — shared types for the daily Philippine trend pipeline.
 *
 * One vocabulary for the source adapters (network), the normalizer and scorer
 * (pure), the AI classify pass, the publish RPC and the host read endpoint.
 *
 * This module has **no runtime imports** on purpose: the client mirror of the
 * evergreen list and its parity test both pull files from here.
 *
 * Plan: docs/workflow/in-progress/marketing-trending-topics.md
 */

/**
 * Poster goals a trend angle may use. Mirrors `POSTER_GOALS` in
 * `_shared/marketingPosterDirector.ts`; the classify validator asserts the two
 * stay in sync (see `marketingTrendsClassify.ts`).
 */
export type TrendGoal =
  | 'vibe'
  | 'promo'
  | 'amenity-spotlight'
  | 'feature-spotlight'
  | 'stay-info';

export const TREND_GOALS: readonly TrendGoal[] = [
  'vibe',
  'promo',
  'amenity-spotlight',
  'feature-spotlight',
  'stay-info',
];

/** Where a candidate came from. `editor` is a super-admin hand-added topic. */
export type TrendSourceId =
  | 'google_trends'
  | 'wikimedia_ph'
  | 'wikimedia_tl'
  | 'apple_music'
  | 'netflix'
  | 'editor';

export const TREND_SOURCE_IDS: readonly TrendSourceId[] = [
  'google_trends',
  'wikimedia_ph',
  'wikimedia_tl',
  'apple_music',
  'netflix',
  'editor',
];

export type TrendCategory =
  | 'tv_film'
  | 'music'
  | 'celebrity'
  | 'sports'
  | 'food'
  | 'travel'
  | 'holiday_event'
  | 'lifestyle'
  | 'gaming'
  | 'tech'
  | 'other';

export const TREND_CATEGORIES: readonly TrendCategory[] = [
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

/** The list a host sees. Precomputed at publish time, never aggregated at read time. */
export type TrendWindow = 'today' | 'week' | 'month';

export const TREND_WINDOWS: readonly TrendWindow[] = ['today', 'week', 'month'];

export type TrendMomentum = 'new' | 'rising' | 'steady';

export const TREND_MOMENTUM: readonly TrendMomentum[] = ['new', 'rising', 'steady'];

export type TrendSafety = 'safe' | 'block';

/** What the host makes from an angle. Matches the AI Studio outputs. */
export type TrendOutput = 'post' | 'image' | 'video';

export const TREND_OUTPUTS: readonly TrendOutput[] = ['post', 'image', 'video'];

/** One source's evidence for a topic. Stored on the topic row as JSONB. */
export type TrendSourceEvidence = {
  source: TrendSourceId;
  /** 1-based position in that source's own list. */
  rank: number;
  /** Google Trends traffic bucket, e.g. "500+". */
  traffic?: string | null;
  /** Wikipedia views for the day. */
  views?: number | null;
  /** Related news headlines (titles only). Never a third-party URL. */
  newsHeadlines?: string[];
};

/** One item from one source, before normalization. */
export type TrendSourceItem = {
  title: string;
  rank: number;
  traffic?: string | null;
  views?: number | null;
  newsHeadlines?: string[];
  /** Apple Music artist / Netflix show type. Only a hint, never the final category. */
  context?: string | null;
};

/** The adapter contract every source implements. */
export type TrendSourceResult = {
  source: TrendSourceId;
  ok: boolean;
  items: TrendSourceItem[];
  ms: number;
  error: string | null;
};

/** A normalized candidate: one topic key, merged from one or more sources. */
export type TrendCandidate = {
  key: string;
  /** The cleanest title seen for this key. */
  title: string;
  sources: TrendSourceEvidence[];
  /** Distinct source count (the cross-source bonus uses this, not the evidence length). */
  sourceCount: number;
};

/** One angle the host can turn into a post. */
export type TrendAngle = {
  title: string;
  hook: string;
  output: TrendOutput;
  goal: TrendGoal;
  format: string;
  prompt: string;
};

/** What the AI classify pass returns for one topic. */
export type TrendClassifiedTopic = {
  key: string;
  /** Key this topic should be merged into, when it duplicates another candidate. */
  mergeInto?: string | null;
  title: string;
  category: TrendCategory;
  safety: TrendSafety;
  blockReason?: string | null;
  /** 0 never published, 3 ties straight to a stay. */
  stayFit: 0 | 1 | 2 | 3;
  summary: string;
  angles: TrendAngle[];
  captionIdea: string;
  hashtags: string[];
  /** Guard rules to inject into the generation prompt, e.g. `no_likeness`. */
  brandGuard: string[];
};

/** A published topic row. Mirrors `marketing_trend_topics`. */
export type TrendTopic = {
  id: string;
  runId: string;
  runDate: string;
  window: TrendWindow;
  rank: number;
  topicKey: string;
  title: string;
  summary: string;
  category: TrendCategory;
  stayFit: number;
  score: number;
  momentum: TrendMomentum;
  daysTrending: number;
  firstSeen: string;
  sources: TrendSourceEvidence[];
  angles: TrendAngle[];
  captionIdea: string;
  hashtags: string[];
  brandGuard: string[];
  pinned: boolean;
  manual: boolean;
};

/** The host read endpoint payload. */
export type MarketingTrendsResponse = {
  runDate: string | null;
  publishedAt: string | null;
  /** True when the newest published list is older than 72 h. */
  stale: boolean;
  /** `'evergreen'` when there is no usable list; the client shows seasonal ideas. */
  fallback: 'evergreen' | null;
  /** Which windows have enough history to show. */
  windowsAvailable: TrendWindow[];
  topics: TrendTopic[];
};
