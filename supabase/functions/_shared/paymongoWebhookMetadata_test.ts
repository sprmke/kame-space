import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { extractPaidPaymentId, extractRefundedPaymentId } from './paymongoWebhookMetadata.ts';

const event = (inner: Record<string, unknown>) => ({ data: { attributes: { data: inner } } });

Deno.test('paid payment id: from a payment resource', () => {
  assertEquals(
    extractPaidPaymentId(event({ id: 'pay_1', type: 'payment', attributes: {} })),
    'pay_1'
  );
});

Deno.test('paid payment id: from a checkout session, first payment', () => {
  assertEquals(
    extractPaidPaymentId(
      event({ id: 'cs_1', type: 'checkout_session', attributes: { payments: [{ id: 'pay_2' }] } })
    ),
    'pay_2'
  );
});

Deno.test('paid payment id: null when the payload has none', () => {
  assertEquals(
    extractPaidPaymentId(
      event({ id: 'cs_1', type: 'checkout_session', attributes: { payments: [] } })
    ),
    null
  );
  assertEquals(extractPaidPaymentId({}), null);
});

Deno.test('refunded payment id: read from the refund resource', () => {
  assertEquals(
    extractRefundedPaymentId(
      event({ id: 'ref_1', type: 'refund', attributes: { payment_id: 'pay_9' } })
    ),
    'pay_9'
  );
  assertEquals(
    extractRefundedPaymentId(event({ id: 'ref_1', type: 'refund', attributes: {} })),
    null
  );
});
