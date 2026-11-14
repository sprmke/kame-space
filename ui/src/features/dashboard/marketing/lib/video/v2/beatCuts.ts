/**
 * Snap the cuts between main-track clips onto music beats. Pure: the caller supplies beat times
 * in timeline seconds. The project length never changes, only where the cuts fall.
 */

import { normalizeProject } from '@/features/dashboard/marketing/lib/video/v2/timelineOps';
import {
  itemEnd,
  mainTrackOf,
  maxItemDurationFrames,
} from '@/features/dashboard/marketing/lib/video/v2/timelineTiming';
import {
  isAudioItem,
  isMediaItem,
  VIDEO_V2_LIMITS,
  type AudioItem,
  type MediaItem,
  type VideoItem,
  type VideoProjectV2,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';

/** A cut moves at most this far to reach a beat. */
export const BEAT_CUT_TOLERANCE_SEC = 0.6;
/** A beat cut never leaves a clip shorter than this. */
export const BEAT_CUT_MIN_CLIP_SEC = 0.8;

export type BeatCutResult = { project: VideoProjectV2; moved: number };

/** Timeline seconds of the beats that fall inside an audio clip's audible span. */
export function beatsOnTimeline(
  sourceBeatsSec: number[],
  audio: Pick<AudioItem, 'from' | 'durationInFrames' | 'trimBeforeFrames'>,
  fps: number
): number[] {
  const trim = (audio.trimBeforeFrames ?? 0) / fps;
  const start = audio.from / fps;
  const end = (audio.from + audio.durationInFrames) / fps;
  return sourceBeatsSec.map((beat) => start + beat - trim).filter((t) => t >= start && t <= end);
}

function nearest(sorted: number[], target: number): number | null {
  let best: number | null = null;
  for (const value of sorted) {
    if (best === null || Math.abs(value - target) < Math.abs(best - target)) best = value;
  }
  return best;
}

export function cutToBeats(
  project: VideoProjectV2,
  beatsSec: number[],
  options: { toleranceSec?: number; minClipSec?: number } = {}
): BeatCutResult {
  const { fps } = project;
  const tolerance = Math.round((options.toleranceSec ?? BEAT_CUT_TOLERANCE_SEC) * fps);
  const minClip = Math.max(
    VIDEO_V2_LIMITS.minItemFrames,
    Math.round((options.minClipSec ?? BEAT_CUT_MIN_CLIP_SEC) * fps)
  );
  const main = mainTrackOf(project);
  const clips = main.items.filter(isMediaItem);
  if (clips.length < 2 || beatsSec.length === 0) return { project, moved: 0 };

  const beats = beatsSec.map((s) => Math.round(s * fps)).sort((a, b) => a - b);
  const oldEnds = clips.map((clip) => itemEnd(clip));
  const durations = clips.map((clip) => clip.durationInFrames);
  const shifts = clips.map(() => 0);
  let moved = 0;

  // Every cut except the last clip's end, which stays the project's end.
  for (let k = 0; k < clips.length - 1; k += 1) {
    const beat = nearest(beats, oldEnds[k]!);
    if (beat === null) continue;
    const shift = beat - oldEnds[k]!;
    if (shift === 0 || Math.abs(shift) > tolerance) continue;

    // `durations[k]` already carries the previous cut's shift.
    const nextDuration = durations[k + 1]! - shift;
    const thisDuration = durations[k]! + shift;
    if (thisDuration < minClip || nextDuration < minClip) continue;
    if (thisDuration > maxItemDurationFrames(clips[k]!, fps)) continue;
    if (nextDuration > maxItemDurationFrames(clips[k + 1]!, fps)) continue;

    durations[k] = thisDuration;
    durations[k + 1] = nextDuration;
    shifts[k] = shift;
    moved += 1;
  }
  if (moved === 0) return { project, moved: 0 };

  const retimed = new Map<string, MediaItem>(
    clips.map((clip, k) => [clip.id, { ...clip, durationInFrames: durations[k]! }])
  );
  // Captions that sat on a cut follow it.
  const followCut = (frame: number): number => {
    for (let k = 0; k < clips.length - 1; k += 1) {
      if (shifts[k] !== 0 && Math.abs(frame - oldEnds[k]!) <= 1) return frame + shifts[k]!;
    }
    return frame;
  };

  const tracks = project.tracks.map((track) => {
    if (track.id === main.id) {
      return { ...track, items: track.items.map((item) => retimed.get(item.id) ?? item) };
    }
    const items = track.items.map((item): VideoItem => {
      if (isAudioItem(item)) return item;
      const from = followCut(item.from);
      const end = followCut(itemEnd(item));
      if (from === item.from && end === itemEnd(item)) return item;
      return {
        ...item,
        from,
        durationInFrames: Math.max(VIDEO_V2_LIMITS.minItemFrames, end - from),
      };
    });
    return { ...track, items };
  });

  return { project: normalizeProject({ ...project, tracks }), moved };
}
