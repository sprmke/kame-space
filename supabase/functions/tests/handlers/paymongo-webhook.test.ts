import { webhookContract } from '../harness/webhookContract.ts';

webhookContract({
  name: 'paymongo-webhook',
  signatureHeader: 'Paymongo-Signature',
  secretEnvKey: 'PAYMONGO_WEBHOOK_SECRET',
  payload: JSON.stringify({ data: { id: 'evt_test', attributes: { type: 'checkout_session.payment.paid' } } }),
});
