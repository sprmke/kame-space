import { describe, expect, it } from 'vitest';

import {
  captionSourcesOf,
  CAPTION_SAMPLE_RATE,
  countCaptionSources,
  downmixToMono,
  encodeWavMono16,
  mixInto,
  resampleLinear,
} from '@/features/dashboard/marketing/lib/video/v2/captions/captionAudio';
import {
  clip,
  photo,
  project,
  song,
  track,
} from '@/features/dashboard/marketing/lib/video/v2/videoV2Fixtures';

const p = () =>
  project([
    track('main', [clip(150, 10), clip(60, 10, { muted: true }), photo(60)]),
    track('audio', [
      song(0, 300, 30),
      song(30, 90, 10, { role: 'voice', volume: 1 }),
      song(0, 60, 10, { role: 'sound', sourceItemId: 'v' }),
      song(0, 30, 10, { role: 'voice', volume: 0 }),
    ]),
  ]);

describe('captionSourcesOf', () => {
  it('picks voice recordings, video sound, or both, and never music', () => {
    expect(captionSourcesOf(p(), 'voice').map((s) => s.kind)).toEqual(['voice']);
    expect(captionSourcesOf(p(), 'video').map((s) => s.kind)).toEqual(['video', 'video']);
    expect(captionSourcesOf(p(), 'both')).toHaveLength(3);
  });

  it('skips muted clips, silent clips, muted tracks and clips without media', () => {
    const muted = project([
      track('main', [clip(60, 10)]),
      track('audio', [song(0, 60, 10, { role: 'voice', volume: 1 })], { muted: true }),
    ]);
    expect(captionSourcesOf(muted, 'voice')).toEqual([]);
    const noMedia = project([
      track('main', [clip(60, 10, { media: { url: '', source: 'library' } })]),
    ]);
    expect(captionSourcesOf(noMedia, 'video')).toEqual([]);
  });

  it('counts what is available for the sheet', () => {
    expect(countCaptionSources(p())).toEqual({ voice: 1, video: 2 });
  });
});

describe('downmixToMono', () => {
  it('averages channels and passes mono through', () => {
    const mono = new Float32Array([0.5, -0.5]);
    expect(downmixToMono([mono])).toBe(mono);
    const mixed = downmixToMono([new Float32Array([1, 0]), new Float32Array([0, 1])]);
    expect(Array.from(mixed)).toEqual([0.5, 0.5]);
  });
});

describe('resampleLinear', () => {
  it('changes the length with the rate and with speed', () => {
    const input = new Float32Array(48_000).fill(0.25);
    expect(resampleLinear(input, 48_000, 16_000).length).toBeCloseTo(16_000, -1);
    expect(resampleLinear(input, 48_000, 16_000, 2).length).toBeCloseTo(8_000, -1);
  });

  it('keeps a constant signal constant and interpolates a ramp', () => {
    const flat = resampleLinear(new Float32Array(100).fill(0.5), 100, 50);
    expect(flat.every((v) => Math.abs(v - 0.5) < 1e-6)).toBe(true);
    const ramp = resampleLinear(new Float32Array([0, 1, 2, 3]), 4, 2);
    expect(Array.from(ramp)).toEqual([0, 2]);
  });

  it('survives empty or nonsense input', () => {
    expect(resampleLinear(new Float32Array(0), 48_000, 16_000).length).toBe(0);
    expect(resampleLinear(new Float32Array(10), 0, 16_000).length).toBe(0);
    expect(resampleLinear(new Float32Array(10), 48_000, 16_000, 0).length).toBe(0);
  });
});

describe('mixInto', () => {
  it('adds at the position with gain and never writes past the end', () => {
    const target = new Float32Array(6);
    mixInto(target, new Float32Array([1, 1, 1, 1]), 4, 0.5);
    expect(Array.from(target)).toEqual([0, 0, 0, 0, 0.5, 0.5]);
    mixInto(target, new Float32Array([1]), 0, 1);
    expect(target[0]).toBe(1);
    mixInto(target, new Float32Array([1]), -3, 1);
    expect(target[0]).toBe(2);
  });
});

describe('encodeWavMono16', () => {
  it('writes a valid header and clips to the legal range', () => {
    const wav = encodeWavMono16(new Float32Array([0, 1, -1, 2, -2]), CAPTION_SAMPLE_RATE);
    const view = new DataView(wav.buffer);
    const tag = (at: number) => String.fromCharCode(...wav.slice(at, at + 4));
    expect(tag(0)).toBe('RIFF');
    expect(tag(8)).toBe('WAVE');
    expect(tag(36)).toBe('data');
    expect(view.getUint32(24, true)).toBe(CAPTION_SAMPLE_RATE);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(40, true)).toBe(10);
    expect(wav.length).toBe(54);
    expect(view.getInt16(46, true)).toBe(0x7fff);
    expect(view.getInt16(48, true)).toBe(-0x8000);
    expect(view.getInt16(50, true)).toBe(0x7fff);
    expect(view.getInt16(52, true)).toBe(-0x8000);
  });

  it('fits a full 60 second video under the upload cap', () => {
    const sixty = 60 * CAPTION_SAMPLE_RATE * 2 + 44;
    expect(sixty).toBeLessThan(2 * 1024 * 1024);
  });
});
