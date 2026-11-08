import { describe, expect, it } from 'vitest';

import {
  OUTPUT_FEATURE,
  POST_FORMATS,
  POST_GOALS,
} from '@/features/dashboard/marketing/lib/aiStudioPostOptions';
import { POSTER_GOALS } from '@/features/dashboard/marketing/lib/poster/posterSpec';

describe('POST_GOALS', () => {
  it('offers every poster goal exactly once', () => {
    expect(POST_GOALS.map((goal) => goal.value).sort()).toEqual([...POSTER_GOALS].sort());
    expect(new Set(POST_GOALS.map((goal) => goal.value)).size).toBe(POST_GOALS.length);
  });

  it('labels and hints every goal', () => {
    for (const goal of POST_GOALS) {
      expect(goal.label.trim()).not.toBe('');
      expect(goal.hint.trim()).not.toBe('');
    }
  });
});

describe('POST_FORMATS', () => {
  it('describes every option with a usable aspect ratio', () => {
    for (const format of POST_FORMATS) {
      expect(format.value.trim()).not.toBe('');
      expect(format.label.trim()).not.toBe('');
      expect(format.width).toBeGreaterThan(0);
      expect(format.height).toBeGreaterThan(0);
    }
  });

  it('has unique format values', () => {
    const values = POST_FORMATS.map((format) => format.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('OUTPUT_FEATURE', () => {
  it('gates each output behind its own plan feature', () => {
    expect(OUTPUT_FEATURE).toEqual({
      post: 'aiMarketingGeneration',
      image: 'aiMarketingImageGeneration',
      video: 'aiMarketingVideoGeneration',
    });
  });
});
