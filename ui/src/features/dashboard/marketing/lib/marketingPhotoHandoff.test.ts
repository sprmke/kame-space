import { describe, expect, it } from 'vitest';

import {
  setPendingMarketingPhoto,
  takePendingMarketingPhoto,
} from '@/features/dashboard/marketing/lib/marketingPhotoHandoff';

describe('marketing photo handoff', () => {
  it('is consumed exactly once', () => {
    setPendingMarketingPhoto('https://img.test/a.jpg');

    expect(takePendingMarketingPhoto()).toBe('https://img.test/a.jpg');
    expect(takePendingMarketingPhoto()).toBeNull();
  });

  it('can be cleared before it is read', () => {
    setPendingMarketingPhoto('https://img.test/a.jpg');
    setPendingMarketingPhoto(null);

    expect(takePendingMarketingPhoto()).toBeNull();
  });
});
