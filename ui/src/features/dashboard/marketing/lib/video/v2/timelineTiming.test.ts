import { describe, expect, it } from 'vitest';

import {
  allItems,
  audioItems,
  contentEndFrame,
  countItems,
  formatTimecode,
  isItemActiveAt,
  itemEnd,
  itemsActiveAt,
  layoutMainTrack,
  mainTrackOf,
  maxItemDurationFrames,
  peakVisibleVideos,
  projectDurationInFrames,
  sourceDurationFrames,
  sourceFramesForTimeline,
  timelineFramesForSource,
  topmostVisualAt,
} from '@/features/dashboard/marketing/lib/video/v2/timelineTiming';
import { caption, clip, photo, project, song, track } from '@/features/dashboard/marketing/lib/video/v2/videoV2Fixtures';
import { VIDEO_V2_FPS } from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';

describe('formatTimecode', () => {
  it('pads seconds and drops tenths by default', () => {
    expect(formatTimecode(0, 30)).toBe('0:00');
    expect(formatTimecode(30, 30)).toBe('0:01');
    expect(formatTimecode(7 * 30, 30)).toBe('0:07');
    expect(formatTimecode(75 * 30, 30)).toBe('1:15');
  });

  it('adds tenths on request', () => {
    expect(formatTimecode(45, 30, true)).toBe('0:01.5');
    expect(formatTimecode(30, 30, true)).toBe('0:01.0');
  });

  it('never goes negative and survives a zero fps', () => {
    expect(formatTimecode(-30, 30)).toBe('0:00');
    expect(formatTimecode(30, 0)).toBe('0:00');
  });
});

describe('itemEnd / isItemActiveAt', () => {
  it('is exclusive at the end of a clip', () => {
    const item = { from: 10, durationInFrames: 5 };

    expect(itemEnd(item)).toBe(15);
    expect(isItemActiveAt(item, 9)).toBe(false);
    expect(isItemActiveAt(item, 10)).toBe(true);
    expect(isItemActiveAt(item, 14)).toBe(true);
    expect(isItemActiveAt(item, 15)).toBe(false);
  });
});

describe('layoutMainTrack', () => {
  it('packs clips back to back when there are no transitions', () => {
    const laidOut = layoutMainTrack([photo(90), photo(60), photo(30)]);

    expect(laidOut.map((item) => item.from)).toEqual([0, 90, 150]);
  });

  it('overlaps a clip by its transition, capped at half the shorter clip', () => {
    const laidOut = layoutMainTrack([
      photo(90),
      photo(60, { transitionIn: { type: 'fade', durationInFrames: 15 } }),
    ]);

    expect(laidOut[1]?.from).toBe(75);
  });

  it('caps a greedy transition at half the shorter neighbouring clip', () => {
    const laidOut = layoutMainTrack([
      photo(90),
      photo(10, { transitionIn: { type: 'fade', durationInFrames: 15 } }),
    ]);

    // min(90, 10) / 2 = 5
    expect(laidOut[1]?.from).toBe(85);
  });

  it('ignores a none or zero-length transition', () => {
    const noTransition = layoutMainTrack([
      photo(90),
      photo(60, { transitionIn: { type: 'none', durationInFrames: 15 } }),
    ]);
    const zeroLength = layoutMainTrack([
      photo(90),
      photo(60, { transitionIn: { type: 'fade', durationInFrames: 0 } }),
    ]);

    expect(noTransition[1]?.from).toBe(90);
    expect(zeroLength[1]?.from).toBe(90);
  });

  it('returns a new array only when a `from` actually changed', () => {
    const first = photo(90);
    const second = photo(60);
    const laidOut = layoutMainTrack([first, second]);

    expect(laidOut[0]).toBe(first);
    expect(laidOut[1]).not.toBe(second);
  });
});

