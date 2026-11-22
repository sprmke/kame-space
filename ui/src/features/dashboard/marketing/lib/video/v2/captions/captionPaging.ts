/**
 * Group spoken words into subtitle lines that are easy to read: a few words at a time, broken at
 * pauses and sentence ends. Pure, so the rules are unit tested.
 *
 * Plan: docs/workflow/in-progress/marketing-video-editor-mobile-first-refine.md §4.9.
 */

import type { CaptionWord } from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';

export type PagingOptions = {
  maxWords: number;
  maxChars: number;
  /** A pause this long starts a new line. */
  maxGapMs: number;
  /** A line stays on screen at most this long. */
  maxLineMs: number;
};

export const DEFAULT_PAGING: PagingOptions = {
  maxWords: 6,
  maxChars: 32,
  maxGapMs: 600,
  maxLineMs: 3500,
};

const SENTENCE_END = /[.!?…]["')\]]*$/;

export function pageWords(
  words: readonly CaptionWord[],
  options: PagingOptions = DEFAULT_PAGING
): CaptionWord[][] {
  const lines: CaptionWord[][] = [];
  let current: CaptionWord[] = [];

  const flush = () => {
    if (current.length > 0) lines.push(current);
    current = [];
  };

  for (const word of words) {
    const last = current[current.length - 1];
    if (last) {
      const chars = current.reduce((n, w) => n + w.text.length + 1, 0) + word.text.length;
      const tooMany = current.length >= options.maxWords;
      const tooLong = chars > options.maxChars;
      const pause = word.startMs - last.endMs > options.maxGapMs;
      const tooSlow = word.endMs - current[0]!.startMs > options.maxLineMs;
      const sentence = current.length >= 2 && SENTENCE_END.test(last.text);
      if (tooMany || tooLong || pause || tooSlow || sentence) flush();
    }
    current.push(word);
  }
  flush();
  return lines;
}
