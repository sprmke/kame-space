/**
 * test: N/A: glues the recorder, the upload queue and the editor together in the browser. The
 * timing maths is `voicePlacement` (unit tested) and the flow runs in the Playwright phone spec
 * with a fake microphone.
 *
 * Voiceover for the Videos editor: record while the video plays, upload the take through the
 * media library queue, and add it as a voice clip once it is saved. Nothing temporary is ever
 * stored in the project.
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

import { toast } from 'sonner';

import { useMarketingMediaUploads } from '@/features/dashboard/marketing/hooks/useMarketingMedia';
import { useVoiceRecorder } from '@/features/dashboard/marketing/hooks/useVoiceRecorder';
import { payloadFromAsset } from '@/features/dashboard/marketing/lib/media/mediaDrag';
import { audioItemFromPayload } from '@/features/dashboard/marketing/lib/video/v2/editorCommands';
import { insertItem, type OpResult } from '@/features/dashboard/marketing/lib/video/v2/timelineOps';
import type {
  AudioItem,
  VideoProjectV2,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';
import {
  recordingRoomMs,
  voicePlacement,
} from '@/features/dashboard/marketing/lib/video/v2/voicePlacement';

import type { PlayerRef } from '@remotion/player';

type Pending = {
  startFrame: number;
  recorderStartMs: number;
  playStartMs: number;
  durationMs: number;
};

type Options = {
  projectRef: RefObject<VideoProjectV2 | null>;
  currentFrameRef: RefObject<number>;
  playerRef: RefObject<PlayerRef | null>;
  isPlaying: boolean;
  canEdit: boolean;
  pausePlayback: () => void;
  apply: (build: (current: VideoProjectV2) => OpResult) => void;
  /** The take is on the timeline. */
  onSaved?: () => void;
};

export function useVideoVoiceover({
  projectRef,
  currentFrameRef,
  playerRef,
  isPlaying,
  canEdit,
  pausePlayback,
  apply,
  onSaved,
}: Options) {
  const recorder = useVoiceRecorder();
  const uploads = useMarketingMediaUploads();
  const [muteWhileRecording, setMuteWhileRecording] = useState(true);
  const [saving, setSaving] = useState(false);
  const pendingRef = useRef(new Map<string, Pending>());

  const start = useCallback(() => {
    const current = projectRef.current;
    if (!current || !canEdit) return;
    const startFrame = currentFrameRef.current;
    const player = playerRef.current;
    pausePlayback();
    let mutedByUs = false;
    void recorder.start({
      maxMs: recordingRoomMs(startFrame, current.fps),
      beginPlayback: async () => {
        if (muteWhileRecording && player && !player.isMuted()) {
          player.mute();
          mutedByUs = true;
        }
        player?.play();
        await new Promise((resolve) => setTimeout(resolve, 120));
        return performance.now();
      },
      endPlayback: () => {
        player?.pause();
        if (mutedByUs) player?.unmute();
      },
      onFinished: (recording) => {
        const id = uploads.enqueue([recording.file])[0];
        if (!id) {
          toast.error('Could not save your voice.');
          return;
        }
        pendingRef.current.set(id, {
          startFrame,
          recorderStartMs: recording.recorderStartMs,
          playStartMs: recording.playStartMs,
          durationMs: recording.durationMs,
        });
        setSaving(true);
      },
    });
  }, [
    canEdit,
    currentFrameRef,
    muteWhileRecording,
    pausePlayback,
    playerRef,
    projectRef,
    recorder,
    uploads,
  ]);

  // The video stopping (it ended, or the host tapped it) ends the take.
  const wasPlayingRef = useRef(false);
  useEffect(() => {
    if (wasPlayingRef.current && !isPlaying && recorder.phase === 'recording') recorder.stop();
    wasPlayingRef.current = isPlaying;
    // Only when play state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  // A saved take becomes a voice clip.
  useEffect(() => {
    for (const job of uploads.jobs) {
      const pending = pendingRef.current.get(job.id);
      if (!pending) continue;
      if (job.status === 'done' && job.asset) {
        pendingRef.current.delete(job.id);
        const fps = projectRef.current?.fps ?? 30;
        const placement = voicePlacement({ ...pending, fps });
        const voice: AudioItem = {
          ...audioItemFromPayload(payloadFromAsset(job.asset), { fps, from: placement.from }),
          role: 'voice',
          volume: 1,
          label: 'Voice',
          title: 'Voice',
          durationInFrames: placement.durationInFrames,
          trimBeforeFrames: placement.trimBeforeFrames,
        };
        apply((p) => insertItem(p, voice, { kind: 'audio', atFrame: placement.from }));
        uploads.dismiss(job.id);
        onSaved?.();
      } else if (job.status === 'error' || job.status === 'cancelled') {
        pendingRef.current.delete(job.id);
        toast.error(job.error?.message ?? 'Could not save your voice.');
        uploads.dismiss(job.id);
      }
    }
    setSaving(pendingRef.current.size > 0);
  }, [uploads.jobs, apply, uploads, projectRef, onSaved]);

  return { recorder, muteWhileRecording, setMuteWhileRecording, saving, start };
}
