/**
 * marketing-video-captions: speech to timed words for Videos auto captions.
 *
 * POST multipart/form-data  ?property_id=
 *   audio       a short mono clip of the part of the video that plays (m4a, webm, ogg, wav, mp3)
 *   language    auto | en | tl   (default auto)
 *   durationMs  optional length hint, used only to estimate cost when the provider omits it
 * Returns { words: [{ text, startMs, endMs }], language }. Empty `words` means no speech found.
 *
 * Auth: `marketing.generate:add` plus the `aiMarketingGeneration` plan feature, like every other
 * Marketing AI action. The AI feature toggle and quota (`marketing_video_captions`) apply, usage
 * is recorded per org and property, and nothing is stored: the audio is read, sent to Groq
 * Whisper and dropped.
 *
 * Plan: docs/workflow/in-progress/marketing-video-editor-mobile-first-refine.md §4.9, T5.3.
 * activity-log: N/A, the call stores nothing. The captions land in the saved video through the
 * normal autosave.
 */

import { aiErrorResponse } from '../_shared/ai/aiErrorResponse.ts';
import { SpeechProviderError } from '../_shared/ai/speechTransport.ts';
import { getGroqApiKey } from '../_shared/aiGeminiKeys.ts';
import {
  AiFeatureDisabledError,
  assertOrgAndPropertyAiQuota,
  isFeatureEnabled,
  recordAiUsage,
} from '../_shared/aiUsageService.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import {
  CAPTION_AUDIO_MAX_BYTES,
  CAPTION_AUDIO_MAX_SECONDS,
  CAPTION_MODEL,
  captionCostUsd,
  parseCaptionLanguage,
  sniffAudioMime,
  transcribeCaptions,
} from '../_shared/marketingVideoCaptions.ts';
import { createServiceClient, requirePropertyPermissionAndFeature } from '../_shared/orgAuth.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

const FEATURE = 'marketing_video_captions' as const;
/** The multipart envelope adds a little to the audio itself. */
const MAX_BODY_BYTES = CAPTION_AUDIO_MAX_BYTES + 64 * 1024;
const UNAVAILABLE = 'Captions are not available right now. Try again later.';
const BUSY = 'Captions are busy. Try again in a moment.';

serveAuthenticated('marketing-video-captions', async (req, user) => {
  if (req.method !== 'POST') return jsonError(req, 'Method not allowed', 405);

  const limited = await rateLimitGate(req, {
    scope: 'marketing-video-captions',
    identity: identityFromRequest(req, user),
    limit: 10,
    windowSec: 300,
  });
  if (limited) return limited;

  let propertyId: string;
  let actorUserId: string;
  try {
    const scoped = await resolveScopedPropertyAccess(req, 'marketing.generate:add');
    propertyId = scoped.property.id;
    const access = await requirePropertyPermissionAndFeature(
      req,
      propertyId,
      'marketing.generate:add',
      'aiMarketingGeneration'
    );
    actorUserId = access.user.id;
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  // Refuse before buffering anything large.
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return jsonError(req, 'That audio is too long. Captions work on up to 60 seconds.', 413);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(req, 'That audio could not be read.', 400);
  }
  const audio = form.get('audio');
  if (!(audio instanceof File) || audio.size === 0) {
    return jsonError(req, 'That audio could not be read.', 400);
  }
  if (audio.size > CAPTION_AUDIO_MAX_BYTES) {
    return jsonError(req, 'That audio is too long. Captions work on up to 60 seconds.', 413);
  }
  const bytes = new Uint8Array(await audio.arrayBuffer());
  const mime = sniffAudioMime(bytes);
  if (!mime) return jsonError(req, 'That audio could not be read.', 400);

  const language = parseCaptionLanguage(form.get('language'));
  const hintMs = Number(form.get('durationMs'));
  const hintSeconds =
    Number.isFinite(hintMs) && hintMs > 0 ? Math.min(hintMs / 1000, CAPTION_AUDIO_MAX_SECONDS) : 0;

  const sb = createServiceClient();
  const { data: propertyRow, error } = await sb
    .from('properties')
    .select('organization_id')
    .eq('id', propertyId)
    .maybeSingle();
  if (error) return jsonError(req, error.message, 500);
  const organizationId = propertyRow?.organization_id ? String(propertyRow.organization_id) : null;
  if (!organizationId) return jsonError(req, 'Property not found', 404);

  try {
    if (!(await isFeatureEnabled(FEATURE))) throw new AiFeatureDisabledError(FEATURE);
    await assertOrgAndPropertyAiQuota(organizationId, propertyId, FEATURE);

    const apiKey = getGroqApiKey();
    if (!apiKey) return jsonError(req, UNAVAILABLE, 503);

    const result = await transcribeCaptions({
      apiKey,
      bytes,
      mime,
      language,
      signal: AbortSignal.timeout(60_000),
    });

    const seconds = result.seconds > 0 ? result.seconds : hintSeconds;
    // Recording is bookkeeping: never lose a finished transcription over it.
    try {
      await recordAiUsage({
        organizationId,
        propertyId,
        feature: FEATURE,
        provider: 'groq',
        model: CAPTION_MODEL,
        estimatedCostUsd: captionCostUsd(seconds),
        durationSeconds: seconds,
        actorUserId,
        actorType: 'staff',
      });
    } catch (usageError) {
      console.warn('[marketing-video-captions] usage not recorded:', (usageError as Error).message);
    }

    return jsonSuccess(req, { words: result.words, language: result.language });
  } catch (err) {
    if (err instanceof SpeechProviderError) {
      console.warn('[marketing-video-captions] provider error:', err.message);
      return jsonError(req, err.retryable ? BUSY : UNAVAILABLE, 503);
    }
    if (err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      return jsonError(req, BUSY, 503);
    }
    return aiErrorResponse(req, err, 'marketing-video-captions');
  }
});
