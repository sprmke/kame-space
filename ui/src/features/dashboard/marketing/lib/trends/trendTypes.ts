/**
 * Marketing Trends — client types.
 *
 * Mirrors `supabase/functions/_shared/marketingTrends/types.ts`. The client
 * never sends trend text to the server: it sends a topic key, and the server
 * loads the topic itself.
 */

export type TrendSourceId =
  | 'google_trends'
  | 'wikimedia_ph'
  | 'wikimedia_tl'
  | 'apple_music'
  | 'netflix'
  | 'editor';

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

/** The label a host sees for each category. */
export const TREND_CATEGORY_LABELS: Record<TrendCategory, string> = {
  tv_film: 'TV & film',
  music: 'Music',
  celebrity: 'Celebrity',
  sports: 'Sports',
  food: 'Food',
  travel: 'Travel',
  holiday_event: 'Holidays',
  lifestyle: 'Lifestyle',
  gaming: 'Gaming',
  tech: 'Tech',
  other: 'Other',
};

export type TrendWindow = 'today' | 'week' | 'month';

export const TREND_WINDOWS: readonly TrendWindow[] = ['today', 'week', 'month'];

export const TREND_WINDOW_LABELS: Record<TrendWindow, string> = {
  today: 'Today',
  week: 'This week',
  month: 'This month',
};

export type TrendMomentum = 'new' | 'rising' | 'steady';

export const TREND_MOMENTUM_LABELS: Record<TrendMomentum, string> = {
  new: 'New',
  rising: 'Rising',
  steady: 'Steady',
};

export type TrendOutput = 'post' | 'image' | 'video';

export type TrendSourceEvidence = {
  source: TrendSourceId;
  rank: number;
  traffic?: string | null;
  views?: number | null;
  newsHeadlines?: string[];
};

export type TrendAngle = {
  title: string;
  hook: string;
  output: TrendOutput;
  goal: string;
  format: string;
  prompt: string;
};

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

export type MarketingTrendsResponse = {
  /** Set when the super admin turned Trends off for this property. */
  disabled?: boolean;
  runDate: string | null;
  publishedAt: string | null;
  stale: boolean;
  /** `'evergreen'` when there is no usable list; the client shows seasonal ideas. */
  fallback: 'evergreen' | null;
  windowsAvailable: TrendWindow[];
  topics: TrendTopic[];
};

/** A seasonal idea shown when there is no trend list. */
export type EvergreenTrendIdea = {
  key: string;
  title: string;
  summary: string;
  category: TrendCategory;
  angles: TrendAngle[];
  captionIdea: string;
  hashtags: string[];
};
