/**
 * test: N/A: orchestrates browser audio decoding and a network call. Its parts are tested on
 * their own (`captionAudio`, `captionItems`, `captionOps`, the edge function), and the whole flow
 * runs in the Playwright phone spec.
 *
 * Auto captions: build the audio, ask the speech service, turn the words into lines.
 */

import { useCallback, useRef, useState } from 'react';

import {
  CaptionApiError,
  requestCaptionWords,
  type CaptionLanguage,
} from '@/features/dashboard/marketing/lib/video/v2/captions/captionApi';
import type { CaptionSourceMode } from '@/features/dashboard/marketing/lib/video/v2/captions/captionAudio';
import {
  CaptionPrepareError,
  renderCaptionAudio,
} from '@/features/dashboard/marketing/lib/video/v2/captions/captionAudioBrowser';
import { captionItemsFromWords } from '@/features/dashboard/marketing/lib/video/v2/captions/captionItems';
import type {
  CaptionItem,
  VideoProjectV2,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

export type AutoCaptionsPhase = 'idle' | 'listening' | 'writing' | 'error';

export type AutoCaptionsError = {
  message: string;
  /** A plan or AI allowance is the reason: offer the upgrade. */
  upgrade: boolean;
};

const NO_SPEECH = "We couldn't hear any speech. Try a clip where someone is talking.";

export function useAutoCaptions() {
  const propertyId = usePropertyIdParam();
  const [phase, setPhase] = useState<AutoCaptionsPhase>('idle');
  const [error, setError] = useState<AutoCaptionsError | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase('idle');
  }, []);

  /** Returns the caption lines, or null when nothing was made (the reason is in `error`). */
  const run = useCallback(
    async (
      project: VideoProjectV2,
      options: { mode: CaptionSourceMode; language: CaptionLanguage }
    ): Promise<CaptionItem[] | null> => {
      if (!propertyId) return null;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setError(null);
      setPhase('listening');
      try {
        const audio = await renderCaptionAudio(project, options.mode, {
          signal: controller.signal,
        });
        setPhase('writing');
        const { words } = await requestCaptionWords(propertyId, audio.blob, {
          language: options.language,
          durationMs: audio.durationMs,
          signal: controller.signal,
        });
        const lines = captionItemsFromWords(words, { fps: project.fps });
        if (lines.length === 0) {
          setError({ message: NO_SPEECH, upgrade: false });
          setPhase('error');
          return null;
        }
        setPhase('idle');
        return lines;
      } catch (cause) {
        if (controller.signal.aborted) {
          setPhase('idle');
          return null;
        }
        if (cause instanceof CaptionPrepareError) {
          setError({
            message: cause.code === 'silent' ? NO_SPEECH : cause.message,
            upgrade: false,
          });
        } else if (cause instanceof CaptionApiError) {
          setError({ message: cause.message, upgrade: cause.upgradeHook });
        } else {
          setError({ message: 'Captions could not be made. Try again.', upgrade: false });
        }
        setPhase('error');
        return null;
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [propertyId]
  );

  const reset = useCallback(() => {
    setError(null);
    setPhase('idle');
  }, []);

  return { phase, error, run, cancel, reset, busy: phase === 'listening' || phase === 'writing' };
}
