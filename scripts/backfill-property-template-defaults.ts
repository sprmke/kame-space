#!/usr/bin/env bun
/**
 * One-shot: delete property template rows that still hold a previously shipped default.
 *
 * Properties that never edited a default should fall through to the new copy. A row whose
 * normalized content equals an old default is exactly that case.
 *
 * Usage:
 *   bun scripts/backfill-property-template-defaults.ts            # dry run
 *   bun scripts/backfill-property-template-defaults.ts --execute  # delete matched rows
 *
 * Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, falling back to the local stack.
 * Never run against production without the team's explicit approval.
 */

import { createClient } from '@supabase/supabase-js';

/** Shipped defaults before the condo pack rewrite. Frozen on purpose. */
const OLD_DEFAULTS: Record<string, string> = {
  'house-rules': `<h2>House Rules</h2>
<p>Welcome to our property! Please follow these guidelines to ensure a pleasant stay:</p>
<ul>
<li><strong>No smoking</strong> inside the property</li>
<li><strong>No parties or events</strong> without prior approval</li>
<li><strong>Quiet hours</strong> from 10 PM to 8 AM</li>
<li><strong>Pets</strong> allowed with prior approval and additional fee</li>
<li><strong>Maximum occupancy</strong> must be respected</li>
</ul>
<p>Please treat the property with care and respect. Any damages will be deducted from the security deposit.</p>`,
  'check-in-instructions': `<h2>Check-in Instructions</h2>
<p>Welcome! Here's everything you need to know for your check-in:</p>
<h3>Check-in Time</h3>
<p>Standard check-in time is <strong>2:00 PM</strong>. Early check-in may be available upon request.</p>
<h3>Getting Access</h3>
<ol>
<li>Upon arrival, proceed to the building lobby</li>
<li>Check in at the front desk with your valid ID</li>
<li>Collect your keys and parking pass (if applicable)</li>
</ol>
<h3>Self Check-in (After Hours)</h3>
<p>For late arrivals, use the lockbox code sent to your email. The lockbox is located near the main entrance.</p>`,
  'check-out-instructions': `<h2>Check-out Instructions</h2>
<p>Thank you for staying with us! Please follow these steps for check-out:</p>
<h3>Check-out Time</h3>
<p>Standard check-out time is <strong>11:00 AM</strong>. Late check-out may be available upon request.</p>
<h3>Before You Leave</h3>
<ul>
<li>Return all keys to the front desk or lockbox</li>
<li>Dispose of trash in designated bins</li>
<li>Ensure all windows and doors are locked</li>
<li>Turn off all lights and air conditioning</li>
<li>Check for personal belongings</li>
</ul>`,
  'parking-reminders': `<h2>Parking Reminders</h2>
<p>Important information about parking at our property:</p>
<h3>Parking Registration</h3>
<p>All vehicles must be registered with building security. Please provide:</p>
<ul>
<li>Vehicle plate number</li>
<li>Vehicle make/model</li>
<li>Vehicle color</li>
</ul>
<h3>Parking Rules</h3>
<ul>
<li>Park only in designated guest parking areas</li>
<li>Display your parking pass visibly on your dashboard</li>
<li>Do not park in reserved or handicap spaces without proper permits</li>
</ul>`,
  'email-gaf-request': `<p>{{urgent_notice}}</p>
<p>{{update_notice}}</p>
<p>Good day,</p>
<p>Kindly review the Guest Advise Form (GAF) request for <strong>{{tower_and_unit_number}}</strong>, dated from <strong>{{check_in_date}} to {{check_out_date}}</strong>, for your approval.</p>
<p>Please let me know if you need any additional information.</p>
<p>Thank you for your assistance.</p>
<p>{{email_signature_section}}</p>`,
  'email-pet-request': `<p>{{urgent_notice}}</p>
<p>{{update_notice}}</p>
<p>Good day,</p>
<p>May we kindly request approval for our guest to bring a pet during their stay at <strong>{{tower_and_unit_number}}</strong> from <strong>{{check_in_date}}</strong> to <strong>{{check_out_date}}</strong>.</p>
<p>{{pet_details_section}}</p>
<p>{{pet_attachments_section}}</p>
<p>Please let us know if you need any additional information or documentation.</p>
<p>Thank you for your consideration.</p>
<p>{{email_signature_section}}</p>`,
  'email-new-booking-request': `<p>{{urgent_notice}}</p>
<p>A new booking request has been submitted. Please <strong>review and approve as soon as possible</strong>.</p>
<p>{{new_booking_detail_tables}}</p>
<p>{{downpayment_receipt_ai_section}}</p>
<p>{{booking_link_cta}}</p>`,
  'email-booking-request-received': `<p>Hi <strong>{{guest_facebook_name}}</strong>,</p>
<p>We received your booking request for <strong>{{property_name}}</strong> from <strong>{{check_in_date}}</strong> to <strong>{{check_out_date}}</strong>.</p>
<p>Your host is reviewing it now. We will email you as soon as it is confirmed.</p>
<p>{{booking_request_received_flow_section}}</p>
<p>{{email_signature_section}}</p>`,
  'email-booking-acknowledgement': `<p>{{booking_acknowledgement_flow_section}}</p>
<p>Thank you for choosing {{property_name}}. We look forward to hosting you!</p>
<p>{{email_signature_section}}</p>`,
  'email-ready-for-checkin': `<p>Dear <strong>{{guest_facebook_name}}</strong>,</p>
<p>Your check-in details are ready. We look forward to hosting you.</p>
<p>{{trip_cta_section}}</p>
<p>{{ready_for_checkin_booking_summary_section}}</p>
<p>{{payment_breakdown_section}}</p>
<p>{{gcash_payment_section}}</p>
<p>{{document_reminders_section}}</p>
<p>{{stay_guide_cta_section}}</p>
<p>{{ready_for_checkin_contact_section}}</p>
<p>{{email_signature_section}}</p>`,
  'email-sd-refund-form-request': `<p>Hi <strong>{{guest_facebook_name}}</strong>,</p>
<p>Thank you for staying with us! We hope you had a wonderful stay! Please follow the check-out instructions below. After that, please open and fill out the SD refund form so that we can process your refund.</p>
<p>{{sd_refund_checklist_section}}</p>
<p>{{sd_refund_details_section}}</p>
<p>{{trip_cta_section}}</p>`,
  'email-booking-cancelled-guest': `<p>Hi <strong>{{guest_facebook_name}}</strong>,</p>
<p>{{cancellation_intro}}</p>
<p>This is for your stay at <strong>{{tower_and_unit_number}}</strong> from <strong>{{check_in_date}}</strong> to <strong>{{check_out_date}}</strong>.</p>
<p>{{cancellation_detail_section}}</p>
<p>You can see the latest status any time from your trip page.</p>
<p>{{trip_cta_section}}</p>
<p>{{email_signature_section}}</p>`,
  'email-booking-cancelled-host': `<p>Hello,</p>
<p>A booking was cancelled.</p>
<p>{{cancellation_detail_section}}</p>
<p>{{email_signature_section}}</p>`,
  'email-cancellation-request-guest': `<p>Hi <strong>{{guest_facebook_name}}</strong>,</p>
<p><strong>{{cancellation_request_title}}</strong></p>
<p>{{cancellation_detail_section}}</p>
<p>{{trip_cta_section}}</p>
<p>{{email_signature_section}}</p>`,
  'email-refund-sent-guest': `<p>Hi <strong>{{guest_facebook_name}}</strong>,</p>
<p>Your refund has been sent.</p>
<p>{{cancellation_detail_section}}</p>
<p>{{trip_cta_section}}</p>
<p>{{email_signature_section}}</p>`,
};

