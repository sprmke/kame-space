/**
 * Property templates — retired Parking Request template.
 * Run: deno test supabase/functions/_shared/propertyTemplates_test.ts
 */

import { assertEquals, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  getBuiltinPropertyTemplate,
  isBuiltinPropertyTemplateKey,
  listBuiltinPropertyTemplates,
  normalizeTemplateContentForCompare,
} from './propertyTemplates.ts';

Deno.test('retired Parking Request template is gone from the builtin list', () => {
  const keys = listBuiltinPropertyTemplates().map((t) => t.key);
  assertEquals(keys.includes('email-parking-request' as never), false);
  assertEquals(getBuiltinPropertyTemplate('email-parking-request'), undefined);
  assertEquals(isBuiltinPropertyTemplateKey('email-parking-request'), false);
});

Deno.test('live email templates are still listed', () => {
  const keys = new Set(listBuiltinPropertyTemplates().map((t) => t.key));
  for (const key of [
    'email-gaf-request',
    'email-pet-request',
    'email-new-booking-request',
    'email-booking-request-received',
    'email-booking-acknowledgement',
    'email-ready-for-checkin',
    'email-sd-refund-form-request',
    'email-booking-cancelled-guest',
    'email-booking-cancelled-host',
    'email-cancellation-request-guest',
    'email-refund-sent-guest',
  ]) {
    assertEquals(keys.has(key as never), true, `${key} should still exist`);
  }
});

Deno.test('a TipTap round-tripped default still compares as default', () => {
  const builtin = getBuiltinPropertyTemplate('house-rules')!;
  // TipTap re-serializes list items as <li><p>…</p></li>.
  const roundTripped = builtin.defaultContent.replace(
    /<li>([\s\S]*?)<\/li>/g,
    '<li><p>$1</p></li>'
  );

  assertEquals(
    normalizeTemplateContentForCompare(roundTripped, 'house-rules'),
    normalizeTemplateContentForCompare(builtin.defaultContent, 'house-rules')
  );
});

Deno.test('a real edit still compares as customized', () => {
  const builtin = getBuiltinPropertyTemplate('house-rules')!;
  const edited = builtin.defaultContent.replace('No smoking', 'No smoking indoors');

  assertNotEquals(
    normalizeTemplateContentForCompare(edited, 'house-rules'),
    normalizeTemplateContentForCompare(builtin.defaultContent, 'house-rules')
  );
});
