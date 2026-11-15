import { describe, expect, it } from 'vitest';

import { detectBeats, mixToMono } from '@/features/dashboard/marketing/lib/media/beats';

const RATE = 8000;

/** A click (short decaying burst) at each time, on silence. */
function clicks(timesSec: number[], seconds: number): Float32Array {
  const samples = new Float32Array(RATE * seconds);
  for (const t of timesSec) {
    const start = Math.round(t * RATE);
    for (let i = 0; i < 400 && start + i < samples.length; i += 1) {
      samples[start + i] = Math.sin(i * 0.9) * (1 - i / 400);
    }
  }
  return samples;
}

describe('detectBeats', () => {
  it('finds evenly spaced clicks within a few hops', () => {
    const times = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5];
    const beats = detectBeats(clicks(times, 4), RATE);
    expect(beats).toHaveLength(times.length);
    beats.forEach((beat, i) => expect(Math.abs(beat - times[i]!)).toBeLessThan(0.05));
  });

  it('merges clicks closer than the minimum gap', () => {
    const beats = detectBeats(clicks([0.5, 0.6, 1.5, 2.5], 3.5), RATE);
    expect(beats.filter((b) => b < 1)).toHaveLength(1);
  });

  it('returns nothing for silence and for clips under a second', () => {
    expect(detectBeats(new Float32Array(RATE * 3), RATE)).toEqual([]);
    expect(detectBeats(new Float32Array(100), RATE)).toEqual([]);
  });
});

describe('mixToMono', () => {
  it('averages channels', () => {
    expect(
      Array.from(
        mixToMono([
          [1, 0],
          [0, 1],
        ])
      )
    ).toEqual([0.5, 0.5]);
  });
});