describe('project geometry', () => {
  it('finds the main track, falling back to the first', () => {
    const main = track('main', [photo(30)]);
    expect(mainTrackOf(project([track('audio'), main]))).toBe(main);

    const only = track('overlay');
    expect(mainTrackOf(project([only]))).toBe(only);
  });

  it('reports the furthest used frame across tracks', () => {
    const value = project([
      track('main', [photo(90)]),
      track('text', [caption(100, 30)]),
      track('audio', [song(0, 120)]),
    ]);

    expect(contentEndFrame(value)).toBe(130);
    expect(contentEndFrame(project())).toBe(0);
  });

  it('clamps the composition between the player minimum and the 60 s cap', () => {
    expect(projectDurationInFrames(project([track('main', [photo(10)])]))).toBe(2 * VIDEO_V2_FPS);
    expect(projectDurationInFrames(project([track('main', [photo(30 * 90)])]))).toBe(
      60 * VIDEO_V2_FPS
    );
    expect(projectDurationInFrames(project([track('main', [photo(300)])]))).toBe(300);
  });

  it('counts and lists items across every track', () => {
    const value = project([
      track('main', [photo(90)]),
      track('text', [caption(), caption()]),
      track('audio', [song()]),
    ]);

    expect(countItems(value)).toBe(4);
    expect(allItems(value)).toHaveLength(4);
    expect(audioItems(value)).toHaveLength(1);
  });
});

describe('active items', () => {
  const mainItem = photo(90);
  const textItem = caption(0, 30);
  const audioItem = song(0, 120);

  const value = project([
    track('main', [mainItem]),
    track('text', [textItem]),
    track('audio', [audioItem]),
  ]);

  it('reports every track with an item at the frame, bottom first', () => {
    expect(itemsActiveAt(value, 10).map((active) => active.trackIndex)).toEqual([0, 1, 2]);
    expect(itemsActiveAt(value, 100).map((active) => active.trackIndex)).toEqual([2]);
  });

  it('picks the topmost visual item and skips audio', () => {
    expect(topmostVisualAt(value, 10)?.item).toBe(textItem);
    expect(topmostVisualAt(value, 50)?.item).toBe(mainItem);
  });

  it('skips hidden tracks when picking a visual', () => {
    const hidden = project([
      track('main', [mainItem]),
      track('text', [textItem], { hidden: true }),
    ]);

    expect(topmostVisualAt(hidden, 10)?.item).toBe(mainItem);
  });

  it('returns null when nothing is on screen', () => {
    expect(topmostVisualAt(project(), 0)).toBeNull();
  });
});

describe('source duration and speed', () => {
  it('converts source milliseconds to frames, or null when unknown', () => {
    expect(sourceDurationFrames({ durationMs: 1000 }, 30)).toBe(30);
    expect(sourceDurationFrames({ durationMs: 1500 }, 30)).toBe(45);
    expect(sourceDurationFrames({}, 30)).toBeNull();
    expect(sourceDurationFrames({ durationMs: 0 }, 30)).toBeNull();
    expect(sourceDurationFrames({ durationMs: Number.NaN }, 30)).toBeNull();
  });

  it('treats stills, layers and looping audio as unbounded', () => {
    expect(maxItemDurationFrames(photo(), 30)).toBe(Number.POSITIVE_INFINITY);
    expect(maxItemDurationFrames(caption(), 30)).toBe(Number.POSITIVE_INFINITY);
    expect(maxItemDurationFrames(song(0, 60, 10, { loop: true }), 30)).toBe(
      Number.POSITIVE_INFINITY
    );
  });

  it('caps a video by its source, trim and playback rate', () => {
    expect(maxItemDurationFrames(clip(90, 10), 30)).toBe(300);
    expect(maxItemDurationFrames(clip(90, 10, { trimBeforeFrames: 60 }), 30)).toBe(240);
    expect(maxItemDurationFrames(clip(90, 10, { playbackRate: 2 }), 30)).toBe(150);
  });

  it('never drops below the minimum item length', () => {
    expect(maxItemDurationFrames(clip(90, 0.05), 30)).toBe(3);
  });

  it('converts between source and timeline frames at a rate', () => {
    expect(timelineFramesForSource(300, 2)).toBe(150);
    expect(timelineFramesForSource(300, 0)).toBe(300);
    expect(sourceFramesForTimeline(150, 2)).toBe(300);
    expect(sourceFramesForTimeline(150, 0)).toBe(150);
  });
});

describe('peakVisibleVideos', () => {
  it('is zero for an empty project', () => {
    expect(peakVisibleVideos(project())).toBe(0);
  });

  it('counts the deepest stack of visible video clips', () => {
    const value = project([
      track('main', [clip(60), clip(60, 10, { from: 60 })]),
      track('overlay', [clip(40, 10, { from: 10 })]),
    ]);

    expect(peakVisibleVideos(value)).toBe(2);
  });

  it('ignores hidden tracks and audio', () => {
    const value = project([
      track('main', [clip(60)]),
      track('overlay', [clip(60)], { hidden: true }),
      track('audio', [song()]),
    ]);

    expect(peakVisibleVideos(value)).toBe(1);
  });
});
