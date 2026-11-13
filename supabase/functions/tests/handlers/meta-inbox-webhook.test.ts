import { webhookContract } from '../harness/webhookContract.ts';

webhookContract({
  name: 'meta-inbox-webhook',
  signatureHeader: 'X-Hub-Signature-256',
  secretEnvKey: 'META_APP_SECRET',
  payload: JSON.stringify({ object: 'instagram', entry: [] }),
});
