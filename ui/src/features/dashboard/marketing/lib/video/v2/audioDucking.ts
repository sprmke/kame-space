/**
 * Music that gets quieter while someone talks.
 *
 * Pure functions: where the voice is, and how loud the music should be at a frame. The composition
 * multiplies this into each music clip's volume, so preview and export agree.
 *
 * Plan: docs/workflow/in-progress/marketing-video-editor-mobile-first-refine.md §4.7.
 */

import {
  isAudioItem,
  type AudioItem,
  type AudioRole,
  type VideoProjectV2,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';

/** Music plays at this share of its volume while a voice is on. */
export const DUCK_LEVEL = 0.25;
/** The music fades down and back up over 0.3 s at 30 fps. */
export const DUCK_RAMP_FRAMES = 9;

export type FrameRange = { from: number; to: number };

/** Clips from the library and from Jamendo are music; sound separated from a video is sound. */
export function audioRoleOf(item: AudioItem): AudioRole {
  if (item.role) return item.role;
  return item.sourceItemId ? 'sound' : 'music';
}

export function shouldDuck(item: AudioItem): boolean {
  return audioRoleOf(item) === 'music' && item.duckUnderVoice !== false;
}

/** Where a voice can be heard: voice clips on tracks that are not muted, with sound on. */
export function voiceRangesOf(project: VideoProjectV2): FrameRange[] {
  const ranges: FrameRange[] = [];
  for (const track of project.tracks) {
    if (track.muted) continue;
    for (const item of track.items) {
      if (!isAudioItem(item) || audioRoleOf(item) !== 'voice') continue;
      if (item.volume <= 0 || !item.media.url) continue;
      ranges.push({ from: item.from, to: item.from + item.durationInFrames });
    }
  }
  return ranges.sort((a, b) => a.from - b.from);
}

/**
 * Volume multiplier for music at a project frame: 1 away from any voice, `level` under it, and a
 * straight ramp in between. With several voice clips the quietest wins.
 */
export function duckFactor(
  frame: number,
  ranges: readonly FrameRange[],
  level: number = DUCK_LEVEL,
  ramp: number = DUCK_RAMP_FRAMES
): number {
  let factor = 1;
  for (const range of ranges) {
    const distance =
      frame < range.from ? range.from - frame : frame > range.to ? frame - range.to : 0;
    const next =
      ramp <= 0
        ? distance === 0
          ? level
          : 1
        : distance >= ramp
          ? 1
          : level + (1 - level) * (distance / ramp);
    if (next < factor) factor = next;
  }
  return factor;
}
