import { useCallback, useEffect, useRef, useState } from 'react';

import { toast } from 'sonner';

type PreviewState = {
  key: string | null;
  status: 'idle' | 'loading' | 'playing';
  /** 0 to 1 through the clip. */
  progress: number;
};

const IDLE: PreviewState = { key: null, status: 'idle', progress: 0 };

/**
 * One preview at a time. Starting another stops the first; leaving the screen stops it. Events
 * from an element that has already been replaced are ignored, so a slow-loading old clip can never
 * flip the new one's state.
 */
export function useAudioPreview() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<PreviewState>(IDLE);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    audioRef.current = null;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    setState(IDLE);
  }, []);

  const toggle = useCallback(
    (key: string, url: string | null | undefined) => {
      if (!url) return;
      if (audioRef.current && state.key === key) {
        stop();
        return;
      }
      stop();

      const audio = new Audio(url);
      audio.preload = 'auto';
      audioRef.current = audio;
      const isCurrent = () => audioRef.current === audio;
      setState({ key, status: 'loading', progress: 0 });

      audio.addEventListener('playing', () => {
        if (isCurrent()) setState((prev) => ({ ...prev, key, status: 'playing' }));
      });
      audio.addEventListener('timeupdate', () => {
        if (!isCurrent() || !audio.duration || !Number.isFinite(audio.duration)) return;
        setState((prev) => ({
          ...prev,
          progress: Math.min(1, audio.currentTime / audio.duration),
        }));
      });
      audio.addEventListener('ended', () => {
        if (isCurrent()) stop();
      });
      audio.addEventListener('error', () => {
        if (!isCurrent()) return;
        stop();
        toast.message('Could not play this preview');
      });
      void audio.play().catch(() => {
        if (!isCurrent()) return;
        stop();
        toast.message('Could not play this preview');
      });
    },
    [state.key, stop]
  );

  useEffect(() => stop, [stop]);

  return {
    playingKey: state.status === 'playing' ? state.key : null,
    loadingKey: state.status === 'loading' ? state.key : null,
    progressKey: state.key,
    progress: state.progress,
    toggle,
    stop,
  };
}
