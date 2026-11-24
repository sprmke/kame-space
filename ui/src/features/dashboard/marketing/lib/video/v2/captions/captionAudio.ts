/**
 * Audio for auto captions: pick the clips that carry speech, and build one small mono recording of
 * the whole video from them, so the words come back already in project time.
 *
 * This file is the pure part (which clips, mixing, resampling, WAV). Decoding the files happens in
 * `captionAudioBrowser.ts`.
 */

import { audioRoleOf } from '@/features/dashboard/marketing/lib/video/v2/audioDucking';
import {
  isAudioItem,
  isMediaItem,
  type AudioItem,
  type MediaItem,
  type VideoProjectV2,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';

/** Whisper works at 16 kHz mono. 60 s of 16-bit mono is 1.92 MB, under the 2 MiB upload cap. */
export const CAPTION_SAMPLE_RATE = 16_000;

export type CaptionSourceMode = 'voice' | 'video' | 'both';

export type CaptionSource = {
  item: AudioItem | MediaItem;
  kind: 'voice' | 'video';
};

export type CaptionSourceCounts = { voice: number; video: number };

/** Clips that can be heard and might hold speech: voice recordings, and video sound. */
export function captionSourcesOf(
  project: VideoProjectV2,
  mode: CaptionSourceMode
): CaptionSource[] {
  const wantsVoice = mode === 'voice' || mode === 'both';
  const wantsVideo = mode === 'video' || mode === 'both';
  const sources: CaptionSource[] = [];
  for (const track of project.tracks) {
    if (track.muted || track.hidden) continue;
    for (const item of track.items) {
      if (isAudioItem(item)) {
        const role = audioRoleOf(item);
        if (item.volume <= 0 || !item.media.url) continue;
        if (role === 'voice' && wantsVoice) sources.push({ item, kind: 'voice' });
        // Sound separated from a video is still the video's own sound.
        if (role === 'sound' && wantsVideo) sources.push({ item, kind: 'video' });
      } else if (isMediaItem(item) && item.type === 'video' && wantsVideo) {
        if (item.muted || (item.volume ?? 1) <= 0 || !item.media.url) continue;
        sources.push({ item, kind: 'video' });
      }
    }
  }
  return sources.sort((a, b) => a.item.from - b.item.from);
}

export function countCaptionSources(project: VideoProjectV2): CaptionSourceCounts {
  return {
    voice: captionSourcesOf(project, 'voice').length,
    video: captionSourcesOf(project, 'video').length,
  };
}

/** Average the channels into one. */
export function downmixToMono(channels: readonly Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0]!;
  const length = channels[0]?.length ?? 0;
  const out = new Float32Array(length);
  for (const channel of channels) {
    for (let i = 0; i < length; i += 1) out[i]! += channel[i]! / channels.length;
  }
  return out;
}

/**
 * Resample with linear interpolation. `speed` above 1 plays the source faster (shorter output),
 * which is how a sped up video clip is heard. Pitch follows speed, which Whisper copes with.
 */
export function resampleLinear(
  input: Float32Array,
  fromRate: number,
  toRate: number,
  speed = 1
): Float32Array {
  if (input.length === 0 || fromRate <= 0 || toRate <= 0 || speed <= 0) return new Float32Array(0);
  const step = (fromRate * speed) / toRate;
  const length = Math.max(0, Math.floor((input.length - 1) / step) + 1);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const position = i * step;
    const index = Math.floor(position);
    const next = Math.min(input.length - 1, index + 1);
    const fraction = position - index;
    out[i] = input[index]! * (1 - fraction) + input[next]! * fraction;
  }
  return out;
}

/** Add `samples` into `target` starting at `atSample`, scaled by `gain`. Never writes past the end. */
export function mixInto(
  target: Float32Array,
  samples: Float32Array,
  atSample: number,
  gain: number
): void {
  const start = Math.max(0, Math.round(atSample));
  const count = Math.min(samples.length, target.length - start);
  for (let i = 0; i < count; i += 1) target[start + i]! += samples[i]! * gain;
}

/** 16-bit PCM mono WAV. Samples are clipped to the legal range. */
export function encodeWavMono16(samples: Float32Array, sampleRate: number): Uint8Array {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i += 1) {
    const clipped = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(44 + i * 2, clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff, true);
  }
  return new Uint8Array(buffer);
}
