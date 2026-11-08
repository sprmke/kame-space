import { describe, expect, it } from 'vitest';

import {
  setPendingAiStartPhoto,
  takePendingAiStartPhoto,
} from '@/features/dashboard/marketing/lib/aiStudioHandoff';
import type { MarketingGenerationReference } from '@/features/dashboard/marketing/lib/marketingGenerationTypes';

describe('ai start photo handoff', () => {
  it('is consumed exactly once', () => {
    const reference = { id: 'ref-1', url: 'https://img.test/a.jpg' } as unknown as MarketingGenerationReference;

    setPendingAiStartPhoto(reference);

    expect(takePendingAiStartPhoto()).toBe(reference);
    expect(takePendingAiStartPhoto()).toBeNull();
  });

  it('is empty before anything is handed over', () => {
    expect(takePendingAiStartPhoto()).toBeNull();
  });
});
