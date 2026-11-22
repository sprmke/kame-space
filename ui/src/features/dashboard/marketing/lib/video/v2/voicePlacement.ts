/**
 * Where a voice recording lands on the timeline.
 *
 * The microphone and the video start a few milliseconds apart. The recording's first sample is the
 * moment the recorder started, so the clip is placed that much earlier or later than the point
 * the host pressed record, and anything before frame 0 is trimmed off. Pure, so it is tested.
 *
 * Plan: docs/workflow/in-progress/marketing-video-editor-mobile-first-refine.md §4.8.
 */

import { VIDEO_V2_LIMITS } from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';

export type VoicePlacementInput = {
  /** Playhead frame when recording began. */
  startFrame: number;
  /** `performance.now()` when the recorder reported it had started. */
  recorderStartMs: number;
  /** `performance.now()` when the preview reported it had started playing. */
  playStartMs: number;
  fps: number;
  /** Length of the recording. */
  durationMs: number;
};

export type VoicePlacement = {
  from: number;
  trimBeforeFrames: number;
  durationInFrames: number;
};

export function voicePlacement(input: VoicePlacementInput): VoicePlacement {
  const { fps } = input;
  const offset = Math.round(((input.recorderStartMs - input.playStartMs) * fps) / 1000);
  const rawFrom = Math.max(0, Math.round(input.startFrame)) + offset;
  const from = Math.max(0, rawFrom);
  const trimBeforeFrames = Math.max(0, -rawFrom);
  const recorded = Math.max(0, Math.round((input.durationMs * fps) / 1000));
  const room = Math.max(0, VIDEO_V2_LIMITS.maxDurationFrames - from);
  const durationInFrames = Math.max(
    VIDEO_V2_LIMITS.minItemFrames,
    Math.min(recorded - trimBeforeFrames, room)
  );
  return { from, trimBeforeFrames, durationInFrames };
}

/**
 * Where recording should start. With less than a second of video left from the playhead the take
 * would be too short to use, so it starts from the beginning instead.
 */
export function recordingStartFrame(
  playheadFrame: number,
  contentFrames: number,
  fps: number
): number {
  const frame = Math.max(0, Math.round(playheadFrame));
  return contentFrames - frame < fps ? 0 : frame;
}

/** Frames left before the 60 s cap when recording starts at `startFrame`. */
export function recordingRoomMs(startFrame: number, fps: number): number {
  const frames = Math.max(0, VIDEO_V2_LIMITS.maxDurationFrames - Math.round(startFrame));
  return Math.round((frames / fps) * 1000);
}
