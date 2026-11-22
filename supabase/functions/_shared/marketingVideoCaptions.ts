/**
 * Auto captions for the Videos editor: one short audio clip in, timed words out.
 *
 * The browser sends only the part of the video that plays (a few hundred KB of mono audio), the
 * function checks it, asks Groq Whisper for word timestamps and returns them. Nothing is stored.
 * Pure helpers live here so they are unit tested with a mocked `fetch`.
 *
 * Plan: docs/workflow/in-progress/marketing-video-editor-mobile-first-refine.md §4.9.
 */

import { transcribeSpeech } from './ai/speechTransport.ts';

export const CAPTION_AUDIO_MAX_BYTES = 2 * 1024 * 1024;
/** The editor caps a video at 60 s; allow a little slack for container rounding. */
export const CAPTION_AUDIO_MAX_SECONDS = 65;
export const CAPTION_MAX_WORDS = 600;
export const CAPTION_MODEL = 'whisper-large-v3-turbo';
/** Groq list price for whisper-large-v3-turbo, USD per hour of audio. */
export const CAPTION_USD_PER_HOUR = 0.04;
/** Groq bills at least 10 seconds per request. */
export const CAPTION_MIN_BILLED_SECONDS = 10;

export type CaptionWord = { text: string; startMs: number; endMs: number };

export type CaptionLanguage = 'auto' | 'en' | 'tl';

export function parseCaptionLanguage(value: unknown): CaptionLanguage {
  return value === 'en' || value === 'tl' ? value : 'auto';
}

/** Audio type from the first bytes, so the file name and MIME header cannot be trusted alone. */
export function sniffAudioMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  const ascii = (start: number, length: number) =>
    String.fromCharCode(...bytes.slice(start, start + length));
  if (ascii(4, 4) === 'ftyp') return 'audio/mp4';
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return 'audio/webm';
  }
  if (ascii(0, 4) === 'OggS') return 'audio/ogg';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WAVE') return 'audio/wav';
  if (ascii(0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0)) {
    return 'audio/mpeg';
  }
  return null;
}

export function extensionForAudioMime(mime: string): string {
  switch (mime) {
    case 'audio/mp4':
      return 'm4a';
    case 'audio/webm':
      return 'webm';
    case 'audio/ogg':
      return 'ogg';
    case 'audio/wav':
      return 'wav';
    default:
      return 'mp3';
  }
}

/** Estimated provider cost for `seconds` of audio (billed in whole seconds, 10 s minimum). */
export function captionCostUsd(seconds: number): number {
  const billed = Math.max(CAPTION_MIN_BILLED_SECONDS, Math.ceil(Math.max(0, seconds)));
  return (billed / 3600) * CAPTION_USD_PER_HOUR;
}

type RawWord = { word?: unknown; start?: unknown; end?: unknown };

/**
 * Whisper words to clean, ordered, non-overlapping words in milliseconds. Drops empty words,
 * fixes backwards or overlapping times and caps the count.
 */
export function normalizeWords(raw: unknown, maxMs: number): CaptionWord[] {
  if (!Array.isArray(raw)) return [];
  const words: CaptionWord[] = [];
  let cursor = 0;
  for (const entry of raw as RawWord[]) {
    if (words.length >= CAPTION_MAX_WORDS) break;
    const text = typeof entry?.word === 'string' ? entry.word.trim() : '';
    if (!text) continue;
    const start = typeof entry.start === 'number' && Number.isFinite(entry.start) ? entry.start : 0;
    const end = typeof entry.end === 'number' && Number.isFinite(entry.end) ? entry.end : start;
    let startMs = Math.max(cursor, Math.round(start * 1000));
    if (startMs > maxMs) break;
    let endMs = Math.max(startMs + 1, Math.round(end * 1000));
    endMs = Math.min(endMs, maxMs);
    if (endMs <= startMs) startMs = Math.max(0, endMs - 1);
    words.push({ text: text.slice(0, 60), startMs, endMs });
    cursor = endMs;
  }
  return words;
}

export type TranscribeResult = { words: CaptionWord[]; language: string | null; seconds: number };

/** Speech to clean caption words, through the AI gateway's speech transport. */
export async function transcribeCaptions(input: {
  apiKey: string;
  bytes: Uint8Array;
  mime: string;
  language: CaptionLanguage;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}): Promise<TranscribeResult> {
  const raw = await transcribeSpeech({
    ...input,
    model: CAPTION_MODEL,
    fileName: `audio.${extensionForAudioMime(input.mime)}`,
    language: input.language === 'auto' ? null : input.language,
  });
  return {
    words: normalizeWords(raw.words, Math.round(CAPTION_AUDIO_MAX_SECONDS * 1000)),
    language: raw.language,
    seconds: raw.seconds,
  };
}
