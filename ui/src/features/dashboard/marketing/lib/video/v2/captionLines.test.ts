import { describe, expect, it } from 'vitest';

import {
  evenWords,
  joinWords,
  splitCaption,
  withCaptionText,
} from '@/features/dashboard/marketing/lib/video/v2/captionLines';
import type { CaptionItem } from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';

const line = (): CaptionItem => ({
  id: 'c1',
  type: 'caption',
  from: 30,
  durationInFrames: 60,
  text: 'Welcome to our home',
  words: [
    { text: 'Welcome', startMs: 0, endMs: 500 },
    { text: 'to', startMs: 500, endMs: 800 },
    { text: 'our', startMs: 900, endMs: 1200 },
    { text: 'home', startMs: 1200, endMs: 2000 },
  ],
});

describe('joinWords', () => {
  it('joins with single spaces', () => {
    expect(joinWords(line().words)).toBe('Welcome to our home');
    expect(joinWords([])).toBe('');
  });
});

describe('evenWords', () => {
  it('spreads words over the time with no gaps or overlaps', () => {
    const words = evenWords('one two three', 3000);
    expect(words).toHaveLength(3);
    expect(words[0]).toEqual({ text: 'one', startMs: 0, endMs: 1000 });
    expect(words[2]!.endMs).toBe(3000);
    for (let i = 1; i < words.length; i += 1) expect(words[i]!.startMs).toBe(words[i - 1]!.endMs);
  });

  it('handles empty and very short input', () => {
    expect(evenWords('   ', 1000)).toEqual([]);
    const tiny = evenWords('a b c', 2);
    expect(tiny.every((w) => w.endMs > w.startMs)).toBe(true);
  });
});

describe('withCaptionText', () => {
  it('keeps the timing when only a word is fixed', () => {
    const fixed = withCaptionText(line(), 'Welcome to our house', 30);
    expect(fixed.text).toBe('Welcome to our house');
    expect(fixed.words.map((w) => w.startMs)).toEqual([0, 500, 900, 1200]);
    expect(fixed.words[3]!.text).toBe('house');
  });

  it('spreads the words again when the word count changes', () => {
    const changed = withCaptionText(line(), 'Welcome home', 30);
    expect(changed.words).toHaveLength(2);
    expect(changed.words[1]!.endMs).toBe(2000);
  });

  it('cleans spaces, caps the length and survives empty text', () => {
    expect(withCaptionText(line(), '  a   b  ', 30).text).toBe('a b');
    expect(withCaptionText(line(), 'x'.repeat(500), 30).text.length).toBe(200);
    const empty = withCaptionText(line(), '   ', 30);
    expect(empty.text).toBe('');
    expect(empty.words).toEqual([]);
  });
});

describe('splitCaption', () => {
  it('puts each word on one side and re-times the second side', () => {
    const parts = splitCaption(line(), 850)!;
    expect(parts[0].map((w) => w.text)).toEqual(['Welcome', 'to']);
    expect(parts[1].map((w) => w.text)).toEqual(['our', 'home']);
    expect(parts[1][0]!.startMs).toBe(50);
    expect(parts[0].every((w) => w.endMs <= 850)).toBe(true);
  });

  it('loses no word', () => {
    for (const cut of [100, 600, 1000, 1500]) {
      const parts = splitCaption(line(), cut);
      if (!parts) continue;
      expect(parts[0].length + parts[1].length).toBe(4);
    }
  });

  it('refuses a cut that leaves one side empty', () => {
    expect(splitCaption(line(), 10)).toBeNull();
    expect(splitCaption(line(), 1990)).toBeNull();
  });
});
