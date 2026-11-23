import { describe, expect, it } from 'vitest';

import {
  audioRoleOf,
  DUCK_LEVEL,
  DUCK_RAMP_FRAMES,
  duckFactor,
  shouldDuck,
  voiceRangesOf,
} from '@/features/dashboard/marketing/lib/video/v2/audioDucking';
import {
  photo,
  project,
  song,
  track,
} from '@/features/dashboard/marketing/lib/video/v2/videoV2Fixtures';

describe('audioRoleOf', () => {
  it('treats old clips as music and separated sound as sound', () => {
    expect(audioRoleOf(song())).toBe('music');
    expect(audioRoleOf(song(0, 60, 10, { sourceItemId: 'vid1' }))).toBe('sound');
    expect(audioRoleOf(song(0, 60, 10, { role: 'voice' }))).toBe('voice');
  });
});

describe('shouldDuck', () => {
  it('lowers music unless the host turned it off, and never lowers voice or sound', () => {
    expect(shouldDuck(song())).toBe(true);
    expect(shouldDuck(song(0, 60, 10, { duckUnderVoice: false }))).toBe(false);
    expect(shouldDuck(song(0, 60, 10, { role: 'voice' }))).toBe(false);
    expect(shouldDuck(song(0, 60, 10, { role: 'sound' }))).toBe(false);
  });
});

describe('voiceRangesOf', () => {
  it('lists voice clips in time order and skips muted tracks and silent clips', () => {
    const late = song(200, 50, 10, { role: 'voice', volume: 1 });
    const early = song(30, 60, 10, { role: 'voice', volume: 1 });
    const silent = song(100, 30, 10, { role: 'voice', volume: 0 });
    const music = song(0, 300, 30);
    const p = project([
      track('main', [photo(300)]),
      track('audio', [late, early, silent, music]),
      track('audio', [song(0, 50, 10, { role: 'voice', volume: 1 })], { muted: true }),
    ]);
    expect(voiceRangesOf(p)).toEqual([
      { from: 30, to: 90 },
      { from: 200, to: 250 },
    ]);
  });
});

describe('duckFactor', () => {
  const ranges = [{ from: 100, to: 200 }];

  it('is full volume away from the voice and quiet under it', () => {
    expect(duckFactor(0, ranges)).toBe(1);
    expect(duckFactor(150, ranges)).toBe(DUCK_LEVEL);
    expect(duckFactor(100, ranges)).toBe(DUCK_LEVEL);
    expect(duckFactor(200, ranges)).toBe(DUCK_LEVEL);
    expect(duckFactor(500, ranges)).toBe(1);
  });

  it('fades down before the voice and back up after it', () => {
    const half = duckFactor(100 - DUCK_RAMP_FRAMES / 2, ranges);
    expect(half).toBeGreaterThan(DUCK_LEVEL);
    expect(half).toBeLessThan(1);
    expect(duckFactor(100 - DUCK_RAMP_FRAMES, ranges)).toBe(1);
    expect(duckFactor(200 + 1, ranges)).toBeLessThan(duckFactor(200 + 5, ranges));
    expect(duckFactor(200 + DUCK_RAMP_FRAMES, ranges)).toBe(1);
  });

  it('uses the quietest of overlapping voices and ignores no voice at all', () => {
    expect(
      duckFactor(150, [
        { from: 0, to: 300 },
        { from: 140, to: 160 },
      ])
    ).toBe(DUCK_LEVEL);
    expect(duckFactor(150, [])).toBe(1);
  });

  it('never leaves the 0 to 1 range', () => {
    for (let frame = 0; frame < 400; frame += 7) {
      const value = duckFactor(frame, ranges);
      expect(value).toBeGreaterThanOrEqual(DUCK_LEVEL);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('can switch the ramp off', () => {
    expect(duckFactor(99, ranges, 0.25, 0)).toBe(1);
    expect(duckFactor(100, ranges, 0.25, 0)).toBe(0.25);
  });
});
