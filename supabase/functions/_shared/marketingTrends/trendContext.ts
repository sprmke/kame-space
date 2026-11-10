/**
 * Marketing Trends — server-side trend context for generation.
 *
 * The host sends a topic key, never trend text. The server loads the topic
 * from the latest published run and refuses a key that is hidden or older than
 * seven days, so a client cannot inject its own "trend context" into a prompt.
 *
 * Plan §4.6.
 */

import type { SupabaseClient } from '../supabaseJs.ts';
import { buildBrandGuardPromptBlock, needsBrandGuard } from './brandGuard.ts';
import type { TrendAngle, TrendCategory } from './types.ts';

/** A trend older than this is refused. */
export const MAX_TREND_AGE_DAYS = 7;

export type TrendContext = {
  topicKey: string;
  title: string;
  summary: string;
  hook: string;
  angles: TrendAngle[];
  captionIdea: string;
  brandGuard: string[];
  category: TrendCategory;
};

export type TrendContextResult =
  | { ok: true; context: TrendContext }
  | { ok: false; reason: 'no_key' | 'not_found' | 'hidden' | 'stale' };

/** Load the topic the host picked, if it is still usable. */
export async function loadTrendContext(
  supabase: SupabaseClient,
  topicKey: string | null | undefined
): Promise<TrendContextResult> {
  const key = (topicKey ?? '').trim();
  if (!key) return { ok: false, reason: 'no_key' };

  // A hide applies at read time, so it also applies here.
  const { data: hidden } = await supabase
    .from('marketing_trend_overrides')
    .select('topic_key')
    .eq('topic_key', key)
    .eq('action', 'hide')
    .gt('expires_at', new Date().toISOString());
  if (hidden && hidden.length > 0) return { ok: false, reason: 'hidden' };

  const { data: runs } = await supabase
    .from('marketing_trend_runs')
    .select('id, run_date')
    .eq('status', 'published')
    .order('run_date', { ascending: false })
    .limit(1);
  const run = runs?.[0] as { id: string; run_date: string } | undefined;
  if (!run) return { ok: false, reason: 'not_found' };

  const ageDays = Math.round(
    (Date.now() - Date.parse(`${run.run_date}T00:00:00Z`)) / 86_400_000
  );
  if (ageDays > MAX_TREND_AGE_DAYS) return { ok: false, reason: 'stale' };

  const { data: topics } = await supabase
    .from('marketing_trend_topics')
    .select('topic_key, title, summary, category, angles, caption_idea, brand_guard')
    .eq('run_id', run.id)
    .eq('window', 'today')
    .eq('topic_key', key)
    .limit(1);
  const topic = topics?.[0] as
    | {
        topic_key: string;
        title: string;
        summary: string;
        category: TrendCategory;
        angles: TrendAngle[];
        caption_idea: string;
        brand_guard: string[];
      }
    | undefined;
  if (!topic) return { ok: false, reason: 'not_found' };

  const angles = Array.isArray(topic.angles) ? topic.angles : [];
  return {
    ok: true,
    context: {
      topicKey: topic.topic_key,
      title: topic.title,
      summary: topic.summary,
      hook: angles[0]?.hook ?? '',
      angles,
      captionIdea: topic.caption_idea ?? '',
      brandGuard: Array.isArray(topic.brand_guard) ? topic.brand_guard : [],
      category: topic.category,
    },
  };
}

/**
 * The block appended to a generation prompt. It states the topic and the
 * angle, then the rules: mention it, never use a likeness or a logo, and use
 * no property facts that are not in the settings.
 */
export function buildTrendPromptBlock(context: TrendContext): string {
  const lines = [
    `Topic to mention: ${context.title}.`,
    context.summary ? `${context.summary}` : '',
    context.hook ? `Suggested angle: ${context.hook}` : '',
    'Reference the topic only. Do not invent facts about it.',
    'Use only property facts that come from the property settings.',
  ].filter(Boolean);
  if (needsBrandGuard(context.category)) {
    lines.push('No recognizable real people. No logos. No brand names in the image.');
  }
  const guard = buildBrandGuardPromptBlock(context.brandGuard);
  return `${lines.join('\n')}${guard}`;
}

/** The error a client sees when the topic cannot be used. */
export const TREND_UNAVAILABLE_MESSAGE = 'That trend is no longer available.';
