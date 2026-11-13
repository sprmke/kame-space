import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  DEFAULT_WEEKLY_AI_CREDIT_CAP,
  normaliseAiCap,
  shouldUseAiPlan,
} from './marketingPlanMode.ts';

Deno.test('shouldUseAiPlan: rules by default', () => {
  assertEquals(shouldUseAiPlan({ mode: 'rules', cap: 20, spent: 0, entitled: true }), false);
  assertEquals(shouldUseAiPlan({ mode: null, cap: 20, spent: 0, entitled: true }), false);
});

Deno.test('shouldUseAiPlan: AI needs an opt-in cap above zero', () => {
  assertEquals(shouldUseAiPlan({ mode: 'ai', cap: 0, spent: 0, entitled: true }), false);
  assertEquals(shouldUseAiPlan({ mode: 'ai', cap: -5, spent: 0, entitled: true }), false);
  assertEquals(shouldUseAiPlan({ mode: 'ai', cap: 'nope', spent: 0, entitled: true }), false);
  assertEquals(shouldUseAiPlan({ mode: 'ai', cap: 20, spent: 0, entitled: true }), true);
});

Deno.test('shouldUseAiPlan: a lost entitlement falls back to rules', () => {
  assertEquals(shouldUseAiPlan({ mode: 'ai', cap: 20, spent: 0, entitled: false }), false);
});

Deno.test('shouldUseAiPlan: stops at the cap, and treats junk spend as zero', () => {
  assertEquals(shouldUseAiPlan({ mode: 'ai', cap: 20, spent: 20, entitled: true }), false);
  assertEquals(shouldUseAiPlan({ mode: 'ai', cap: 20, spent: 19, entitled: true }), true);
  assertEquals(shouldUseAiPlan({ mode: 'ai', cap: 20, spent: Number.NaN, entitled: true }), true);
});

Deno.test('normaliseAiCap: clamps to the schema ceiling and zeroes junk', () => {
  assertEquals(normaliseAiCap(20), 20);
  assertEquals(normaliseAiCap(0), 0);
  assertEquals(normaliseAiCap(-1), 0);
  assertEquals(normaliseAiCap('x'), 0);
  assertEquals(normaliseAiCap(10_000), 1000);
  assertEquals(normaliseAiCap(12.6), 13);
  assertEquals(DEFAULT_WEEKLY_AI_CREDIT_CAP, 20);
});
