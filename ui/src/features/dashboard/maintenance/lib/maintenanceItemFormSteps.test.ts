import { describe, expect, it } from 'vitest';

import {
  buildMaintenanceItemFormSteps,
  clampMaintenanceItemFormStepIndex,
  findMaintenanceItemFormStepIndex,
  maintenanceItemFormStepLabels,
} from '@/features/dashboard/maintenance/lib/maintenanceItemFormSteps';

describe('maintenanceItemFormSteps', () => {
  it('builds Details → Preview', () => {
    expect(maintenanceItemFormStepLabels(buildMaintenanceItemFormSteps())).toEqual([
      'Details',
      'Preview',
    ]);
  });

  it('finds step indexes by kind', () => {
    const steps = buildMaintenanceItemFormSteps();
    expect(findMaintenanceItemFormStepIndex(steps, 'details')).toBe(0);
    expect(findMaintenanceItemFormStepIndex(steps, 'preview')).toBe(1);
  });

  it('clamps step index', () => {
    expect(clampMaintenanceItemFormStepIndex(-1, 2)).toBe(0);
    expect(clampMaintenanceItemFormStepIndex(99, 2)).toBe(1);
    expect(clampMaintenanceItemFormStepIndex(1, 0)).toBe(0);
  });
});
