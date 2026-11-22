/**
 * Project-level caption edits: put a set of lines on the timeline (replacing any earlier ones) and
 * take them all away. Each is one step, so one undo reverses it.
 */

import type { OpResult } from '@/features/dashboard/marketing/lib/video/v2/timelineOps';
import { newId, normalizeProject } from '@/features/dashboard/marketing/lib/video/v2/timelineOps';
import {
  VIDEO_V2_LIMITS,
  type CaptionItem,
  type VideoProjectV2,
  type VideoTrack,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';

export function hasCaptions(project: VideoProjectV2): boolean {
  return project.tracks.some((track) => track.kind === 'captions' && track.items.length > 0);
}

export function captionLinesOf(project: VideoProjectV2): CaptionItem[] {
  const track = project.tracks.find((candidate) => candidate.kind === 'captions');
  return (track?.items ?? []).filter((item): item is CaptionItem => item.type === 'caption');
}

/** Replace every caption line with `lines`. The look the host chose is kept. */
export function replaceCaptions(project: VideoProjectV2, lines: CaptionItem[]): OpResult {
  if (lines.length === 0) return { project, ok: false, reason: 'invalid' };
  const existing = project.tracks.find((track) => track.kind === 'captions');
  const others = project.tracks.filter((track) => track.kind !== 'captions');
  if (!existing && others.length >= VIDEO_V2_LIMITS.maxTracks) {
    return { project, ok: false, reason: 'track_limit' };
  }
  const track: VideoTrack = {
    ...(existing ?? { id: newId('track'), kind: 'captions' as const }),
    kind: 'captions',
    items: lines.slice(0, VIDEO_V2_LIMITS.maxCaptionItems),
  };
  return {
    project: normalizeProject({ ...project, tracks: [...others, track] }),
    ok: true,
    itemIds: [track.items[0]!.id],
  };
}

export function deleteAllCaptions(project: VideoProjectV2): OpResult {
  if (!project.tracks.some((track) => track.kind === 'captions')) {
    return { project, ok: false, reason: 'not_found' };
  }
  return {
    project: normalizeProject({
      ...project,
      tracks: project.tracks.filter((track) => track.kind !== 'captions'),
    }),
    ok: true,
  };
}
