import { describe, expect, it } from 'vitest';

import { captionItemsFromWords } from '@/features/dashboard/marketing/lib/video/v2/captions/captionItems';
import {
  VIDEO_V2_LIMITS,
  type CaptionWord,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';

const w = (text: string, startMs: number, endMs: number): CaptionWord => ({ text, startMs, endMs });

describe('captionItemsFromWords', () => {
  it('puts each line where it is spoken', () => {
    const items = captionItemsFromWords(
      [w('Hello', 1000, 1300), w('there', 1300, 1600), w('Come', 4000, 4300), w('in', 4300, 4500)],
      { fps: 30 }
    );
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ type: 'caption', from: 30, text: 'Hello there' });
    expect(items[1]!.from).toBe(120);
  });

  it('times the words inside a line from the line start', () => {
    const [item] = captionItemsFromWords([w('Hello', 1000, 1300), w('there', 1300, 1600)], {
      fps: 30,
    });
    expect(item!.words[0]).toEqual({ text: 'Hello', startMs: 0, endMs: 300 });
    expect(item!.words[1]!.startMs).toBe(300);
    for (const word of item!.words) {
      expect(word.startMs).toBeGreaterThanOrEqual(0);
      expect(word.endMs).toBeGreaterThan(word.startMs);
    }
  });

  it('holds a line a moment after the last word but never into the next line', () => {
    const items = captionItemsFromWords(
      [w('One', 0, 300), w('two.', 300, 600), w('Three', 700, 900), w('four', 900, 1100)],
      { fps: 30 }
    );
    expect(items).toHaveLength(2);
    // The two lines are close together, so the first ends where the second starts.
    expect(items[0]!.from + items[0]!.durationInFrames).toBeLessThanOrEqual(items[1]!.from);
  });

  it('never overlaps, never goes backwards and respects the minimum length', () => {
    const rough = Array.from({ length: 30 }, (_, i) => w(`w${i}`, i * 100, i * 100 + 90));
    const items = captionItemsFromWords(rough, { fps: 30 });
    for (let i = 0; i < items.length; i += 1) {
      expect(items[i]!.durationInFrames).toBeGreaterThanOrEqual(VIDEO_V2_LIMITS.minItemFrames);
      if (i > 0)
        expect(items[i]!.from).toBeGreaterThanOrEqual(
          items[i - 1]!.from + items[i - 1]!.durationInFrames
        );
    }
  });

  it('stops at the end of the video and at the line limit', () => {
    const late = captionItemsFromWords([w('in', 1000, 1200), w('out', 70_000, 70_300)], {
      fps: 30,
    });
    expect(late).toHaveLength(1);
    for (const item of late) {
      expect(item.from + item.durationInFrames).toBeLessThanOrEqual(
        VIDEO_V2_LIMITS.maxDurationFrames
      );
    }
    const huge = Array.from({ length: 2000 }, (_, i) => w('a', i * 20, i * 20 + 15));
    expect(captionItemsFromWords(huge, { fps: 30 }).length).toBeLessThanOrEqual(
      VIDEO_V2_LIMITS.maxCaptionItems
    );
  });

  it('remembers where a line came from', () => {
    const [item] = captionItemsFromWords([w('Hi', 0, 200)], { fps: 30, sourceItemId: 'voice1' });
    expect(item!.sourceItemId).toBe('voice1');
  });

  it('makes nothing from no words', () => {
    expect(captionItemsFromWords([], { fps: 30 })).toEqual([]);
  });
});
