/**
 * Secrets and entry point for the `meta-inbox-worker` cron.
 *
 * The worker is the safety net behind the webhook fast path: it drains the outbox and runs
 * the import and reconciliation jobs. pg_cron only calls it when there is due work.
 */

import { verifyCronSecret } from './cronSecretGate.ts';
import { processMetaWebhookBatch } from './metaInboxProcessor.ts';
import { runMetaSyncBatch } from './metaInboxSync.ts';

export function verifyMetaInboxWorkerCronSecret(req: Request): boolean {
  return verifyCronSecret(req, {
    envKey: 'META_INBOX_WORKER_SECRET',
    headerName: 'x-meta-inbox-worker-secret',
  });
}

export async function runMetaInboxWorker(): Promise<Record<string, unknown>> {
  // Outbox first: it is a short, bounded batch and it is what the host is waiting on.
  const outbox = await processMetaWebhookBatch();
  const sync = await runMetaSyncBatch({ budgetMs: 30_000 });

  return {
    outbox,
    sync: {
      jobs: sync.length,
      imported: sync.filter((job) => job.job === 'import').length,
      reconciled: sync.filter((job) => job.job === 'reconcile').length,
      conversations: sync.reduce((total, job) => total + job.conversations, 0),
      messages: sync.reduce((total, job) => total + job.messages, 0),
      errors: sync.filter((job) => job.errorCode).map((job) => job.errorCode),
    },
  };
}
