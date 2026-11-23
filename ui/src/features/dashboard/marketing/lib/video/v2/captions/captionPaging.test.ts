import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PAGING,
  pageWords,
} from '@/features/dashboard/marketing/lib/video/v2/captions/captionPaging';
import type { CaptionWord } from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';

const words = (specs: Array<[string, number, number]>): CaptionWord[] =>
  specs.map(([text, startMs, endMs]) => ({ text, startMs, endMs }));

const texts = (lines: CaptionWord[][]) => lines.map((line) => line.map((w) => w.text).join(' '));

describe('pageWords', () => {
  it('keeps a short phrase on one line', () => {
    const lines = pageWords(
      words([
        ['Welcome', 0, 400],
        ['home', 400, 800],
      ])
    );
    expect(texts(lines)).toEqual(['Welcome home']);
  });

  it('starts a new line after a pause', () => {
    const lines = pageWords(
      words([
        ['Hello', 0, 300],
        ['there', 300, 600],
        ['Come', 2000, 2300],
        ['in', 2300, 2500],
      ])
    );
    expect(texts(lines)).toEqual(['Hello there', 'Come in']);
  });

  it('breaks at the end of a sentence once the line has a couple of words', () => {
    const lines = pageWords(
      words([
        ['We', 0, 100],
        ['love', 100, 300],
        ['it.', 300, 500],
        ['Book', 500, 700],
        ['now', 700, 900],
      ])
    );
    expect(texts(lines)).toEqual(['We love it.', 'Book now']);
  });

  it('does not break after a single word that ends in a full stop', () => {
    const lines = pageWords(
      words([
        ['Wow.', 0, 200],
        ['Great', 200, 400],
        ['stay', 400, 600],
      ])
    );
    expect(texts(lines)).toEqual(['Wow. Great stay']);
  });

  it('limits words, characters and time per line', () => {
    const many = Array.from({ length: 14 }, (_, i): [string, number, number] => [
      'word',
      i * 200,
      i * 200 + 150,
    ]);
    for (const line of pageWords(words(many)))
      expect(line.length).toBeLessThanOrEqual(DEFAULT_PAGING.maxWords);
    const long = pageWords(
      words([
        ['extraordinarily', 0, 300],
        ['accommodating', 300, 600],
        ['hospitality', 600, 900],
      ])
    );
    expect(long.length).toBeGreaterThan(1);
    const slow = pageWords(
      words([
        ['one', 0, 1500],
        ['two', 1500, 3000],
        ['three', 3000, 4500],
      ])
    );
    expect(slow.length).toBeGreaterThan(1);
  });

  it('loses no word and keeps the order', () => {
    const input = Array.from({ length: 40 }, (_, i): [string, number, number] => [
      `w${i}`,
      i * 150,
      i * 150 + 120,
    ]);
    const flat = pageWords(words(input))
      .flat()
      .map((w) => w.text);
    expect(flat).toEqual(input.map(([text]) => text));
  });

  it('handles nothing', () => {
    expect(pageWords([])).toEqual([]);
  });
});
