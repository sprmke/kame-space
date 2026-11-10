/**
 * Secrets and entry point for the `meta-inbox-worker` cron.
 *
 * The worker is the safety net behind the webhook fast path: it drains the outbox and, in
 * later phases, runs reconciliation. pg_cron only calls it when there is due work.
 */

import { verifyCronSecret } from './cronSecretGate.ts';
import { processMetaWebhookBatch } from './metaInboxProcessor.ts';

export function verifyMetaInboxWorkerCronSecret(req: Request): boolean {
  return verifyCronSecret(req, {
    envKey: 'META_INBOX_WORKER_SECRET',
    headerName: 'x-meta-inbox-worker-secret',
  });
}

export async function runMetaInboxWorker(): Promise<Record<string, unknown>> {
  const outbox = await processMetaWebhookBatch();
  return { outbox };
}
