import { describe, expect, it } from 'vitest';

import {
  resolveHouseRulesForDisplay,
  HOUSE_RULE_CUSTOM_MAX_LENGTH,
  HOUSE_RULE_PRESET_BY_ID,
  INITIAL_ENABLED_HOUSE_RULES,
} from '@/features/dashboard/org/lib/propertyHouseRulesConstants';

describe('resolveHouseRulesForDisplay', () => {
  it('formats dynamic check-in and check-out rules in 12-hour time', () => {
    const rules = resolveHouseRulesForDisplay({
      enabledIds: ['check_in_after', 'check_out_before'],
      customRules: [],
      checkInTime: '14:00',
      checkOutTime: '12:00',
    });
    expect(rules.map((rule) => rule.text)).toEqual([
      'Check-in: After 2:00 PM',
      'Checkout: Before 12:00 PM',
    ]);
  });

  it('leaves an unknown time string untouched', () => {
    const rules = resolveHouseRulesForDisplay({
      enabledIds: ['check_in_after'],
      customRules: [],
      checkInTime: 'afternoon',
      checkOutTime: '12:00',
    });
    expect(rules[0]?.text).toBe('Check-in: After afternoon');
  });
});

describe('HOUSE_RULE_CUSTOM_MAX_LENGTH', () => {
  it('is defined', () => {
    expect(HOUSE_RULE_CUSTOM_MAX_LENGTH).toBeDefined();
  });
});

describe('HOUSE_RULE_PRESET_BY_ID', () => {
  it('is defined', () => {
    expect(HOUSE_RULE_PRESET_BY_ID).toBeDefined();
  });
});

describe('INITIAL_ENABLED_HOUSE_RULES', () => {
  it('is defined', () => {
    expect(INITIAL_ENABLED_HOUSE_RULES).toBeDefined();
  });
});
