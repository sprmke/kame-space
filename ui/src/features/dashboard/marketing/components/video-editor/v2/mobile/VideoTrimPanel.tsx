import { useEffect, useRef, useState } from 'react';

import { Check, Film } from 'lucide-react';

import { sourceDurationFrames } from '@/features/dashboard/marketing/lib/video/v2/timelineTiming';
import {
  dragWindow,
  formatSeconds,
  frameAtRatio,
  pickHandle,
  ratioOfFrame,
  type SourceWindow,
  type TrimHandle,
} from '@/features/dashboard/marketing/lib/video/v2/trimWindow';
import {
  VIDEO_V2_LIMITS,
  type MediaItem,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';

import { Button } from '@/components/ui/button';

type Props = {
  item: MediaItem;
  fps: number;
  /** Applies the kept part in one step (one undo). */
  onApply: (startSource: number, endSource: number) => void;
  onClose: () => void;
};

/** How close to a handle a press counts as grabbing it, as a share of the bar. */
const GRAB_RATIO = 0.06;

/**
 * Trim view for a video clip: the whole file on one bar, the kept part highlighted, drag the
 * handles or slide the part. Applies when the finger lifts, so one trim is one undo step.
 */
export function VideoTrimPanel({ item, fps, onApply, onClose }: Props) {
  const rate = item.playbackRate ?? 1;
  const trimBefore = item.trimBeforeFrames ?? 0;
  const currentWindow: SourceWindow = {
    start: trimBefore,
    end: trimBefore + Math.round(item.durationInFrames * rate),
  };
  // Without a known file length the bar can only shrink the part that already plays.
  const known = sourceDurationFrames(item.media, fps);
  const sourceFrames = Math.max(known ?? currentWindow.end, currentWindow.end);

  const [draft, setDraft] = useState<SourceWindow | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ handle: TrimHandle; grabOffset: number; latest: SourceWindow } | null>(
    null
  );
  const shown = draft ?? currentWindow;

  // A new clip or an applied trim ends any draft.
  useEffect(() => {
    setDraft(null);
  }, [item.id, trimBefore, item.durationInFrames, rate]);

  const ratioFromEvent = (event: React.PointerEvent) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 0;
    return Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
  };

  const onPointerDown = (event: React.PointerEvent) => {
    const ratio = ratioFromEvent(event);
    const handle = pickHandle(ratio, shown, sourceFrames, GRAB_RATIO);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      handle,
      grabOffset: frameAtRatio(ratio, sourceFrames) - shown.start,
      latest: shown,
    };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const frame = frameAtRatio(ratioFromEvent(event), sourceFrames);
    const target = drag.handle === 'both' ? frame - drag.grabOffset : frame;
    const next = dragWindow(
      drag.latest,
      drag.handle,
      target,
      sourceFrames,
      VIDEO_V2_LIMITS.minItemFrames
    );
    drag.latest = next;
    setDraft(next);
  };

  const finish = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    const { start, end } = drag.latest;
    if (start !== currentWindow.start || end !== currentWindow.end) onApply(start, end);
    else setDraft(null);
  };

  const startRatio = ratioOfFrame(shown.start, sourceFrames);
  const endRatio = ratioOfFrame(shown.end, sourceFrames);
  const keptFrames = Math.round((shown.end - shown.start) / rate);

  return (
    <section aria-label="Trim" className="border-border bg-card shrink-0 border-t px-4 pb-3 pt-2">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Trim</h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label="Close panel"
          onClick={onClose}
        >
          <Check className="size-5" aria-hidden />
        </Button>
      </div>
      <div
        ref={barRef}
        role="group"
        aria-label="Part of the video to keep"
        className="bg-muted relative h-14 touch-none select-none overflow-hidden rounded-lg"
        style={
          item.media.posterUrl
            ? {
                backgroundImage: `url(${item.media.posterUrl})`,
                backgroundSize: 'auto 100%',
                backgroundRepeat: 'repeat-x',
              }
            : undefined
        }
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
      >
        {item.media.posterUrl ? null : (
          <Film
            className="text-muted-foreground absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2"
            aria-hidden
          />
        )}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 bg-black/60"
          style={{ width: `${startRatio * 100}%` }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 bg-black/60"
          style={{ width: `${(1 - endRatio) * 100}%` }}
        />
        <div
          className="border-primary pointer-events-none absolute inset-y-0 rounded-md border-y-2"
          style={{ left: `${startRatio * 100}%`, width: `${(endRatio - startRatio) * 100}%` }}
        >
          <span
            className="bg-primary absolute inset-y-0 left-0 flex w-3.5 items-center justify-center rounded-l-md"
            aria-hidden
          >
            <span className="h-5 w-0.5 rounded-full bg-white/90" />
          </span>
          <span
            className="bg-primary absolute inset-y-0 right-0 flex w-3.5 items-center justify-center rounded-r-md"
            aria-hidden
          >
            <span className="h-5 w-0.5 rounded-full bg-white/90" />
          </span>
        </div>
      </div>
      <div className="text-muted-foreground mt-2 flex items-center justify-between text-xs tabular-nums">
        <span>From {formatSeconds(shown.start, fps)}</span>
        <span className="text-foreground font-medium">{formatSeconds(keptFrames, fps)} kept</span>
        <span>To {formatSeconds(shown.end, fps)}</span>
      </div>
    </section>
  );
}
