import { describe, expect, it } from 'vitest';

import {
  isPlannerOpen,
  migrateLegacyPlanTab,
  setPlannerOpen,
} from '@/features/dashboard/marketing/lib/planner/plannerRoute';

describe('plannerRoute', () => {
  it('treats plan=1 / open / true as open', () => {
    expect(isPlannerOpen(new URLSearchParams('plan=1'))).toBe(true);
    expect(isPlannerOpen(new URLSearchParams('plan=open'))).toBe(true);
    expect(isPlannerOpen(new URLSearchParams('plan=true'))).toBe(true);
    expect(isPlannerOpen(new URLSearchParams('plan=0'))).toBe(false);
    expect(isPlannerOpen(new URLSearchParams())).toBe(false);
  });

  it('sets and clears the open flag', () => {
    const params = new URLSearchParams('range=today');
    setPlannerOpen(params, true);
    expect(params.get('plan')).toBe('1');
    expect(params.get('range')).toBe('today');
    setPlannerOpen(params, false);
    expect(params.get('plan')).toBeNull();
    expect(params.get('range')).toBe('today');
  });

  it('migrates the legacy Plan tab into ?plan=1', () => {
    const params = new URLSearchParams('tab=plan&range=today');
    expect(migrateLegacyPlanTab(params)).toBe(true);
    expect(params.get('tab')).toBeNull();
    expect(params.get('plan')).toBe('1');
    expect(params.get('range')).toBe('today');
    expect(migrateLegacyPlanTab(params)).toBe(false);
  });
});
