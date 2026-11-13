import { webhookContract } from '../harness/webhookContract.ts';

webhookContract({
  name: 'approval-email-webhook',
  signatureHeader: 'svix-signature',
  secretEnvKey: 'RESEND_INBOUND_WEBHOOK_SECRET',
  payload: JSON.stringify({ type: 'email.received', data: { email_id: 'test', to: ['docs@example.test'] } }),
});
