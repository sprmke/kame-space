/**
 * data-subject-requests-cron — daily RA 10173 due-date check (ledger PR-145).
 *
 * Deletion requests get a 15-day due date. This job does not delete anything: when a request
 * is due it raises a P1 ops alert so the operator runs the documented anonymise/delete
 * runbook. Nothing personal is sent in the alert (ids and counts only).
 *
 * Trigger: Supabase cron daily (08:10 Asia/Manila), gated in SQL on a due request.
 */

import { verifyCronSecret } from '../_shared/cronSecretGate.ts';
import { listDueDeletionRequests } from '../_shared/dataSubjectService.ts';
import { raiseOpsAlert } from '../_shared/ops/opsAlert.ts';
import { serveCronPost } from '../_shared/serveEdge.ts';

serveCronPost(
  'data-subject-requests-cron',
  (req) =>
    verifyCronSecret(req, {
      envKey: 'DATA_SUBJECT_REQUESTS_CRON_SECRET',
      headerName: 'x-data-subject-cron-secret',
    }),
  async () => {
    const due = await listDueDeletionRequests();
    if (due.length > 0) {
      await raiseOpsAlert({
        key: 'privacy:deletion_requests_due',
        tier: 'p1',
        source: 'job',
        title: 'Data deletion requests due',
        summary: `${due.length} request(s) are past their 15-day due date. Run the RA 10173 deletion runbook.`,
        context: {
          count: due.length,
          oldest_request_id: due[0]?.id ?? null,
          oldest_due_at: due[0]?.due_at ?? null,
        },
      });
    }
    return { due: due.length, oldest_due_at: due[0]?.due_at ?? null };
  }
);
