/**
 * Speech-to-text transport (Groq Whisper). Lives in the AI gateway directory so the provider host,
 * key handling and error shaping stay in one place (scripts/dev/check-ai-gateway.mjs).
 *
 * It returns what the provider said and nothing else: callers own limits, metering and cleaning.
 * Provider error bodies are never forwarded; they can name models, keys and quotas.
 */

export const GROQ_TRANSCRIPTION_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

export class SpeechProviderError extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = 'SpeechProviderError';
    this.retryable = retryable;
  }
}

export type RawSpeechResult = {
  /** Words as the provider sent them, in seconds. Not yet cleaned. */
  words: unknown;
  language: string | null;
  /** Audio length the provider measured, 0 when it did not say. */
  seconds: number;
};

export async function transcribeSpeech(input: {
  apiKey: string;
  bytes: Uint8Array;
  mime: string;
  model: string;
  fileName: string;
  /** ISO code, or null to let the provider detect it. */
  language: string | null;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}): Promise<RawSpeechResult> {
  const form = new FormData();
  form.append('file', new File([input.bytes as BlobPart], input.fileName, { type: input.mime }));
  form.append('model', input.model);
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  form.append('temperature', '0');
  if (input.language) form.append('language', input.language);

  let response: Response;
  try {
    response = await (input.fetchImpl ?? fetch)(GROQ_TRANSCRIPTION_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${input.apiKey}` },
      body: form,
      signal: input.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new SpeechProviderError('Speech service unreachable', true);
  }

  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    throw new SpeechProviderError(`Speech service returned ${response.status}`, retryable);
  }

  let json: { words?: unknown; language?: unknown; duration?: unknown };
  try {
    json = await response.json();
  } catch {
    throw new SpeechProviderError('Speech service sent an unreadable answer', false);
  }
  return {
    words: json.words,
    language: typeof json.language === 'string' ? json.language.slice(0, 12) : null,
    seconds:
      typeof json.duration === 'number' && Number.isFinite(json.duration) ? json.duration : 0,
  };
}
