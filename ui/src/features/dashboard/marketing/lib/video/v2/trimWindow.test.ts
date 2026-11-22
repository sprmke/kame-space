import { describe, expect, it } from 'vitest';

import {
  dragWindow,
  formatSeconds,
  frameAtRatio,
  pickHandle,
  ratioOfFrame,
} from '@/features/dashboard/marketing/lib/video/v2/trimWindow';

describe('ratio and frame conversion', () => {
  it('round-trips and stays inside the file', () => {
    expect(frameAtRatio(0.5, 300)).toBe(150);
    expect(frameAtRatio(-1, 300)).toBe(0);
    expect(frameAtRatio(2, 300)).toBe(300);
    expect(ratioOfFrame(150, 300)).toBe(0.5);
    expect(ratioOfFrame(10, 0)).toBe(0);
  });
});

describe('dragWindow', () => {
  const current = { start: 60, end: 150 };

  it('moves the start handle but keeps a minimum length', () => {
    expect(dragWindow(current, 'start', 30, 300, 3)).toEqual({ start: 30, end: 150 });
    expect(dragWindow(current, 'start', 400, 300, 3)).toEqual({ start: 147, end: 150 });
    expect(dragWindow(current, 'start', -20, 300, 3)).toEqual({ start: 0, end: 150 });
  });

  it('moves the end handle but keeps a minimum length', () => {
    expect(dragWindow(current, 'end', 200, 300, 3)).toEqual({ start: 60, end: 200 });
    expect(dragWindow(current, 'end', 10, 300, 3)).toEqual({ start: 60, end: 63 });
    expect(dragWindow(current, 'end', 999, 300, 3)).toEqual({ start: 60, end: 300 });
  });

  it('slides the whole window without changing its length', () => {
    expect(dragWindow(current, 'both', 100, 300, 3)).toEqual({ start: 100, end: 190 });
    expect(dragWindow(current, 'both', 280, 300, 3)).toEqual({ start: 210, end: 300 });
    expect(dragWindow(current, 'both', -5, 300, 3)).toEqual({ start: 0, end: 90 });
  });
});

describe('pickHandle', () => {
  const window = { start: 60, end: 150 };
  it('grabs the nearest handle when the press is close to it', () => {
    expect(pickHandle(0.21, window, 300, 0.05)).toBe('start');
    expect(pickHandle(0.49, window, 300, 0.05)).toBe('end');
  });
  it('slides the window when the press lands inside it, away from the handles', () => {
    expect(pickHandle(0.35, window, 300, 0.05)).toBe('both');
  });
  it('picks the nearer handle for a press outside the window', () => {
    expect(pickHandle(0.05, window, 300, 0.02)).toBe('start');
    expect(pickHandle(0.9, window, 300, 0.02)).toBe('end');
  });
});

describe('formatSeconds', () => {
  it('shows one decimal', () => {
    expect(formatSeconds(45, 30)).toBe('1.5s');
    expect(formatSeconds(0, 30)).toBe('0.0s');
  });
});
