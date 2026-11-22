import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  CAPTION_MAX_WORDS,
  captionCostUsd,
  normalizeWords,
  parseCaptionLanguage,
  sniffAudioMime,
  transcribeCaptions,
} from './marketingVideoCaptions.ts';
import { SpeechProviderError } from './ai/speechTransport.ts';

const bytes = (...values: number[]) => new Uint8Array([...values, ...new Array(16).fill(0)]);
const text = (value: string) => [...value].map((c) => c.charCodeAt(0));

Deno.test('sniffAudioMime reads the file, not the name', () => {
  assertEquals(sniffAudioMime(bytes(0, 0, 0, 32, ...text('ftypM4A '))), 'audio/mp4');
  assertEquals(sniffAudioMime(bytes(0x1a, 0x45, 0xdf, 0xa3)), 'audio/webm');
  assertEquals(sniffAudioMime(bytes(...text('OggS'))), 'audio/ogg');
  assertEquals(sniffAudioMime(bytes(...text('RIFF'), 0, 0, 0, 0, ...text('WAVE'))), 'audio/wav');
  assertEquals(sniffAudioMime(bytes(...text('ID3'))), 'audio/mpeg');
  assertEquals(sniffAudioMime(bytes(0xff, 0xfb)), 'audio/mpeg');
  assertEquals(sniffAudioMime(bytes(...text('<html>'))), null);
  assertEquals(sniffAudioMime(new Uint8Array(4)), null);
});

Deno.test('parseCaptionLanguage only accepts what the editor offers', () => {
  assertEquals(parseCaptionLanguage('en'), 'en');
  assertEquals(parseCaptionLanguage('tl'), 'tl');
  assertEquals(parseCaptionLanguage('fr'), 'auto');
  assertEquals(parseCaptionLanguage(undefined), 'auto');
});

Deno.test('captionCostUsd bills at least ten seconds and rounds up', () => {
  const tenSeconds = (10 / 3600) * 0.04;
  assertEquals(captionCostUsd(1), tenSeconds);
  assertEquals(captionCostUsd(0), tenSeconds);
  assertEquals(captionCostUsd(60), (60 / 3600) * 0.04);
  assertEquals(captionCostUsd(60.2), (61 / 3600) * 0.04);
});

Deno.test('normalizeWords cleans, orders and caps what Whisper sends', () => {
  const words = normalizeWords(
    [
      { word: ' Hello ', start: 0, end: 0.4 },
      { word: '', start: 0.4, end: 0.5 },
      { word: 'there', start: 0.3, end: 0.35 },
      { word: 'friend', start: 0.9, end: 0.8 },
      { word: 'x'.repeat(100), start: 1, end: 1.2 },
      { start: 2, end: 3 },
      null,
    ],
    60_000
  );
  assertEquals(
    words.map((w) => w.text),
    ['Hello', 'there', 'friend', 'x'.repeat(60)]
  );
  assertEquals(words[0], { text: 'Hello', startMs: 0, endMs: 400 });
  // Starts never go backwards and every word has some length.
  for (let i = 0; i < words.length; i += 1) {
    if (i > 0) assertEquals(words[i]!.startMs >= words[i - 1]!.endMs, true);
    assertEquals(words[i]!.endMs > words[i]!.startMs, true);
  }
});

Deno.test('normalizeWords stops at the time limit and at the word cap', () => {
  const late = normalizeWords(
    [
      { word: 'in', start: 1, end: 2 },
      { word: 'out', start: 9, end: 10 },
    ],
    5000
  );
  assertEquals(late.length, 1);
  const many = Array.from({ length: CAPTION_MAX_WORDS + 50 }, (_, i) => ({
    word: 'a',
    start: i * 0.01,
    end: i * 0.01 + 0.005,
  }));
  assertEquals(normalizeWords(many, 60_000).length, CAPTION_MAX_WORDS);
  assertEquals(normalizeWords('nope', 1000), []);
});

Deno.test('transcribeCaptions sends word timing and returns clean words', async () => {
  let seen: { url: string; auth: string | null; form: FormData } | null = null;
  const result = await transcribeCaptions({
    apiKey: 'k',
    bytes: bytes(...text('OggS')),
    mime: 'audio/ogg',
    language: 'tl',
    fetchImpl: ((url: string, init: RequestInit) => {
      seen = {
        url,
        auth: new Headers(init.headers).get('authorization'),
        form: init.body as FormData,
      };
      return Promise.resolve(
        new Response(
          JSON.stringify({
            language: 'tagalog',
            duration: 3.2,
            words: [{ word: 'Kumusta', start: 0, end: 0.5 }],
          }),
          { status: 200 }
        )
      );
    }) as typeof fetch,
  });
  assertEquals(result.words, [{ text: 'Kumusta', startMs: 0, endMs: 500 }]);
  assertEquals(result.seconds, 3.2);
  assertEquals(seen!.auth, 'Bearer k');
  assertEquals(seen!.form.get('response_format'), 'verbose_json');
  assertEquals(seen!.form.getAll('timestamp_granularities[]'), ['word']);
  assertEquals(seen!.form.get('language'), 'tl');
  assertEquals(seen!.form.get('model'), 'whisper-large-v3-turbo');
});

Deno.test('transcribeCaptions lets the provider detect the language when asked to', async () => {
  let form: FormData | null = null;
  await transcribeCaptions({
    apiKey: 'k',
    bytes: bytes(...text('OggS')),
    mime: 'audio/ogg',
    language: 'auto',
    fetchImpl: ((_url: string, init: RequestInit) => {
      form = init.body as FormData;
      return Promise.resolve(new Response('{}', { status: 200 }));
    }) as typeof fetch,
  });
  assertEquals(form!.has('language'), false);
});

Deno.test('transcribeCaptions hides provider details and marks busy errors retryable', async () => {
  const run = (status: number, body = '{"error":"model whisper quota key abc"}') =>
    transcribeCaptions({
      apiKey: 'k',
      bytes: bytes(...text('OggS')),
      mime: 'audio/ogg',
      language: 'auto',
      fetchImpl: (() => Promise.resolve(new Response(body, { status }))) as typeof fetch,
    });

  const busy = await assertRejects(() => run(429), SpeechProviderError);
  assertEquals(busy.retryable, true);
  assertEquals(busy.message.includes('quota'), false);
  assertEquals(busy.message.includes('abc'), false);
  const bad = await assertRejects(() => run(400), SpeechProviderError);
  assertEquals(bad.retryable, false);
  const down = await assertRejects(() => run(503), SpeechProviderError);
  assertEquals(down.retryable, true);
  await assertRejects(() => run(200, 'not json'), SpeechProviderError);
});
