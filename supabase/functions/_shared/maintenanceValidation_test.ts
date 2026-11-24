import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  MAINTENANCE_LIMITS,
  validateMaintenanceItemFields,
} from './maintenanceValidation.ts';

Deno.test('validateMaintenanceItemFields accepts a normal reminder', () => {
  assertEquals(
    validateMaintenanceItemFields({
      label: 'Replace filter',
      category: 'Aircon',
      scheduledOn: '2026-11-30',
      notes: 'Washable filter',
      recurrenceUntil: '2027-11-30',
    }),
    null
  );
});

Deno.test('validateMaintenanceItemFields requires label and category', () => {
  assertEquals(validateMaintenanceItemFields({ label: '', category: 'Aircon' }), 'Invalid fields');
  assertEquals(validateMaintenanceItemFields({ label: 'Task', category: '' }), 'Invalid fields');
});

Deno.test('validateMaintenanceItemFields rejects overlong text', () => {
  assertEquals(
    validateMaintenanceItemFields({
      label: 'a'.repeat(MAINTENANCE_LIMITS.label + 1),
      category: 'Aircon',
    }),
    `Label must be ${MAINTENANCE_LIMITS.label} characters or fewer`
  );
  assertEquals(
    validateMaintenanceItemFields({
      label: 'Task',
      category: 'a'.repeat(MAINTENANCE_LIMITS.category + 1),
    }),
    `Category must be ${MAINTENANCE_LIMITS.category} characters or fewer`
  );
  assertEquals(
    validateMaintenanceItemFields({
      label: 'Task',
      category: 'Aircon',
      notes: 'a'.repeat(MAINTENANCE_LIMITS.notes + 1),
    }),
    `Notes must be ${MAINTENANCE_LIMITS.notes} characters or fewer`
  );
});

Deno.test('validateMaintenanceItemFields rejects malformed dates', () => {
  assertEquals(
    validateMaintenanceItemFields({
      label: 'Task',
      category: 'Aircon',
      scheduledOn: '11/30/2026',
    }),
    'Valid scheduled date required'
  );
  assertEquals(
    validateMaintenanceItemFields({
      label: 'Task',
      category: 'Aircon',
      recurrenceUntil: 'next year',
    }),
    'Valid repeat end date required'
  );
});

Deno.test('validateMaintenanceItemFields skips an absent scheduled date (PATCH)', () => {
  assertEquals(validateMaintenanceItemFields({ label: 'Task', category: 'Aircon' }), null);
});
