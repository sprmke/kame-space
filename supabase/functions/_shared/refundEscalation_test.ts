import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { refundEscalationLevel } from './refundEscalation.ts';

Deno.test('refund escalation: pending refunds escalate at 7 and are overdue at 10', () => {
  assertEquals(refundEscalationLevel({ status: 'pending', ageDays: 6 }), 'none');
  assertEquals(refundEscalationLevel({ status: 'pending', ageDays: 7 }), 'support');
  assertEquals(refundEscalationLevel({ status: 'pending', ageDays: 9 }), 'support');
  assertEquals(refundEscalationLevel({ status: 'pending', ageDays: 10 }), 'overdue');
  assertEquals(refundEscalationLevel({ status: 'pending', ageDays: 40 }), 'overdue');
});

Deno.test('refund escalation: guest-side and terminal statuses never escalate', () => {
  assertEquals(refundEscalationLevel({ status: 'awaiting_guest_details', ageDays: 30 }), 'none');
  assertEquals(refundEscalationLevel({ status: 'sent', ageDays: 30 }), 'none');
  assertEquals(refundEscalationLevel({ status: 'not_due', ageDays: 30 }), 'none');
  assertEquals(refundEscalationLevel({ status: 'cancelled', ageDays: 30 }), 'none');
});

Deno.test('refund escalation: an invalid age is ignored', () => {
  assertEquals(refundEscalationLevel({ status: 'pending', ageDays: Number.NaN }), 'none');
});
