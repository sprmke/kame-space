/**
 * Marketing Planner AI briefs.
 *
 * Additive only: the scheduler has already decided the dates, times, formats and
 * channels. The model writes the words for those items. Any failure (no keys, quota,
 * kill switch, invalid output, guard rejection) leaves the rules copy in place, so a
 * plan is never blocked by AI.
 */

import { z } from 'zod';

import { generateStructured } from './ai/llmClient.ts';
import {
  buildMarketingPlanBriefPrompt,
  MARKETING_PLAN_BRIEF_PROMPT,
  MARKETING_PLAN_BRIEF_SCHEMA,
} from './ai/prompts/marketingPlanBrief.ts';
import { assertOrgAndPropertyAiQuota } from './aiUsageService.ts';
import { describeClaims, type PlannerClaims } from './marketingClaims.ts';
import { guardPlanBriefs, type GuardedItemCopy } from './marketingPlanGuard.ts';

export const PLAN_BRIEF_FEATURE = 'marketing_plan_brief' as const;

export type PlanBriefItemInput = {
  key: string;
  opportunityType: string;
  format: string;
  channel: string;
  evidence: string;
  claims: PlannerClaims;
};

export type PlanBriefCopy = {
  title: string;
  hook: string;
  message: string;
  cta: string;
};

export type PlanBriefAiResult = {
  summary: string;
  /** Keyed by item key. Items missing here keep their rules copy. */
  copies: Map<string, PlanBriefCopy>;
  creditsConsumed: number;
  rejected: number;
};

const ResponseSchema = z
  .object({
    summary: z.string(),
    items: z
      .array(
        z
          .object({
            itemKey: z.string(),
            title: z.string(),
            hook: z.string(),
            message: z.string(),
            cta: z.string(),
          })
          .passthrough()
      )
      .max(40),
  })
  .passthrough();

function clamp(value: string, max: number): string {
  return value.trim().slice(0, max);
}

/**
 * Run the AI pass over a plan skeleton. Returns null when AI is unavailable, so the
 * caller simply keeps rules copy.
 */
export async function maybeDraftPlanBriefs(input: {
  organizationId: string;
  propertyId: string;
  propertyName: string;
  area: string | null;
  amenities: readonly string[];
  language: 'en' | 'fil' | 'taglish';
  tone: 'warm' | 'playful' | 'premium';
  horizonEnd: string;
  items: readonly PlanBriefItemInput[];
  actorType: 'staff' | 'system';
}): Promise<PlanBriefAiResult | null> {
  if (input.items.length === 0) return null;

  try {
    await assertOrgAndPropertyAiQuota(input.organizationId, input.propertyId, PLAN_BRIEF_FEATURE);
  } catch {
    return null;
  }

  const { system, user } = buildMarketingPlanBriefPrompt({
    propertyName: input.propertyName,
    area: input.area,
    amenities: input.amenities,
    language: input.language,
    tone: input.tone,
    horizonEnd: input.horizonEnd,
    items: input.items.map((item) => ({
      key: item.key,
      opportunityType: item.opportunityType,
      format: item.format,
      channel: item.channel,
      evidence: item.evidence,
      claimsSummary: describeClaims(item.claims).join(' '),
    })),
  });

  let result;
  try {
    result = await generateStructured({
      feature: PLAN_BRIEF_FEATURE,
      prompt: MARKETING_PLAN_BRIEF_PROMPT,
      system,
      user,
      temperature: 0.5,
      schema: ResponseSchema,
      jsonSchema: MARKETING_PLAN_BRIEF_SCHEMA as unknown as Record<string, unknown>,
      billing: {
        organizationId: input.organizationId,
        propertyId: input.propertyId,
        actorType: input.actorType,
        quotaChecked: true,
      },
    });
  } catch (err) {
    console.warn('[marketingPlanBriefAi] AI pass failed:', (err as Error).message);
    return null;
  }

  const claimsByKey = new Map(input.items.map((item) => [item.key, item.claims]));
  const copies: GuardedItemCopy[] = result.data.items.map((item) => ({
    itemKey: item.itemKey,
    title: clamp(item.title, 40),
    hook: clamp(item.hook, 80),
    message: clamp(item.message, 160),
    cta: clamp(item.cta, 40),
  }));

  const guarded = guardPlanBriefs(copies, claimsByKey);
  const accepted = new Map<string, PlanBriefCopy>();
  for (const copy of guarded.accepted) {
    if (!copy.title || !copy.hook || !copy.message || !copy.cta) continue;
    accepted.set(copy.itemKey, {
      title: copy.title,
      hook: copy.hook,
      message: copy.message,
      cta: copy.cta,
    });
  }

  return {
    summary: clamp(result.data.summary, 200),
    copies: accepted,
    creditsConsumed: result.creditsConsumed,
    rejected: guarded.rejected.length,
  };
}
