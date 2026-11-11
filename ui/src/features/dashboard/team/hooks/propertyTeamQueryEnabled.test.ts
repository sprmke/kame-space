import { describe, expect, it } from 'vitest';

import { propertyTeamQueryEnabled } from './usePropertyTeam';

/**
 * The dashboard used to pay three requests plus a seat reconcile for this query on every boot,
 * because callers that only render a picker trigger relied on the old default of "always on".
 * These cases pin the opt-in behaviour so it cannot drift back silently.
 */
describe('propertyTeamQueryEnabled', () => {
  it('is off when the caller says nothing', () => {
    expect(propertyTeamQueryEnabled('property-1')).toBe(false);
  });

  it('is off when the caller passes an empty options object', () => {
    expect(propertyTeamQueryEnabled('property-1', {})).toBe(false);
  });

  it('is off when the caller explicitly disables it', () => {
    expect(propertyTeamQueryEnabled('property-1', { enabled: false })).toBe(false);
  });

  it('is on only when the caller opts in and a property is present', () => {
    expect(propertyTeamQueryEnabled('property-1', { enabled: true })).toBe(true);
    expect(propertyTeamQueryEnabled(undefined, { enabled: true })).toBe(false);
    expect(propertyTeamQueryEnabled(null, { enabled: true })).toBe(false);
  });
});
