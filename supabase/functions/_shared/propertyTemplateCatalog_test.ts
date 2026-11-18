/**
 * Placeholder catalog + save-time context rules.
 * Run: deno test supabase/functions/_shared/propertyTemplateCatalog_test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  isBlockLevelPropertyPlaceholder,
  propertyTemplatePlaceholderKeys,
  validatePropertyTemplateTokens,
} from './propertyTemplateCatalog.ts';

Deno.test('secrets are only allowed in stay guide templates', () => {
  const guide = validatePropertyTemplateTokens({
    templateKey: 'check-in-instructions',
    category: 'standard',
    group: 'stay-guide',
    content: '<p>Wi-Fi {{wifi_name}}, password {{wifi_password}}</p>',
  });
  assertEquals(guide.errors, []);

  const email = validatePropertyTemplateTokens({
    templateKey: 'email-ready-for-checkin',
    category: 'email',
    group: 'guest-emails',
    content: '<p>Password {{wifi_password}}</p>',
  });
  assertEquals(email.errors.length, 1);
  assertEquals(email.errors[0]?.includes('Stay guide'), true);
});

Deno.test('tokenized guest links are rejected in building admin and team alerts', () => {
  for (const group of ['building-admin', 'team-alerts']) {
    const result = validatePropertyTemplateTokens({
      templateKey: group === 'building-admin' ? 'email-gaf-request' : 'email-new-booking-request',
      category: 'email',
      group,
      content: '<p>{{trip_url}}</p><p>{{trip_cta_section}}</p>',
    });
    assertEquals(result.errors.length, 2);
  }
});

Deno.test('unknown tokens warn but do not block the save', () => {
  const result = validatePropertyTemplateTokens({
    templateKey: 'email-booking-acknowledgement',
    category: 'email',
    group: 'guest-emails',
    content: '<p>{{not_a_real_token}}</p>',
  });

  assertEquals(result.errors, []);
  assertEquals(result.warnings.length, 1);
});

Deno.test('a block token cannot be used in a subject', () => {
  const result = validatePropertyTemplateTokens({
    templateKey: 'email-new-booking-request',
    category: 'email',
    group: 'team-alerts',
    content: '<p>{{new_booking_detail_tables}}</p>',
    subject: '{{new_booking_detail_tables}}',
  });

  assertEquals(
    result.errors.some((error) => error.includes('subject')),
    true
  );
});

Deno.test('removing a required block warns', () => {
  const result = validatePropertyTemplateTokens({
    templateKey: 'email-sd-refund-form-request',
    category: 'email',
    group: 'guest-emails',
    content: '<p>Check out soon.</p>',
  });

  assertEquals(
    result.warnings.some((warning) => warning.includes('sd_refund_details_section')),
    true
  );
});

Deno.test('every default block key is recognised as block level', () => {
  for (const key of propertyTemplatePlaceholderKeys('email-ready-for-checkin', 'email')) {
    if (['trip_cta_section', 'stay_guide_cta_section', 'payment_breakdown_section'].includes(key)) {
      assertEquals(isBlockLevelPropertyPlaceholder(key), true, `${key} should be block level`);
    }
  }
});
