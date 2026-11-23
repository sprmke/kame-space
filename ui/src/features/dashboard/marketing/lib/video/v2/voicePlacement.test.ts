import { describe, expect, it } from 'vitest';

import { VIDEO_V2_LIMITS } from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';
import {
  recordingRoomMs,
  recordingStartFrame,
  voicePlacement,
} from '@/features/dashboard/marketing/lib/video/v2/voicePlacement';

const base = { fps: 30, durationMs: 4000 };

describe('voicePlacement', () => {
  it('starts where record was pressed when both started together', () => {
    expect(
      voicePlacement({ ...base, startFrame: 60, recorderStartMs: 1000, playStartMs: 1000 })
    ).toEqual({
      from: 60,
      trimBeforeFrames: 0,
      durationInFrames: 120,
    });
  });

  it('shifts later when the recorder started after the video', () => {
    const placed = voicePlacement({
      ...base,
      startFrame: 60,
      recorderStartMs: 1100,
      playStartMs: 1000,
    });
    expect(placed.from).toBe(63);
  });

  it('shifts earlier when the recorder started first', () => {
    const placed = voicePlacement({
      ...base,
      startFrame: 60,
      recorderStartMs: 900,
      playStartMs: 1000,
    });
    expect(placed.from).toBe(57);
  });

  it('trims the part before the start of the video instead of going negative', () => {
    const placed = voicePlacement({
      ...base,
      startFrame: 0,
      recorderStartMs: 900,
      playStartMs: 1000,
    });
    expect(placed.from).toBe(0);
    expect(placed.trimBeforeFrames).toBe(3);
    expect(placed.durationInFrames).toBe(117);
  });

  it('stops at the 60 second cap', () => {
    const placed = voicePlacement({
      fps: 30,
      durationMs: 20_000,
      startFrame: VIDEO_V2_LIMITS.maxDurationFrames - 90,
      recorderStartMs: 0,
      playStartMs: 0,
    });
    expect(placed.from + placed.durationInFrames).toBeLessThanOrEqual(
      VIDEO_V2_LIMITS.maxDurationFrames
    );
  });

  it('never makes a clip shorter than the minimum', () => {
    const placed = voicePlacement({
      fps: 30,
      durationMs: 10,
      startFrame: 0,
      recorderStartMs: 0,
      playStartMs: 0,
    });
    expect(placed.durationInFrames).toBe(VIDEO_V2_LIMITS.minItemFrames);
  });
});

describe('recordingRoomMs', () => {
  it('is the time left until 60 seconds', () => {
    expect(recordingRoomMs(0, 30)).toBe(60_000);
    expect(recordingRoomMs(900, 30)).toBe(30_000);
    expect(recordingRoomMs(5000, 30)).toBe(0);
  });
});

describe('recordingStartFrame', () => {
  it('starts where the playhead is when there is room', () => {
    expect(recordingStartFrame(90, 300, 30)).toBe(90);
    expect(recordingStartFrame(0, 300, 30)).toBe(0);
  });

  it('starts from the beginning when less than a second is left', () => {
    expect(recordingStartFrame(290, 300, 30)).toBe(0);
    expect(recordingStartFrame(300, 300, 30)).toBe(0);
    expect(recordingStartFrame(271, 300, 30)).toBe(0);
  });

  it('keeps a start with exactly one second left', () => {
    expect(recordingStartFrame(270, 300, 30)).toBe(270);
  });

  it('survives odd input', () => {
    expect(recordingStartFrame(-5, 300, 30)).toBe(0);
    expect(recordingStartFrame(12.4, 300, 30)).toBe(12);
  });
});
