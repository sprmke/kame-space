import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { slugifyName, withSlugSuffix } from './slugUtils.ts';

/**
 * Shared vectors. The same list is asserted in
 * `ui/src/features/dashboard/org/lib/orgSettingsForm.test.ts` (Vitest) and in
 * `supabase/functions/tests/seoSlugParity.integration_test.ts` (SQL), so the three slugifiers
 * cannot drift.
 */
export const SLUG_VECTORS: Array<[string, string]> = [
  ['Parañaque Loft', 'paranaque-loft'],
  ['Casa de María', 'casa-de-maria'],
  ['ÁÉÍÓÚ Ñandú', 'aeiou-nandu'],
  ['Makati  Condo -- 2BR', 'makati-condo-2br'],
  ['BGC (Taguig) #1', 'bgc-taguig-1'],
  ['2026 Stay', '2026-stay'],
  ['🔥', 'item'],
  ['   ', 'item'],
];

Deno.test('slugifyName strips diacritics instead of dropping the letter', () => {
  for (const [input, expected] of SLUG_VECTORS) {
    assertEquals(slugifyName(input), expected, input);
  }
});

Deno.test('slugifyName truncates on the 64 character boundary', () => {
  const slug = slugifyName('a'.repeat(80));
  assertEquals(slug.length, 64);
});

Deno.test('withSlugSuffix keeps the total under 64 characters', () => {
  const base = 'a'.repeat(64);
  const suffixed = withSlugSuffix(base, 2);
  assertEquals(suffixed.length <= 64, true);
  assertEquals(suffixed.endsWith('-3'), true);
});
