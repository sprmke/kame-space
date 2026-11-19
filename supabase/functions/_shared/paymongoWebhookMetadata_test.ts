import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  extractPaidPaymentId,
  extractRefundedPaymentId,
  paymentMethodFromWebhookPayload,
} from './paymongoWebhookMetadata.ts';

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

Deno.test('payment method: from a payment.paid event (the payment source)', () => {
  assertEquals(
    paymentMethodFromWebhookPayload(
      event({ id: 'pay_1', type: 'payment', attributes: { source: { type: 'paymaya' } } })
    ),
    'paymaya'
  );
});

Deno.test('payment method: from a checkout_session event (payments[])', () => {
  assertEquals(
    paymentMethodFromWebhookPayload(
      event({
        id: 'cs_1',
        type: 'checkout_session',
        attributes: {
          payments: [
            {
              id: 'pay_1',
              type: 'payment',
              attributes: { status: 'paid', source: { type: 'gcash' } },
            },
          ],
        },
      })
    ),
    'gcash'
  );
});

Deno.test('payment method: null when the event names none', () => {
  assertEquals(
    paymentMethodFromWebhookPayload(
      event({ id: 'cs_1', type: 'checkout_session', attributes: { payments: [] } })
    ),
    null
  );
  assertEquals(paymentMethodFromWebhookPayload({}), null);
});
