/**
 * Property templates — retired Parking Request template.
 * Run: deno test supabase/functions/_shared/propertyTemplates_test.ts
 */

import { assertEquals, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  getBuiltinPropertyTemplate,
  hashTemplateDefault,
  isBuiltinPropertyTemplateKey,
  listBuiltinPropertyTemplates,
  normalizeTemplateContentForCompare,
  validateTemplateSubject,
} from './propertyTemplates.ts';
import { propertyTemplatePlaceholderKeys } from './propertyTemplateCatalog.ts';
import { isBlockLevelPropertyPlaceholder } from './propertyTemplateCatalog.ts';
import { DYNAMIC_SECTIONS_BY_TEMPLATE } from './propertyTemplateEmailSections.ts';
import { CONDO_TEMPLATE_DEFAULTS } from './propertyTemplateDefaults/index.ts';

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

const MESSAGE_KEYS = [
  'message-balance-reminder',
  'message-document-follow-up',
  'message-check-in-day',
  'message-early-check-in',
  'message-late-check-out',
  'message-noise-reminder',
  'message-check-out-reminder',
  'message-thank-you',
  'message-lost-and-found',
] as const;

Deno.test('every guest message is a message in the Guest messages group', () => {
  for (const key of MESSAGE_KEYS) {
    const builtin = getBuiltinPropertyTemplate(key);
    if (!builtin) throw new Error(`${key} is missing`);
    assertEquals(builtin.category, 'message');
    assertEquals(builtin.group, 'guest-messages');
    assertEquals(builtin.defaultContent.trim().length > 0, true, `${key} needs copy`);
    assertEquals(builtin.defaultSubject, null);
    assertEquals(builtin.subjectLocked, false);
  }
});

Deno.test('guide sections carry a chapter and the right default visibility', () => {
  const guideKeys = [
    'welcome-note',
    'getting-here',
    'check-in-instructions',
    'house-rules',
    'using-the-unit',
    'building-amenities',
    'parking-reminders',
    'pet-guidelines',
    'emergency-and-safety',
    'check-out-instructions',
  ];
  for (const key of guideKeys) {
    const builtin = getBuiltinPropertyTemplate(key);
    if (!builtin) throw new Error(`${key} is missing`);
    assertEquals(builtin.group, 'stay-guide');
    assertEquals(Boolean(builtin.chapter), true, `${key} needs a chapter`);
  }

  assertEquals(getBuiltinPropertyTemplate('getting-here')?.defaultGuestVisible, false);
  assertEquals(getBuiltinPropertyTemplate('using-the-unit')?.defaultGuestVisible, false);
  assertEquals(getBuiltinPropertyTemplate('welcome-note')?.defaultGuestVisible, true);
  assertEquals(getBuiltinPropertyTemplate('pet-guidelines')?.condition, 'has_pets');
  assertEquals(getBuiltinPropertyTemplate('parking-reminders')?.condition, 'need_parking');
});

Deno.test('GAF and pet subjects stay locked; other emails are editable', () => {
  assertEquals(getBuiltinPropertyTemplate('email-gaf-request')?.subjectLocked, true);
  assertEquals(getBuiltinPropertyTemplate('email-pet-request')?.subjectLocked, true);
  assertEquals(getBuiltinPropertyTemplate('email-booking-acknowledgement')?.subjectLocked, false);
  assertEquals(
    getBuiltinPropertyTemplate('email-building-admin-cancellation')?.subjectLocked,
    false
  );
});

Deno.test('default hash is stable and changes with copy', () => {
  const a = hashTemplateDefault('<p>Hello</p>', 'Subject');
  const b = hashTemplateDefault('<p>Hello</p>', 'Subject');
  const c = hashTemplateDefault('<p>Hello there</p>', 'Subject');
  assertEquals(a, b);
  assertEquals(a === c, false);
});

Deno.test('subject validation rejects newlines and long subjects', () => {
  assertEquals(validateTemplateSubject('A normal subject'), null);
  assertEquals(validateTemplateSubject(null), null);
  assertEquals(validateTemplateSubject('Two\nlines') !== null, true);
  assertEquals(validateTemplateSubject('x'.repeat(201)) !== null, true);
});

Deno.test('new email and message templates have preview sample sections', () => {
  for (const key of [
    'email-pre-arrival-reminder',
    'email-parking-reminder',
    'email-review-request',
    'email-review-reminder',
    'email-request-expired-guest',
    'email-request-expiring-host',
    'email-building-admin-cancellation',
    'message-balance-reminder',
  ]) {
    assertEquals(
      (DYNAMIC_SECTIONS_BY_TEMPLATE[key] ?? []).length > 0,
      true,
      `${key} needs preview samples`
    );
  }
});

Deno.test('the condo pack and the registry describe the same templates', () => {
  const keys = new Set(listBuiltinPropertyTemplates().map((template) => template.key));
  for (const packKey of Object.keys(CONDO_TEMPLATE_DEFAULTS)) {
    assertEquals(
      keys.has(packKey as never),
      true,
      `${packKey} is in the pack but not the registry`
    );
  }
  for (const template of listBuiltinPropertyTemplates()) {
    assertEquals(
      template.defaultContent.trim().length > 0,
      true,
      `${template.key} has no default copy`
    );
  }
});
