import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  markBoot,
  readBootMarks,
  readBootTimeline,
  resetBootMarksForTests,
  type BootMarkName,
} from '@/lib/perf/bootMarks';

afterEach(() => {
  resetBootMarksForTests();
  vi.unstubAllGlobals();
});

function withClock(values: number[]) {
  let i = 0;
  vi.stubGlobal('performance', {
    now: () => values[Math.min(i++, values.length - 1)],
    mark: () => undefined,
  });
}

describe('markBoot', () => {
  it('records a mark and reads it back', () => {
    withClock([10]);
    expect(markBoot('app:script-start')).toBe(10);
    expect(readBootMarks()['app:script-start']).toBe(10);
  });

  it('is first-wins for one-shot boot marks', () => {
    withClock([10, 40]);
    markBoot('loader:show');
    markBoot('loader:show');
    expect(readBootMarks()['loader:show']).toBe(10);
  });

  it('lets navigation marks overwrite, because each tap is its own pair', () => {
    withClock([10, 40, 70]);
    markBoot('nav:start');
    markBoot('nav:start');
    expect(readBootMarks()['nav:start']).toBe(40);
  });

  it('returns null and records nothing when performance is unavailable', () => {
    vi.stubGlobal('performance', undefined);
    expect(markBoot('app:script-start')).toBeNull();
    expect(readBootMarks()).toEqual({});
  });

  it('never throws when performance.mark throws', () => {
    vi.stubGlobal('performance', {
      now: () => 5,
      mark: () => {
        throw new Error('nope');
      },
    });
    expect(() => markBoot('app:first-render')).not.toThrow();
    expect(readBootMarks()['app:first-render']).toBe(5);
  });

  it('ignores a non-finite clock reading', () => {
    vi.stubGlobal('performance', { now: () => Number.NaN, mark: () => undefined });
    expect(markBoot('route:content')).toBeNull();
  });
});

describe('readBootTimeline', () => {
  it('reports null for marks that never fired instead of zero', () => {
    withClock([0]);
    markBoot('app:script-start');
    expect(readBootTimeline()).toEqual({
      firstRenderMs: null,
      loaderMs: null,
      skeletonMs: null,
      routeContentMs: null,
      navContentMs: null,
    });
  });

  it('computes the loader, skeleton, cold-open and navigation spans', () => {
    // script-start, first-render, loader:show, loader:hide, skeleton:show,
    // skeleton:hide, route:content, nav:start, nav:content
    withClock([0, 120, 130, 2030, 2040, 3040, 3500, 4000, 4210]);

    markBoot('app:script-start');
    markBoot('app:first-render');
    markBoot('loader:show');
    markBoot('loader:hide');
    markBoot('skeleton:show');
    markBoot('skeleton:hide');
    markBoot('route:content');
    markBoot('nav:start');
    markBoot('nav:content');

    expect(readBootTimeline()).toEqual({
      firstRenderMs: 120,
      loaderMs: 1900,
      skeletonMs: 1000,
      routeContentMs: 3500,
      navContentMs: 210,
    });
  });

  it('discards an inverted span rather than reporting a negative duration', () => {
    withClock([100, 50]);
    markBoot('nav:start');
    markBoot('nav:content');
    expect(readBootTimeline().navContentMs).toBeNull();
  });

  it('accepts every declared mark name', () => {
    const names: BootMarkName[] = [
      'app:script-start',
      'app:first-render',
      'loader:show',
      'loader:hide',
      'skeleton:show',
      'skeleton:hide',
      'route:content',
      'nav:start',
      'nav:content',
    ];
    withClock([0]);
    for (const name of names) expect(markBoot(name)).not.toBeUndefined();
  });
});
