/**
 * Marketing Trends — the AI classify pass.
 *
 * The model merges duplicates, judges safety, rates how well a topic ties to a
 * stay and writes the summary, the angles and the caption idea. Everything it
 * returns is validated again here: unknown keys dropped, lengths clamped,
 * enums enforced, and the deterministic denylist run over the model's own text.
 *
 * The publish step refuses to ship a list with fewer than five safe topics.
 *
 * Plan §4.4.
 */

import { z } from 'zod';

import { generateStructured } from '../ai/llmClient.ts';
import { estimateTokenCostUsd, getModelConfig } from '../aiModelRouter.ts';
import {
  buildMarketingTrendsClassifyPrompt,
  MARKETING_TRENDS_PROMPT,
  wrapCandidatesUntrusted,
  type TrendCandidateInput,
} from '../ai/prompts/marketingTrends.ts';
import { isDeterministicallyUnsafe } from './safetyDenylist.ts';
import {
  TREND_CATEGORIES,
  TREND_GOALS,
  TREND_OUTPUTS,
  type TrendAngle,
  type TrendCandidate,
  type TrendCategory,
  type TrendClassifiedTopic,
  type TrendOutput,
} from './types.ts';
import { guardRulesForCategory, type BrandGuardRule } from './brandGuard.ts';

const FEATURE = 'marketing_trends_classify' as const;

/** A list needs at least this many safe topics to be worth publishing. */
export const MIN_SAFE_TOPICS = 5;

/** How many candidates the model sees in one call. */
export const MAX_CLASSIFY_CANDIDATES = 60;

export const TREND_CLASSIFY_JSON_SCHEMA = {
  type: 'OBJECT',
  properties: {
    topics: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          key: { type: 'STRING' },
          mergeInto: { type: 'STRING' },
          title: { type: 'STRING' },
          category: { type: 'STRING' },
          safety: { type: 'STRING' },
          blockReason: { type: 'STRING' },
          stayFit: { type: 'NUMBER' },
          summary: { type: 'STRING' },
          angles: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                title: { type: 'STRING' },
                hook: { type: 'STRING' },
                output: { type: 'STRING' },
                goal: { type: 'STRING' },
                format: { type: 'STRING' },
                prompt: { type: 'STRING' },
              },
              required: ['title', 'hook', 'output', 'goal', 'format', 'prompt'],
            },
          },
          captionIdea: { type: 'STRING' },
          hashtags: { type: 'ARRAY', items: { type: 'STRING' } },
          brandGuard: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['key', 'title', 'category', 'safety', 'stayFit', 'summary'],
      },
    },
  },
  required: ['topics'],
} as const;

const AngleSchema = z.object({
  title: z.string(),
  hook: z.string(),
  output: z.string(),
  goal: z.string(),
  format: z.string(),
  prompt: z.string(),
});

const TopicSchema = z.object({
  key: z.string(),
  mergeInto: z.string().nullish(),
  title: z.string(),
  category: z.string(),
  safety: z.string(),
  blockReason: z.string().nullish(),
  stayFit: z.number(),
  summary: z.string(),
  angles: z.array(AngleSchema).nullish(),
  captionIdea: z.string().nullish(),
  hashtags: z.array(z.string()).nullish(),
  brandGuard: z.array(z.string()).nullish(),
});

export const TrendClassifyResponse = z.object({
  topics: z.array(TopicSchema),
});

