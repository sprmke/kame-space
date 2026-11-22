/**
 * Trim view math: the kept part of a video is a window `[start, end]` on the whole source file,
 * measured in source frames. Pure, so the drag rules are unit-tested.
 *
 * Plan: docs/workflow/in-progress/marketing-video-editor-mobile-first-refine.md §4.5.
 */

export type SourceWindow = { start: number; end: number };

export type TrimHandle = 'start' | 'end' | 'both';

/** Ratio 0..1 along the bar to a source frame. */
export function frameAtRatio(ratio: number, sourceFrames: number): number {
  return Math.round(Math.min(1, Math.max(0, ratio)) * sourceFrames);
}

/** A source frame to a 0..1 position on the bar. */
export function ratioOfFrame(frame: number, sourceFrames: number): number {
  if (sourceFrames <= 0) return 0;
  return Math.min(1, Math.max(0, frame / sourceFrames));
}

/**
 * Move one handle (or slide the whole window) to a new frame, keeping at least `minFrames`
 * between the handles and staying inside the file.
 *
 * `both` slides the window: `frame` is where its start should go and the length is kept.
 */
export function dragWindow(
  current: SourceWindow,
  handle: TrimHandle,
  frame: number,
  sourceFrames: number,
  minFrames: number
): SourceWindow {
  const length = current.end - current.start;
  if (handle === 'start') {
    const start = Math.min(Math.max(0, Math.round(frame)), current.end - minFrames);
    return { start: Math.max(0, start), end: current.end };
  }
  if (handle === 'end') {
    const end = Math.max(Math.min(sourceFrames, Math.round(frame)), current.start + minFrames);
    return { start: current.start, end: Math.min(sourceFrames, end) };
  }
  const start = Math.min(Math.max(0, Math.round(frame)), Math.max(0, sourceFrames - length));
  return { start, end: start + length };
}

/** Which part of the bar a press landed on: a handle, or the kept window to slide. */
export function pickHandle(
  ratio: number,
  window: SourceWindow,
  sourceFrames: number,
  grabRatio: number
): TrimHandle {
  const startRatio = ratioOfFrame(window.start, sourceFrames);
  const endRatio = ratioOfFrame(window.end, sourceFrames);
  const toStart = Math.abs(ratio - startRatio);
  const toEnd = Math.abs(ratio - endRatio);
  if (Math.min(toStart, toEnd) <= grabRatio) return toStart <= toEnd ? 'start' : 'end';
  return ratio > startRatio && ratio < endRatio ? 'both' : toStart < toEnd ? 'start' : 'end';
}

/** Seconds with one decimal, for the labels under the bar. */
export function formatSeconds(frames: number, fps: number): string {
  return `${(Math.round((frames / fps) * 10) / 10).toFixed(1)}s`;
}
