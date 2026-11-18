/**
 * Unit tests for the Marketing Trends brand guard.
 * Run: deno test supabase/functions/_shared/marketingTrends/brandGuard_test.ts
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  buildBrandGuardPromptBlock,
  findBrandGuardViolation,
  guardRulesForCategory,
  isBrandSafe,
  needsBrandGuard,
} from './brandGuard.ts';

Deno.test('people-adjacent categories need the guard', () => {
  assert(needsBrandGuard('celebrity'));
  assert(needsBrandGuard('tv_film'));
  assert(needsBrandGuard('music'));
  assert(!needsBrandGuard('sports'));
  assert(!needsBrandGuard('food'));
});

Deno.test('guard rules are the three known ones', () => {
  assertEquals(guardRulesForCategory('celebrity'), ['no_likeness', 'no_logo', 'no_endorsement']);
  assertEquals(guardRulesForCategory('sports'), []);
});

Deno.test('endorsement wording is rejected for a celebrity topic', () => {
  assertEquals(findBrandGuardViolation('The official PBB staycation', 'celebrity'), 'no_endorsement');
  assertEquals(
    findBrandGuardViolation('Sponsored by Alexandra Eala', 'celebrity'),
    'no_endorsement'
  );
  assertEquals(
    findBrandGuardViolation('In partnership with PBB', 'celebrity'),
    'no_endorsement'
  );
  assertEquals(findBrandGuardViolation('Endorsed by the cast', 'celebrity'), 'no_endorsement');
});

Deno.test('a person named as a partner is rejected', () => {
  assertEquals(findBrandGuardViolation('Meet Alexandra Eala tonight', 'celebrity'), 'no_likeness');
  assertEquals(findBrandGuardViolation('Stay with Alexandra Eala', 'celebrity'), 'no_likeness');
});

Deno.test('a clean caption passes', () => {
  assert(isBrandSafe('Watching PBB tonight? Here is your staycation plan.', 'celebrity'));
  assert(isBrandSafe('Official PBB staycation', 'sports'));
});

Deno.test('a capitalized phrase that is not a name does not trigger the name rule', () => {
  assertEquals(findBrandGuardViolation('Stay with Weekend Plans', 'celebrity'), null);
  assertEquals(findBrandGuardViolation('Meet the Staycation Crew', 'celebrity'), null);
});

Deno.test('the prompt block lists only the rules that apply', () => {
  const block = buildBrandGuardPromptBlock(['no_likeness', 'no_logo', 'no_endorsement']);
  assert(block.includes('Do not use endorsement wording'));
  assert(block.includes('logos'));
  assertEquals(buildBrandGuardPromptBlock([]), '');
});