function clamp(text: unknown, max: number): string {
  if (typeof text !== 'string') return '';
  const trimmed = text.trim();
  return trimmed.length > max ? trimmed.slice(0, max - 1).trimEnd() + '…' : trimmed;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/** Shape the model's answer into the topics we can publish. */
export function shapeTrendClassifyOutput(
  raw: unknown,
  candidateKeys: readonly string[]
): {
  topics: TrendClassifiedTopic[];
  /** Duplicates the model spotted: `from` folds into `into`. */
  merges: Array<{ from: string; into: string }>;
  blocked: number;
  dropped: number;
} {
  const parsed = TrendClassifyResponse.safeParse(raw);
  const rows = parsed.success ? parsed.data.topics : [];
  const known = new Set(candidateKeys);

  const topics: TrendClassifiedTopic[] = [];
  const merges: Array<{ from: string; into: string }> = [];
  let blocked = 0;
  let dropped = 0;

  for (const row of rows) {
    const key = row.key.trim();
    if (!known.has(key)) {
      dropped += 1;
      continue;
    }
    const mergeInto = typeof row.mergeInto === 'string' ? row.mergeInto.trim() : '';
    if (mergeInto && mergeInto !== key && known.has(mergeInto)) {
      // The caller folds this candidate's source evidence into the target, so a
      // duplicate still counts toward the cross-source bonus.
      merges.push({ from: key, into: mergeInto });
      continue;
    }

    const title = clamp(row.title, 80);
    const summary = clamp(row.summary, 160);
    const category = oneOf<TrendCategory>(
      row.category,
      TREND_CATEGORIES,
      'other'
    );
    const safety = row.safety === 'block' ? 'block' : 'safe';

    // The model's own text goes through the same denylist as the source titles.
    const modelText = `${title} ${summary} ${row.captionIdea ?? ''}`;
    const blockedByDenylist = isDeterministicallyUnsafe(
      modelText.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim()
    );

    if (safety === 'block' || blockedByDenylist) {
      blocked += 1;
      continue;
    }

    const stayFit = Math.min(3, Math.max(0, Math.round(Number(row.stayFit) || 0))) as
      | 0
      | 1
      | 2
      | 3;
    if (stayFit === 0) continue;

    const angles = shapeAngles(row.angles ?? [], category);
    const hashtags = (row.hashtags ?? [])
      .filter((tag) => typeof tag === 'string' && tag.trim())
      .slice(0, 5)
      .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`).replace(/\s+/g, ''));

    topics.push({
      key,
      mergeInto: null,
      title,
      category,
      safety: 'safe',
      blockReason: null,
      stayFit,
      summary,
      angles,
      captionIdea: clamp(row.captionIdea, 200),
      hashtags,
      brandGuard: shapeBrandGuard(row.brandGuard ?? [], category),
    });
  }

  return { topics, merges, blocked, dropped };
}

const ALLOWED_FORMATS = [
  'instagram-portrait',
  'instagram-square',
  'instagram-story',
  'facebook-post',
  '9:16',
  '1:1',
  '16:9',
  '4:5',
];

function shapeAngles(
  rows: Array<z.infer<typeof AngleSchema>>,
  category: TrendCategory
): TrendAngle[] {
  const angles: TrendAngle[] = [];
  for (const row of rows) {
    const title = clamp(row.title, 60);
    const hook = clamp(row.hook, 140);
    const prompt = clamp(row.prompt, 400);
    if (!title || !hook || !prompt) continue;
    angles.push({
      title,
      hook,
      output: oneOf<TrendOutput>(row.output, TREND_OUTPUTS, 'post'),
      goal: oneOf(row.goal, TREND_GOALS, 'vibe'),
      format: oneOf(row.format, ALLOWED_FORMATS, 'instagram-portrait'),
      prompt,
    });
    if (angles.length === 3) break;
  }
  return angles;
}

function shapeBrandGuard(rows: string[], category: TrendCategory): BrandGuardRule[] {
  const expected = guardRulesForCategory(category);
  const wanted = rows.filter((rule): rule is BrandGuardRule =>
    (['no_likeness', 'no_logo', 'no_endorsement'] as string[]).includes(rule)
  );
  if (!wanted.length) return expected;
  return [...new Set([...wanted, ...expected])];
}

/** The candidates the model sees, built from the merged candidates. */
export function toClassifyInputs(
  candidates: readonly TrendCandidate[],
  sourceLabels: Record<string, string>
): TrendCandidateInput[] {
  return candidates.slice(0, MAX_CLASSIFY_CANDIDATES).map((candidate) => ({
    key: candidate.key,
    title: candidate.title,
    sources: candidate.sources.map((entry) => sourceLabels[entry.source] ?? entry.source),
    newsHeadlines: candidate.sources.flatMap((entry) => entry.newsHeadlines ?? []).slice(0, 5),
  }));
}

export type TrendClassifyResult = {
  topics: TrendClassifiedTopic[];
  /** Duplicates the model spotted: `from` folds into `into`. */
  merges: Array<{ from: string; into: string }>;
  blocked: number;
  dropped: number;
  provider: string | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
  error: string | null;
};

/**
 * Run the classify pass. Throws when the model call fails, so the caller can
 * mark the run `failed` and keep the previous list.
 */
export async function runTrendClassify(
  candidates: readonly TrendCandidate[],
  sourceLabels: Record<string, string>
): Promise<TrendClassifyResult> {
  const inputs = toClassifyInputs(candidates, sourceLabels);
  const { system, user } = buildMarketingTrendsClassifyPrompt(inputs);
  const result = await generateStructured({
    feature: FEATURE,
    prompt: MARKETING_TRENDS_PROMPT,
    system,
    user: wrapCandidatesUntrusted(user),
    temperature: 0.3,
    schema: TrendClassifyResponse,
    jsonSchema: TREND_CLASSIFY_JSON_SCHEMA,
    // Platform cost. There is no org for a platform-wide daily job, so the call
    // is not metered against a host and the token counts land in the run ledger.
    billing: { organizationId: null, mode: 'none' },
  });

  const shaped = shapeTrendClassifyOutput(result.data, inputs.map((input) => input.key));
  const cost = estimateTokenCostUsd(
    getModelConfig(FEATURE),
    result.inputTokens ?? 0,
    result.outputTokens ?? 0
  );
  return {
    ...shaped,
    provider: result.provider ?? null,
    model: result.model ?? null,
    inputTokens: result.inputTokens ?? null,
    outputTokens: result.outputTokens ?? null,
    estimatedCostUsd: cost,
    error: null,
  };
}
