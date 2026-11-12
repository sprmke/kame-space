/**
 * pre-arrival-reminders — T-48h guest nudge. Trigger: hosted pg_cron + pg_net.
 * See docs/architecture/guest-emails.md § Pre-arrival reminder.
 *
 * Idempotent: `guest_submissions.pre_arrival_emailed_at` is stamped per send, so an
 * overlapping run cannot email the same guest twice.
 */

import {
  runPreArrivalReminderSweep,
  verifyPreArrivalReminderCronSecret,
} from '../_shared/preArrivalReminderCron.ts';
import { serveCronPost } from '../_shared/serveEdge.ts';

serveCronPost('pre-arrival-reminders', verifyPreArrivalReminderCronSecret, async () => {
  return await runPreArrivalReminderSweep();
});
