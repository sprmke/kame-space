import { describe, expect, it } from 'vitest';

import {
  captionLinesOf,
  deleteAllCaptions,
  hasCaptions,
  replaceCaptions,
} from '@/features/dashboard/marketing/lib/video/v2/captions/captionOps';
import { splitItems } from '@/features/dashboard/marketing/lib/video/v2/timelineOps';
import {
  VIDEO_V2_LIMITS,
  type CaptionItem,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';
import { photo, project, track } from '@/features/dashboard/marketing/lib/video/v2/videoV2Fixtures';

const line = (from: number, text = 'Hello there'): CaptionItem => ({
  id: `c${from}`,
  type: 'caption',
  from,
  durationInFrames: 60,
  text,
  words: [
    { text: 'Hello', startMs: 0, endMs: 1000 },
    { text: 'there', startMs: 1000, endMs: 2000 },
  ],
});

describe('replaceCaptions', () => {
  it('adds a captions track on top with the lines', () => {
    const p = project([track('main', [photo(300)])]);
    const result = replaceCaptions(p, [line(0), line(90)]);
    expect(result.ok).toBe(true);
    expect(hasCaptions(result.project)).toBe(true);
    expect(captionLinesOf(result.project)).toHaveLength(2);
    expect(result.project.tracks[result.project.tracks.length - 1]!.kind).toBe('captions');
  });

  it('replaces earlier captions and keeps the look the host chose', () => {
    const p = project([track('main', [photo(300)])]);
    const first = replaceCaptions(p, [line(0)]).project;
    const styled = {
      ...first,
      tracks: first.tracks.map((t) =>
        t.kind === 'captions'
          ? { ...t, captionStyle: { look: 'box' as const, y: 60, scale: 1.2 } }
          : t
      ),
    };
    const second = replaceCaptions(styled, [line(30, 'New'), line(120, 'Lines')]);
    expect(second.project.tracks.filter((t) => t.kind === 'captions')).toHaveLength(1);
    expect(captionLinesOf(second.project).map((l) => l.text)).toEqual(['New', 'Lines']);
    expect(second.project.tracks.find((t) => t.kind === 'captions')!.captionStyle?.look).toBe(
      'box'
    );
  });

  it('refuses nothing to add and a full project', () => {
    const p = project([track('main', [photo(300)])]);
    expect(replaceCaptions(p, []).ok).toBe(false);
    const full = project([
      track('main', [photo(300)]),
      ...Array.from({ length: VIDEO_V2_LIMITS.maxTracks - 1 }, () => track('overlay')),
    ]);
    expect(replaceCaptions(full, [line(0)]).reason).toBe('track_limit');
  });

  it('does not count caption lines against the clip limit', () => {
    const lines = Array.from({ length: 100 }, (_, i) => line(i * 3));
    const result = replaceCaptions(project([track('main', [photo(300)])]), lines);
    expect(result.ok).toBe(true);
    const clips = result.project.tracks
      .filter((t) => t.kind !== 'captions')
      .flatMap((t) => t.items);
    expect(clips).toHaveLength(1);
  });
});

describe('deleteAllCaptions', () => {
  it('removes the track in one step', () => {
    const p = replaceCaptions(project([track('main', [photo(300)])]), [line(0)]).project;
    const result = deleteAllCaptions(p);
    expect(result.ok).toBe(true);
    expect(hasCaptions(result.project)).toBe(false);
  });

  it('says so when there is nothing to delete', () => {
    expect(deleteAllCaptions(project([track('main', [photo(300)])])).ok).toBe(false);
  });
});

describe('splitting a caption line', () => {
  it('cuts the words with the line', () => {
    const p = replaceCaptions(project([track('main', [photo(300)])]), [line(0)]).project;
    const id = captionLinesOf(p)[0]!.id;
    const result = splitItems(p, [id], 30);
    expect(result.ok).toBe(true);
    const lines = captionLinesOf(result.project);
    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.text)).toEqual(['Hello', 'there']);
    expect(lines[1]!.words[0]!.startMs).toBeLessThan(100);
  });
});
