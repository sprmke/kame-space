import { Check, Mic, Square } from 'lucide-react';

import type { VoiceRecorderPhase } from '@/features/dashboard/marketing/hooks/useVoiceRecorder';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

type Props = {
  phase: VoiceRecorderPhase;
  count: number;
  elapsedMs: number;
  /** 0..1 live microphone level. */
  level: number;
  error: string | null;
  /** The take is being saved to Your media. */
  saving: boolean;
  muteWhileRecording: boolean;
  onMuteChange: (value: boolean) => void;
  onStart: () => void;
  onStop: () => void;
  onCancel: () => void;
  onClose: () => void;
};

/** A plain button on purpose: the shared Button's gradient would turn it teal, not red. */
const RECORD_BUTTON =
  'flex size-16 shrink-0 touch-manipulation items-center justify-center rounded-full bg-red-600 text-white shadow-lg ring-4 ring-red-600/25 transition-transform hover:bg-red-700 active:scale-95 disabled:opacity-50';

function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Record a voiceover while the video plays. One big button, plain words, and the one tip that
 * matters (headphones). Lives above the tool strip like every other tool panel.
 */
export function VideoRecordPanel({
  phase,
  count,
  elapsedMs,
  level,
  error,
  saving,
  muteWhileRecording,
  onMuteChange,
  onStart,
  onStop,
  onCancel,
  onClose,
}: Props) {
  const busy = phase === 'asking' || phase === 'countdown' || phase === 'recording';
  return (
    <section
      aria-label="Record voice"
      className="border-border bg-card shrink-0 border-t px-4 pb-3 pt-2"
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Record voice</h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label="Close panel"
          disabled={busy}
          onClick={onClose}
        >
          <Check className="size-5" aria-hidden />
        </Button>
      </div>

      <div className="flex items-center gap-4">
        {phase === 'recording' ? (
          <button
            type="button"
            className={RECORD_BUTTON}
            aria-label="Stop recording"
            onClick={onStop}
          >
            <Square className="size-6 fill-current" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            className={RECORD_BUTTON}
            aria-label="Start recording"
            disabled={busy || saving}
            onClick={onStart}
          >
            {phase === 'countdown' ? (
              <span className="text-2xl font-bold tabular-nums" aria-live="polite">
                {count}
              </span>
            ) : (
              <Mic className="size-7" aria-hidden />
            )}
          </button>
        )}

        <div className="min-w-0 flex-1 space-y-2">
          {phase === 'recording' ? (
            <>
              <p className="text-sm font-medium tabular-nums" role="timer">
                Recording {formatClock(elapsedMs)}
              </p>
              <div
                className="bg-muted h-2 overflow-hidden rounded-full"
                role="img"
                aria-label="Microphone level"
              >
                <div
                  className="h-full rounded-full bg-red-500 transition-[width] duration-100"
                  style={{ width: `${Math.round(level * 100)}%` }}
                />
              </div>
              <button
                type="button"
                className="text-muted-foreground min-h-[44px] text-xs underline"
                onClick={onCancel}
              >
                Cancel and start over
              </button>
            </>
          ) : phase === 'asking' ? (
            <p className="text-sm">Allow the microphone to start.</p>
          ) : phase === 'countdown' ? (
            <p className="text-sm">Get ready. The video plays when the count ends.</p>
          ) : saving ? (
            <p className="text-sm" role="status">
              Saving your voice…
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              Tap the red button and talk while the video plays. Headphones help.
            </p>
          )}
          {phase === 'error' && error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-2 flex min-h-[44px] items-center justify-between">
        <span className="text-sm">Mute the video while I talk</span>
        <Switch
          aria-label="Mute the video while I talk"
          checked={muteWhileRecording}
          disabled={busy}
          onCheckedChange={onMuteChange}
        />
      </div>
    </section>
  );
}
