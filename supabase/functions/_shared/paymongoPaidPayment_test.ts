import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { paidPaymentFromCheckoutSession } from './paymongoClient.ts';

// Shape taken from a real sandbox session paid with the test card: the session stays "active"
// and the payment lives only in payments[].
const paidSession = {
  status: 'active',
  paid_at: null,
  payments: [
    {
      id: 'pay_U19a2XzmdZMjNCsfqsoG7pQa',
      type: 'payment',
      attributes: {
        status: 'paid',
        paid_at: 1795019596,
        amount: 5000,
        currency: 'PHP',
        source: { type: 'card', brand: 'visa', last4: '4345' },
      },
    },
  ],
};

Deno.test('paid payment: id, method and paid time come from payments[]', () => {
  assertEquals(paidPaymentFromCheckoutSession(paidSession), {
    paymentId: 'pay_U19a2XzmdZMjNCsfqsoG7pQa',
    methodType: 'card',
    paidAt: new Date(1795019596 * 1000).toISOString(),
  });
});

Deno.test('paid payment: none while unpaid, failed or malformed', () => {
  assertEquals(paidPaymentFromCheckoutSession({ status: 'active', payments: [] }), null);
  assertEquals(paidPaymentFromCheckoutSession(undefined), null);
  assertEquals(
    paidPaymentFromCheckoutSession({
      payments: [{ id: 'pay_x', type: 'payment', attributes: { status: 'failed' } }],
    }),
    null
  );
  assertEquals(
    paidPaymentFromCheckoutSession({
      payments: [{ type: 'payment', attributes: { status: 'paid' } }],
    }),
    null
  );
});

Deno.test('paid payment: skips a failed attempt and finds the paid one', () => {
  const found = paidPaymentFromCheckoutSession({
    payments: [
      { id: 'pay_fail', type: 'payment', attributes: { status: 'failed' } },
      { id: 'pay_ok', type: 'payment', attributes: { status: 'paid', source: { type: 'gcash' } } },
    ],
  });
  assertEquals(found?.paymentId, 'pay_ok');
  assertEquals(found?.methodType, 'gcash');
  assertEquals(found?.paidAt, null);
});
