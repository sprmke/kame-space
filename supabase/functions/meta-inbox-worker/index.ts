/**
 * meta-inbox-worker — drains the Meta webhook outbox.
 * Trigger: hosted pg_cron + pg_net through a SQL gate, so idle minutes cost nothing.
 */

import { serveCronPost } from '../_shared/serveEdge.ts';
import {
  runMetaInboxWorker,
  verifyMetaInboxWorkerCronSecret,
} from '../_shared/metaInboxWorkerCron.ts';

serveCronPost('meta-inbox-worker', verifyMetaInboxWorkerCronSecret, runMetaInboxWorker);
