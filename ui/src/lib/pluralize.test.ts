import { describe, expect, it } from 'vitest';

import { pluralize } from '@/lib/pluralize';

describe('pluralize', () => {
  it('keeps the singular for one', () => {
    expect(pluralize(1, 'property')).toBe('1 property');
    expect(pluralize(1, 'prop', 'props')).toBe('1 prop');
  });

  it('adds the plural s by default', () => {
    expect(pluralize(0, 'ticket')).toBe('0 tickets');
    expect(pluralize(2, 'parking')).toBe('2 parkings');
  });

  it('uses an explicit irregular plural when given one', () => {
    expect(pluralize(3, 'property', 'properties')).toBe('3 properties');
  });
});