const BATCH = 200;

function normalize(html: string): string {
  return html
    .replace(
      /<li(\s[^>]*)?>([\s\S]*?)<\/li>/gi,
      (match, attrs: string | undefined, inner: string) => {
        const body = String(inner ?? '').trim();
        if (!body || /^<(p|ul|ol|table|h[1-6])\b/i.test(body)) return match;
        return `<li${attrs ?? ''}><p>${body}</p></li>`;
      }
    )
    .replace(/\s*\n\s*/g, '')
    .trim();
}

const execute = process.argv.includes('--execute');
const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const isLocalStack = url.includes('127.0.0.1') || url.includes('localhost');
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SERVICE_ROLE_KEY ??
  // Default local-stack service role key (same value in every local checkout).
  (isLocalStack
    ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
    : '');
if (!key) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY (or SERVICE_ROLE_KEY).');
  process.exit(1);
}

const supabase = createClient(url, key);
const oldNormalized = new Map(
  Object.entries(OLD_DEFAULTS).map(([templateKey, content]) => [templateKey, normalize(content)])
);

const counts = new Map<string, number>();
const matchedIds: string[] = [];
let scanned = 0;

// Collect first, delete later. Deleting while paging by range shifts rows and can skip some.
for (let from = 0; ; from += BATCH) {
  const { data, error } = await supabase
    .from('property_template_contents')
    .select('id, property_id, template_key, content, subject')
    .in('template_key', Object.keys(OLD_DEFAULTS))
    .order('id', { ascending: true })
    .range(from, from + BATCH - 1);
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) break;

  for (const row of rows) {
    scanned += 1;
    const templateKey = String(row.template_key);
    const expected = oldNormalized.get(templateKey);
    if (!expected) continue;
    const subject = String(row.subject ?? '').trim();
    if (subject) continue;
    if (normalize(String(row.content ?? '')) !== expected) continue;

    matchedIds.push(String(row.id));
    counts.set(templateKey, (counts.get(templateKey) ?? 0) + 1);
    if (!execute && matchedIds.length <= 50) {
      console.log(`  match ${row.property_id} ${templateKey} ${row.id}`);
    }
  }

  if (rows.length < BATCH) break;
}

if (execute) {
  for (let index = 0; index < matchedIds.length; index += BATCH) {
    const chunk = matchedIds.slice(index, index + BATCH);
    const { error } = await supabase.from('property_template_contents').delete().in('id', chunk);
    if (error) throw error;
  }
}

console.log(
  `${execute ? 'Deleted' : 'Would delete'} ${matchedIds.length} of ${scanned} built-in rows.`
);
for (const [templateKey, count] of [...counts].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`  ${templateKey}: ${count}`);
}
if (!execute) console.log('\nDry run only. Re-run with --execute to delete.');
