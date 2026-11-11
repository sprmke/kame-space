/**
 * Acknowledgement "What's next" steps must follow the property's own requirements.
 * Plan 6.2 / finding F1: the default copy told every guest about the GAF and the building
 * administration, which is wrong for a property that needs no documents.
 * Run: deno test supabase/functions/_shared/bookingAcknowledgementFlow_test.ts
 */

import { assert, assertEquals, assertMatch, assertNotMatch } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildBookingAcknowledgementFlowSectionHtml } from './propertyTemplateEmailSections.ts';

const CONTACT = {
  contactName: 'Ana',
  contactPhone: '09170000000',
  contactEmail: 'host@example.com',
  facebookPageUrl: 'https://facebook.com/example',
  airbnbUrl: '',
};

function build(requiredDocuments: string[]) {
  return buildBookingAcknowledgementFlowSectionHtml({
    unitLabel: 'Monaco 2604',
    checkIn: 'December 10, 2026',
    checkOut: 'December 12, 2026',
    brandColor: '#0f766e',
    contact: CONTACT,
    requiredDocuments,
  });
}

Deno.test('no documents means no GAF and no building administration', () => {
  const html = build([]);
  assertNotMatch(html, /GAF/i);
  assertNotMatch(html, /building administration/i);
  assertNotMatch(html, /two \(2\) business days/i);
  assertMatch(html, /What's next/i);
});

Deno.test('no documents still promises the check-in details email', () => {
  const html = build([]);
  assertMatch(html, /check-in details email/i);
});

Deno.test('a GAF requirement names the GAF and the building', () => {
  const html = build(['Guest Advice Form (GAF)']);
  assertMatch(html, /Guest Advice Form \(GAF\)/);
  assertMatch(html, /building administration/i);
});

Deno.test('a pet requirement names the pet form instead of the GAF', () => {
  const html = build(['Pet Approval']);
  assertMatch(html, /Pet Approval/);
  assertNotMatch(html, /GAF/i);
});

Deno.test('both requirements list both documents', () => {
  const html = build(['Guest Advice Form (GAF)', 'Pet Approval']);
  assertMatch(html, /Guest Advice Form \(GAF\)/);
  assertMatch(html, /Pet Approval/);
});

Deno.test('never calls the follow-up a "Booking Confirmation email"', () => {
  assertEquals(/booking confirmation email/i.test(build(['Guest Advice Form (GAF)'])), false);
});

Deno.test('the summary says confirmed, not approved', () => {
  const html = build([]);
  assertMatch(html, /is confirmed/i);
  assertNotMatch(html, /has been approved/i);
  assert(html.includes('Monaco 2604'));
});
