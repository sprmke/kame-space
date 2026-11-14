/**
 * AI-assisted social captions for Marketing Content Studio (via the AI gateway).
 */

import { generateText } from './ai/llmClient.ts';
import {
  buildMarketingCaptionPrompt,
  finalizeCaption,
  MARKETING_CAPTION_PROMPT,
} from './ai/prompts/marketingCaption.ts';
import { findBrandGuardViolation } from './marketingTrends/brandGuard.ts';
import type { TrendCategory } from './marketingTrends/types.ts';
import type { AiActorType } from './aiUsageService.ts';

export type MarketingCaptionInput = {
  organizationId: string;
  propertyId: string;
  propertyName: string;
  platform: 'facebook' | 'instagram';
  postType: 'post' | 'story';
  contentHint?: string;
  nightlyRate?: string;
  availabilityText?: string;
  actorUserId?: string | null;
  actorType?: AiActorType;
  /** Marketing Trends topic to mention. The topic text is loaded on the server. */
  trendBlock?: string;
  /** The topic's category, so the brand guard knows how strict to be. */
  trendCategory?: TrendCategory;
};

export async function generateMarketingCaption(input: MarketingCaptionInput): Promise<string> {
  const { system, user } = buildMarketingCaptionPrompt(input);
  const result = await generateText({
    feature: 'marketing_caption',
    prompt: MARKETING_CAPTION_PROMPT,
    system,
    user,
    temperature: 0.7,
    cache: {},
    billing: {
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      actorUserId: input.actorUserId ?? null,
      actorType: input.actorType ?? 'staff',
    },
  });
  const caption = finalizeCaption(result.text, input.postType);
  // A caption that suggests an endorsement is worse than no caption: the guard
  // runs over the finished text.
  if (input.trendCategory && findBrandGuardViolation(caption, input.trendCategory)) {
    return '';
  }
  return caption;
}
