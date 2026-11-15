import { describe, expect, it } from 'vitest';

import { beatsOnTimeline, cutToBeats } from '@/features/dashboard/marketing/lib/video/v2/beatCuts';
import { normalizeProject } from '@/features/dashboard/marketing/lib/video/v2/timelineOps';
import {
  caption,
  clip,
  photo,
  project,
  song,
  track,
} from '@/features/dashboard/marketing/lib/video/v2/videoV2Fixtures';

const FPS = 30;

function reel() {
  const a = photo(90);
  const b = photo(90);
  const c = photo(90);
  const text = caption(90, 90, 'second');
  return normalizeProject(project([track('main', [a, b, c]), track('text', [text])]));
}

const mainEnds = (p: ReturnType<typeof reel>) =>
  p.tracks[0]!.items.map((i) => i.from + i.durationInFrames);

describe('cutToBeats', () => {
  it('moves each cut to the nearest beat and keeps the total length', () => {
    const p = reel();
    const { project: next, moved } = cutToBeats(p, [3.2, 6.1]);
    expect(moved).toBe(2);
    const ends = mainEnds(next);
    expect(ends[0]).toBe(Math.round(3.2 * FPS));
    expect(ends[1]).toBe(Math.round(6.1 * FPS));
    expect(ends[2]).toBe(270);
  });

  it('moves a caption that sat on the cut', () => {
    const { project: next } = cutToBeats(reel(), [3.2, 6.1]);
    const text = next.tracks[1]!.items[0]!;
    expect(text.from).toBe(Math.round(3.2 * FPS));
    expect(text.from + text.durationInFrames).toBe(Math.round(6.1 * FPS));
  });

  it('ignores beats farther than the tolerance', () => {
    const p = reel();
    expect(cutToBeats(p, [4.5]).moved).toBe(0);
    expect(cutToBeats(p, [4.5]).project).toBe(p);
  });

  it('never leaves a clip shorter than the minimum', () => {
    const p = reel();
    // 2.9 s then 3.1 s would crush the middle clip to 0.2 s.
    const { project: next } = cutToBeats(p, [3.3, 3.5]);
    for (const item of next.tracks[0]!.items) {
      expect(item.durationInFrames).toBeGreaterThanOrEqual(Math.round(0.8 * FPS));
    }
  });

  it('will not stretch a video past its source', () => {
    const short = clip(90, 3.1);
    const p = normalizeProject(project([track('main', [short, photo(90)])]));
    expect(cutToBeats(p, [3.3]).moved).toBe(0);
  });

  it('does nothing with one clip or no beats', () => {
    const one = normalizeProject(project([track('main', [photo(90)])]));
    expect(cutToBeats(one, [1]).moved).toBe(0);
    expect(cutToBeats(reel(), []).moved).toBe(0);
  });
});

describe('beatsOnTimeline', () => {
  it('shifts source beats by the clip start and trim and drops those outside', () => {
    const audio = song(30, 90, 30, { trimBeforeFrames: 30 });
    // Source beats at 0.5 (trimmed away), 1.5, 2.5, 5 (past the clip end).
    expect(beatsOnTimeline([0.5, 1.5, 2.5, 5], audio, FPS)).toEqual([1.5, 2.5]);
  });
});
