/**
 * pending-review-expiry — releases dates held by a request the host never answered.
 * Trigger: hosted pg_cron + pg_net.
 * See docs/architecture/guest-emails.md § Request expiry.
 *
 * Idempotent: the chase stamps `pending_review_chased_at`, expiry re-checks the status, and a
 * booking already `CANCELLED` returns `alreadyCancelled` from the cancellation service.
 */

import {
  runPendingReviewExpirySweep,
  verifyPendingReviewExpiryCronSecret,
} from '../_shared/pendingReviewExpiry.ts';
import { serveCronPost } from '../_shared/serveEdge.ts';

serveCronPost('pending-review-expiry', verifyPendingReviewExpiryCronSecret, async () => {
  return await runPendingReviewExpirySweep();
});
