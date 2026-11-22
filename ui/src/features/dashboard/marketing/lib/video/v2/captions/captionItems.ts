/**
 * Spoken words (in project time) to caption lines on the timeline.
 *
 * Words arrive in milliseconds from the start of the video. Each line becomes one caption clip
 * that starts at its first word and holds a moment past its last, never overlapping the next.
 */

import { joinWords } from '@/features/dashboard/marketing/lib/video/v2/captionLines';
import { pageWords } from '@/features/dashboard/marketing/lib/video/v2/captions/captionPaging';
import { newId } from '@/features/dashboard/marketing/lib/video/v2/timelineOps';
import {
  VIDEO_V2_LIMITS,
  type CaptionItem,
  type CaptionWord,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';

/** A line lingers this long after its last word, if the next line leaves room. */
const HOLD_FRAMES = 6;

export function captionItemsFromWords(
  words: readonly CaptionWord[],
  options: { fps: number; maxFrames?: number; sourceItemId?: string | null }
): CaptionItem[] {
  const { fps } = options;
  const maxFrames = options.maxFrames ?? VIDEO_V2_LIMITS.maxDurationFrames;
  const pages = pageWords(words);
  const items: CaptionItem[] = [];

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index]!;
    const first = page[0]!;
    const last = page[page.length - 1]!;
    const previous = items[items.length - 1];
    const floor = previous ? previous.from + previous.durationInFrames : 0;
    const from = Math.max(floor, Math.floor((first.startMs * fps) / 1000));
    if (from >= maxFrames) break;

    const nextPage = pages[index + 1];
    const nextStart = nextPage
      ? Math.floor((nextPage[0]!.startMs * fps) / 1000)
      : Number.POSITIVE_INFINITY;
    const spoken = Math.ceil((last.endMs * fps) / 1000);
    const end = Math.min(
      maxFrames,
      Math.max(from + VIDEO_V2_LIMITS.minItemFrames, Math.min(spoken + HOLD_FRAMES, nextStart))
    );
    const durationInFrames = Math.max(VIDEO_V2_LIMITS.minItemFrames, end - from);
    const fromMs = (from * 1000) / fps;

    const lineWords = page.slice(0, VIDEO_V2_LIMITS.maxCaptionWords).map((word) => ({
      text: word.text,
      startMs: Math.max(0, Math.round(word.startMs - fromMs)),
      endMs: Math.max(1, Math.round(word.endMs - fromMs)),
    }));
    const item: CaptionItem = {
      id: newId('item'),
      type: 'caption',
      from,
      durationInFrames,
      text: joinWords(lineWords).slice(0, VIDEO_V2_LIMITS.maxCaptionTextLength),
      words: lineWords,
    };
    if (options.sourceItemId) item.sourceItemId = options.sourceItemId;
    items.push(item);
    if (items.length >= VIDEO_V2_LIMITS.maxCaptionItems) break;
  }
  return items;
}
