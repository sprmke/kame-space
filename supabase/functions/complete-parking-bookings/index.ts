/**
 * complete-parking-bookings — daily sweep that closes READY_FOR_CHECKIN parking bookings past
 * their checkout date. Trigger: hosted pg_cron + pg_net, mirrors send-parking-reminders.
 */

import {
  runParkingCompletionSweep,
  verifyParkingCompletionCronSecret,
} from '../_shared/parkingCompletionCron.ts';
import { serveCronPost } from '../_shared/serveEdge.ts';

serveCronPost('complete-parking-bookings', verifyParkingCompletionCronSecret, async () => {
  return await runParkingCompletionSweep();
});
