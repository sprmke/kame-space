/**
 * Placeholder catalog + save-time context rules.
 * Run: deno test supabase/functions/_shared/propertyTemplateCatalog_test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  isBlockLevelPropertyPlaceholder,
  propertyTemplatePlaceholderKeys,
  TOKENIZED_LINK_PLACEHOLDER_KEYS,
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

Deno.test('guest messages can use a trip link but not secrets', () => {
  const ok = validatePropertyTemplateTokens({
    templateKey: 'message-check-in-day',
    category: 'message',
    group: 'guest-messages',
    content: '<p>Your steps: {{trip_url}}</p>',
  });
  assertEquals(ok.errors, []);

  const secret = validatePropertyTemplateTokens({
    templateKey: 'message-check-in-day',
    category: 'message',
    group: 'guest-messages',
    content: '<p>{{door_code}}</p>',
  });
  assertEquals(secret.errors.length, 1);
});

Deno.test('the render-time scrub covers every guest CTA block', () => {
  for (const key of [
    'trip_cta_section',
    'parking_cta_section',
    'review_cta_section',
    'stay_guide_cta_section',
  ]) {
    assertEquals(TOKENIZED_LINK_PLACEHOLDER_KEYS.includes(key), true, `${key} must be scrubbed`);
  }
});

Deno.test('guest messages may use trip links', () => {
  const keys = propertyTemplatePlaceholderKeys('message-check-in-day', 'message');
  assertEquals(keys.includes('trip_url'), true);
  assertEquals(keys.includes('review_url'), true);
  assertEquals(keys.includes('stay_guide_url'), true);
  assertEquals(keys.includes('messages_url'), true);
});

Deno.test('optional property lines are block placeholders', () => {
  for (const key of ['garbage_schedule_section', 'quiet_hours_section']) {
    assertEquals(isBlockLevelPropertyPlaceholder(key), true, `${key} should be block level`);
  }
});

Deno.test('guest messages reject team-only and email-only tokens', () => {
  const keys = propertyTemplatePlaceholderKeys('message-check-in-day', 'message');
  for (const token of [
    'booking_link',
    'booking_link_cta',
    'urgent_notice',
    'gcash_payment_section',
  ]) {
    assertEquals(keys.includes(token), false, `${token} must stay out of guest messages`);
  }
});
