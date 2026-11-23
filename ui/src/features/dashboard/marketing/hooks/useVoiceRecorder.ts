/**
 * test: N/A — MediaRecorder and Web Audio; browser only. The timing maths it feeds
 * (`voicePlacement`) is unit tested, and the whole flow runs in the Playwright phone spec with a
 * fake microphone.
 *
 * Voice recording for the Videos editor: ask for the microphone, count down, start the recorder
 * and the video together, show a live level, and hand back one audio file when it stops.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { friendlyMicErrorMessage } from '@/features/guest/chat/lib/voiceMicrophoneCapture';

export type VoiceRecorderPhase = 'idle' | 'asking' | 'countdown' | 'recording' | 'error';

export type VoiceRecording = {
  file: File;
  durationMs: number;
  /** `performance.now()` when the recorder started. */
  recorderStartMs: number;
  /** `performance.now()` when the video started playing. */
  playStartMs: number;
};

export type VoiceRecorderStart = {
  /** Longest recording allowed (the room left before the 60 s cap). */
  maxMs: number;
  /** Start the video from the playhead. Resolves with `performance.now()` when it is playing. */
  beginPlayback: () => Promise<number>;
  /** Pause the video again. */
  endPlayback: () => void;
  onFinished: (recording: VoiceRecording) => void;
};

const COUNTDOWN_FROM = 3;
/** Prefer AAC in MP4 (plays everywhere), then WebM with Opus. */
const MIME_CANDIDATES = [
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/webm;codecs=opus',
  'audio/webm',
];

export function pickRecorderMime(isSupported: (mime: string) => boolean): string | null {
  return MIME_CANDIDATES.find((mime) => isSupported(mime)) ?? null;
}

export function extensionForRecorderMime(mime: string): 'm4a' | 'webm' {
  return mime.startsWith('audio/mp4') ? 'm4a' : 'webm';
}

export function isVoiceRecordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

export function useVoiceRecorder() {
  const [phase, setPhase] = useState<VoiceRecorderPhase>('idle');
  const [count, setCount] = useState(COUNTDOWN_FROM);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const cleanupRef = useRef<(() => void) | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const cancelledRef = useRef(false);

  const teardown = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    stopRef.current = null;
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  /** Finish and keep what was recorded. */
  const stop = useCallback(() => stopRef.current?.(), []);

  /** Throw the take away. */
  const cancel = useCallback(() => {
    cancelledRef.current = true;
    stopRef.current?.();
    teardown();
    setPhase('idle');
    setElapsedMs(0);
    setLevel(0);
  }, [teardown]);

  const start = useCallback(async (options: VoiceRecorderStart) => {
    if (!isVoiceRecordingSupported()) {
      setError('Recording is not available in this browser.');
      setPhase('error');
      return;
    }
    cancelledRef.current = false;
    setError(null);
    setElapsedMs(0);
    setLevel(0);
    setPhase('asking');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (cause) {
      setError(friendlyMicErrorMessage(cause));
      setPhase('error');
      return;
    }
    if (cancelledRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    const mime = pickRecorderMime((candidate) => MediaRecorder.isTypeSupported(candidate));
    let recorder: MediaRecorder;
    try {
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      setError('Recording is not available in this browser.');
      setPhase('error');
      return;
    }

    // Live level, so the host can see the microphone is hearing them.
    let audioContext: AudioContext | null = null;
    let meterFrame = 0;
    try {
      audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      let lastPaint = 0;
      const tick = (now: number) => {
        analyser.getByteTimeDomainData(samples);
        if (now - lastPaint > 66) {
          let sum = 0;
          for (const sample of samples) sum += ((sample - 128) / 128) ** 2;
          setLevel(Math.min(1, Math.sqrt(sum / samples.length) * 3));
          lastPaint = now;
        }
        meterFrame = requestAnimationFrame(tick);
      };
      meterFrame = requestAnimationFrame(tick);
    } catch {
      audioContext = null;
    }

    const chunks: Blob[] = [];
    let recorderStartMs = 0;
    let playStartMs = 0;
    let timer: ReturnType<typeof setInterval> | null = null;
    let limitTimer: ReturnType<typeof setTimeout> | null = null;
    let countdownTimer: ReturnType<typeof setInterval> | null = null;
    let finished = false;

    const release = () => {
      if (countdownTimer) clearInterval(countdownTimer);
      if (timer) clearInterval(timer);
      if (limitTimer) clearTimeout(limitTimer);
      cancelAnimationFrame(meterFrame);
      stream.getTracks().forEach((track) => track.stop());
      void audioContext?.close().catch(() => undefined);
      document.removeEventListener('visibilitychange', onHidden);
    };
    cleanupRef.current = () => {
      finished = true;
      release();
      if (recorder.state !== 'inactive') {
        try {
          recorder.stop();
        } catch {
          // Already stopped.
        }
      }
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      const durationMs = Math.max(0, performance.now() - recorderStartMs);
      release();
      options.endPlayback();
      recorder.onstop = () => {
        if (cancelledRef.current) return;
        const type = recorder.mimeType || mime || 'audio/webm';
        const file = new File(
          [new Blob(chunks, { type })],
          `Voice.${extensionForRecorderMime(type)}`,
          { type }
        );
        setPhase('idle');
        setLevel(0);
        if (file.size > 0) options.onFinished({ file, durationMs, recorderStartMs, playStartMs });
      };
      if (recorder.state !== 'inactive') recorder.stop();
      stopRef.current = null;
    };
    stopRef.current = finish;

    // A call or a switch to another app: keep what we have.
    function onHidden() {
      if (document.visibilityState === 'hidden') finish();
    }
    document.addEventListener('visibilitychange', onHidden);
    stream.getAudioTracks().forEach((track) => track.addEventListener('ended', finish));

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    const begin = async () => {
      if (cancelledRef.current || finished) return;
      recorder.onstart = () => {
        recorderStartMs = performance.now();
      };
      recorder.start(250);
      setPhase('recording');
      playStartMs = await options.beginPlayback();
      if (!recorderStartMs) recorderStartMs = performance.now();
      timer = setInterval(() => setElapsedMs(performance.now() - recorderStartMs), 100);
      limitTimer = setTimeout(finish, Math.max(500, options.maxMs));
    };

    setCount(COUNTDOWN_FROM);
    setPhase('countdown');
    let remaining = COUNTDOWN_FROM;
    countdownTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (countdownTimer) clearInterval(countdownTimer);
        countdownTimer = null;
        void begin();
      } else {
        setCount(remaining);
      }
    }, 1000);
  }, []);

  return { phase, count, elapsedMs, level, error, start, stop, cancel };
}
