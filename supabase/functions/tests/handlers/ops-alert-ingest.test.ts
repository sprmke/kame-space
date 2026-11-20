import { webhookContract } from '../harness/webhookContract.ts';

webhookContract({
  name: 'ops-alert-ingest',
  signatureHeader: 'X-Ops-Signature',
  secretEnvKey: 'OPS_ALERT_INGEST_SECRET',
  payload: JSON.stringify({
    key: 'test:ops-alert-ingest',
    tier: 'drill',
    source: 'probe',
    title: 'Contract drill',
  }),
});
