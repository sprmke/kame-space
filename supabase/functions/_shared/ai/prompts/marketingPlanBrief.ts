/**
 * Marketing Planner brief prompt and response schema.
 *
 * The scheduler owns dates, times, channels and formats. The model only writes words for
 * the items it is given. Prompt id and version are recorded on every generated plan.
 */

import { definePrompt } from '../prompt.ts';
import { UNTRUSTED_DATA_RULE, wrapUntrusted } from '../untrusted.ts';

export const MARKETING_PLAN_BRIEF_PROMPT = definePrompt({
  id: 'marketing_plan_brief',
  version: '2026-11-09.1',
});

export const MARKETING_PLAN_BRIEF_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          itemKey: { type: 'STRING' },
          title: { type: 'STRING' },
          hook: { type: 'STRING' },
          message: { type: 'STRING' },
          cta: { type: 'STRING' },
        },
        required: ['itemKey', 'title', 'hook', 'message', 'cta'],
      },
    },
  },
  required: ['summary', 'items'],
} as const;

export type PlanBriefPromptItem = {
  key: string;
  opportunityType: string;
  format: string;
  channel: string;
  evidence: string;
  claimsSummary: string;
};

export type PlanBriefPromptInput = {
  propertyName: string;
  area: string | null;
  amenities: readonly string[];
  language: 'en' | 'fil' | 'taglish';
  tone: 'warm' | 'playful' | 'premium';
  horizonEnd: string;
  items: readonly PlanBriefPromptItem[];
};

const LANGUAGE_RULE: Record<PlanBriefPromptInput['language'], string> = {
  en: 'Write in English.',
  fil: 'Write in Filipino. Keep sentences short and natural.',
  taglish: 'Write in Taglish: mostly English with natural Filipino words where a host would use them.',
};

export function buildMarketingPlanBriefPrompt(input: PlanBriefPromptInput): {
  system: string;
  user: string;
} {
  const system = [
    'You write social captions for one short-term rental property.',
    'You are given a finished plan: the dates and times are already decided and are NOT yours to change.',
    'Return ONLY JSON matching the schema.',
    'Rules:',
    '- One entry per item, same itemKey, no new keys. You may drop an item but never add one.',
    '- Never invent a date, a month, a price, a rating, a review count or an amenity.',
    '- Only numbers and months that appear in that item claims can appear in its copy.',
    '- hook: the first line, at most 8 words. title: at most 40 characters.',
    '- message: one sentence, at most 160 characters. cta: 2 to 5 words.',
    '- Instagram hashtags are not your job; leave them out.',
    '- summary: one plain sentence about the whole plan, at most 200 characters.',
    '- No em dash. No hype words (seamless, robust, unlock, elevate, delight).',
    `- ${LANGUAGE_RULE[input.language]}`,
    `- Tone: ${input.tone}.`,
    `- ${UNTRUSTED_DATA_RULE}`,
  ].join('\n');

  const itemLines = input.items.map((item) =>
    [
      `- itemKey=${item.key} | ${item.opportunityType} | ${item.format} on ${item.channel}`,
      `  why: ${item.evidence}`,
      `  claims: ${item.claimsSummary || 'none'}`,
    ].join('\n')
  );

  const facts = [
    `Property: ${input.propertyName}`,
    input.area ? `Area: ${input.area}` : null,
    input.amenities.length > 0
      ? `Amenities: ${input.amenities.slice(0, 20).join(', ')}`
      : 'Amenities: none recorded',
    `Plan horizon ends ${input.horizonEnd}.`,
  ]
    .filter(Boolean)
    .join('\n');

  const user = [
    wrapUntrusted('property_facts', facts, 1_200),
    wrapUntrusted('plan_items', itemLines.join('\n'), 6_000),
    'Emit one JSON object.',
  ].join('\n\n');

  return { system, user };
}
