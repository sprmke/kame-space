import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

export type TrendRun = {
  id: string;
  run_date: string;
  status: 'running' | 'published' | 'failed' | 'skipped';
  trigger: 'cron' | 'manual';
  source_stats: Record<string, { ok: boolean; count: number; ms: number; error: string | null }>;
  ai_provider: string | null;
  ai_model: string | null;
  ai_error: string | null;
  candidate_count: number;
  topic_count: number;
  ai_input_tokens: number | null;
  ai_output_tokens: number | null;
  ai_cost_usd: number | null;
  started_at: string;
  finished_at: string | null;
};

export type TrendTopicRow = {
  id: string;
  topic_key: string;
  title: string;
  summary: string;
  category: string;
  stay_fit: number;
  score: number;
  momentum: string;
  days_trending: number;
  sources: Array<{ source: string; rank: number }>;
  angles: Array<{ title: string; hook: string }>;
  caption_idea: string;
  hashtags: string[];
  brand_guard: string[];
  pinned: boolean;
  manual: boolean;
  rank: number;
};

export type TrendOverride = {
  topic_key: string;
  action: 'hide' | 'pin';
  note: string | null;
  expires_at: string;
  created_at: string;
};

export type ManualTrendTopic = {
  id: string;
  title: string;
  notes: string | null;
  category: string;
  active_from: string;
  active_to: string;
  created_at: string;
};

export type MarketingTrendsAdminResponse = {
  runs: TrendRun[];
  topics: TrendTopicRow[];
  overrides: TrendOverride[];
  manualTopics: ManualTrendTopic[];
  latestRunId: string | null;
};

const KEY = ['super-admin', 'marketing-trends'] as const;

export function useMarketingTrendsAdmin() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => callEdgeFunction<MarketingTrendsAdminResponse>('admin-marketing-trends'),
    staleTime: 15_000,
  });
}

export type TrendModerationAction =
  | { action: 'hide'; topicKey: string }
  | { action: 'pin'; topicKey: string }
  | { action: 'unhide'; topicKey: string }
  | { action: 'add-topic'; title: string; notes?: string; category?: string }
  | { action: 'remove-topic'; id: string }
  | { action: 'run-now' };

/** Every moderation action goes through the same mutation so the list refetches once. */
export function useMarketingTrendsModeration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TrendModerationAction) =>
      callEdgeFunction<{ ok: boolean }>('admin-marketing-trends', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'That did not work');
    },
  });
}
