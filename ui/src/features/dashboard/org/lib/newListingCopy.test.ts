import { describe, expect, it } from 'vitest';

import { newListingDialogTitle } from '@/features/dashboard/org/lib/newListingCopy';

describe('newListingDialogTitle', () => {
  it('names the single asset the host clicked', () => {
    expect(newListingDialogTitle('property', false)).toBe('Add property');
    expect(newListingDialogTitle('parking', false)).toBe('Add parking');
  });

  it('keeps the umbrella name when both kinds are offered', () => {
    expect(newListingDialogTitle('property', true)).toBe('New listing');
    expect(newListingDialogTitle('parking', true)).toBe('New listing');
  });
});
