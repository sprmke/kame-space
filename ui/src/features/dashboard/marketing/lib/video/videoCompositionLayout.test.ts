import { describe, expect, it } from 'vitest';

import { textEntranceStyle } from '@/features/dashboard/marketing/lib/video/videoCompositionLayout';

describe('textEntranceStyle', () => {
  it('wipes a mask in from the left and settles to no style', () => {
    expect(textEntranceStyle('mask', 0)).toEqual({ clipPath: 'inset(0 100.00% 0 0)' });
    expect(textEntranceStyle('mask', 0.5)).toEqual({ clipPath: 'inset(0 50.00% 0 0)' });
    expect(textEntranceStyle('mask', 1)).toEqual({});
  });

  it('fades the rest and clamps progress', () => {
    expect(textEntranceStyle('fade', 0.25)).toEqual({ opacity: 0.25 });
    expect(textEntranceStyle('fade', -3)).toEqual({ opacity: 0 });
    expect(textEntranceStyle('fade', 9)).toEqual({});
  });
});
