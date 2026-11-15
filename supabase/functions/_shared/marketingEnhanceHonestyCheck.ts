/**
 * Honesty guard for "Enhance a photo": a vision comparison of the original listing photo
 * and the edited result. A host must never advertise a room the guest will not find, so
 * an edit that moved, added or removed objects or changed the room's layout is refused
 * (and, like any failed generation, not charged).
 *
 * Fail-open on infrastructure trouble: no key, a timeout or an unreadable answer counts as
 * "could not check", which lets the edit through (the structure-locked prompt is the first
 * line of defence; this is the second).
 */

import { generateText } from './ai/llmClient.ts';
import { isGeminiConfigured } from './ai/llmTransport.ts';
import { definePrompt } from './ai/prompt.ts';
import type { ReferenceInlineData } from './marketingImageGenerationAi.ts';

const FEATURE = 'marketing_image_prompt_enhance' as const;
const CHECK_TIMEOUT_MS = 8_000;

export const ENHANCE_HONESTY_PROMPT = definePrompt({
  id: 'marketing_enhance_honesty_check',
  version: '2026-11-13.1',
});

export type HonestyVerdict = { ok: true } | { ok: false; reason: string };

/** Host-facing wording; never exposes the model's raw sentence. */
export const ENHANCE_REFUSED_MESSAGE =
  'The edit changed what is in the room, so it was not saved. Try a lighter edit such as Brighten and balance.';

/**
 * Reads the model's answer: `SAME` passes, `DIFFERENT` fails, anything else is
 * inconclusive and passes (fail-open).
 */
export function parseHonestyVerdict(text: string): HonestyVerdict {
  const first = text.trim().split(/\s+/)[0]?.replace(/[^A-Za-z]/g, '').toUpperCase();
  if (first === 'DIFFERENT') return { ok: false, reason: ENHANCE_REFUSED_MESSAGE };
  return { ok: true };
}

const SYSTEM =
  'You compare two photos of the same vacation-rental space: the ORIGINAL and an EDITED ' +
  'version. Lighting, colour, exposure, sky, and removed clutter (loose small items such ' +
  'as cups or papers) are allowed changes. It is DIFFERENT if any furniture, fixture, ' +
  'window, door, appliance, view or the room layout was added, removed, moved, resized or ' +
  'reshaped. The edited version may be taller or wider than the original with the walls, floor or ceiling continued; that is allowed, but nothing new may appear inside the original area. Answer with one word, SAME or DIFFERENT, and nothing else.';

export async function checkEnhanceFaithful(input: {
  original: ReferenceInlineData;
  edited: { mimeType: string; data: string };
  organizationId: string;
  propertyId: string;
  actorUserId?: string | null;
}): Promise<HonestyVerdict> {
  if (!isGeminiConfigured()) return { ok: true };
  try {
    const result = await generateText({
      feature: FEATURE,
      prompt: ENHANCE_HONESTY_PROMPT,
      system: SYSTEM,
      user: [
        { text: 'ORIGINAL:' },
        { inlineData: input.original },
        { text: 'EDITED:' },
        { inlineData: input.edited },
        { text: 'Answer SAME or DIFFERENT.' },
      ],
      temperature: 0,
      maxOutputTokens: 8,
      attemptsPerKey: 1,
      timeoutMs: CHECK_TIMEOUT_MS,
      billing: {
        organizationId: input.organizationId,
        propertyId: input.propertyId,
        actorUserId: input.actorUserId ?? null,
        actorType: 'staff',
        mode: 'platform',
      },
    });
    return parseHonestyVerdict(result.text);
  } catch (err) {
    console.warn('[marketingEnhanceHonestyCheck] failed open:', (err as Error).message);
    return { ok: true };
  }
}
