/**
 * Caption line helpers: words to text, split a line at a time, and re-time a line when the host
 * edits its text. Pure, so the rules (no word lost, no overlap, times stay inside the line) are
 * unit tested.
 *
 * Plan: docs/workflow/in-progress/marketing-video-editor-mobile-first-refine.md §4.9.
 */

import {
  VIDEO_V2_LIMITS,
  type CaptionItem,
  type CaptionWord,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';

export function joinWords(words: readonly CaptionWord[]): string {
  return words
    .map((word) => word.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Words spread evenly over `durationMs`, for text that has no timing of its own. */
export function evenWords(text: string, durationMs: number): CaptionWord[] {
  const parts = text
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, VIDEO_V2_LIMITS.maxCaptionWords);
  if (parts.length === 0) return [];
  const slice = Math.max(1, Math.floor(durationMs / parts.length));
  return parts.map((part, index) => ({
    text: part,
    startMs: index * slice,
    endMs:
      index === parts.length - 1 ? Math.max(durationMs, index * slice + 1) : (index + 1) * slice,
  }));
}

/**
 * New text for a line. When the number of words is unchanged the timing stays, so fixing a
 * spelling does not move anything; otherwise the words are spread evenly over the line.
 */
export function withCaptionText(item: CaptionItem, rawText: string, fps: number): CaptionItem {
  const text = rawText.replace(/\s+/g, ' ').slice(0, VIDEO_V2_LIMITS.maxCaptionTextLength).trim();
  const parts = text.split(' ').filter(Boolean);
  const durationMs = Math.round((item.durationInFrames / fps) * 1000);
  if (parts.length === item.words.length && parts.length > 0) {
    return {
      ...item,
      text,
      words: item.words.map((word, index) => ({ ...word, text: parts[index]! })),
    };
  }
  return { ...item, text, words: evenWords(text, durationMs) };
}

/** Cut a line into two at `cutMs` after its start. Null when either side would be empty. */
export function splitCaption(
  item: CaptionItem,
  cutMs: number
): [CaptionItem['words'], CaptionItem['words']] | null {
  const first: CaptionWord[] = [];
  const second: CaptionWord[] = [];
  for (const word of item.words) {
    const middle = (word.startMs + word.endMs) / 2;
    if (middle < cutMs) {
      first.push({ ...word, endMs: Math.min(word.endMs, cutMs) });
    } else {
      second.push({
        ...word,
        startMs: Math.max(0, word.startMs - cutMs),
        endMs: Math.max(1, word.endMs - cutMs),
      });
    }
  }
  if (first.length === 0 || second.length === 0) return null;
  return [first, second];
}
