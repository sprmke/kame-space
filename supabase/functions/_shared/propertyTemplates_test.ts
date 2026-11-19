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
import { propertyTemplatePlaceholderKeys } from './propertyTemplateCatalog.ts';
import { isBlockLevelPropertyPlaceholder } from './propertyTemplateCatalog.ts';

function tokenKeys(html: string): string[] {
  return [...html.matchAll(/\{\{([\w-]+)\}\}/g)].map((m) => m[1].replace(/-/g, '_'));
}

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
  const edited = builtin.defaultContent.replace('Building rules', 'Building house rules');

  assertNotEquals(
    normalizeTemplateContentForCompare(edited, 'house-rules'),
    normalizeTemplateContentForCompare(builtin.defaultContent, 'house-rules')
  );
});

Deno.test('every built-in carries group, icon and label metadata', () => {
  for (const builtin of listBuiltinPropertyTemplates()) {
    assertEquals(Boolean(builtin.group), true, `${builtin.key} needs a group`);
    assertEquals(Boolean(builtin.label), true, `${builtin.key} needs a label`);
    assertEquals(Boolean(builtin.iconId), true, `${builtin.key} needs an icon`);
    if (builtin.category === 'email') {
      assertEquals(Boolean(builtin.recipient), true, `${builtin.key} needs a recipient`);
      assertEquals(Boolean(builtin.trigger), true, `${builtin.key} needs a trigger`);
      assertEquals(Boolean(builtin.defaultSubject), true, `${builtin.key} needs a subject`);
    }
  }
});

Deno.test('every default token is allowed for its template', () => {
  for (const builtin of listBuiltinPropertyTemplates()) {
    const allowed = new Set(
      propertyTemplatePlaceholderKeys(builtin.key, builtin.category as 'standard' | 'email')
    );
    for (const token of tokenKeys(builtin.defaultContent)) {
      assertEquals(allowed.has(token), true, `${builtin.key} uses unlisted token {{${token}}}`);
    }
    if (builtin.defaultSubject) {
      for (const token of tokenKeys(builtin.defaultSubject)) {
        assertEquals(
          allowed.has(token),
          true,
          `${builtin.key} subject uses unlisted token {{${token}}}`
        );
      }
    }
  }
});

Deno.test('block tokens sit alone in their own paragraph and defaults stay plain', () => {
  for (const builtin of listBuiltinPropertyTemplates()) {
    for (const token of tokenKeys(builtin.defaultContent)) {
      if (!isBlockLevelPropertyPlaceholder(token)) continue;
      const pattern = new RegExp(`<p[^>]*>\\s*\\{\\{${token}\\}\\}\\s*</p>`, 'i');
      assertEquals(
        pattern.test(builtin.defaultContent),
        true,
        `${builtin.key} must place {{${token}}} alone in a <p>`
      );
    }
    assertEquals(builtin.defaultContent.includes('—'), false, `${builtin.key} has an em dash`);
    assertEquals(builtin.defaultContent.includes('–'), false, `${builtin.key} has an en dash`);
    assertEquals(
      /style=|<table/i.test(builtin.defaultContent),
      false,
      `${builtin.key} has inline HTML`
    );
  }
});
