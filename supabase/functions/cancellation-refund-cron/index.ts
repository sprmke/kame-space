/**
 * cancellation-refund-cron — daily sweep for refunds that need a nudge and
 * cancellation requests that expired at check-in.
 *
 * Runs via hosted pg_cron + pg_net. Secret: CANCELLATION_REFUND_CRON_SECRET
 * (header `x-cancellation-refund-cron-secret`).
 */

import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import { expireStaleCancellationRequests } from '../_shared/cancellationService.ts';
import { verifyCronSecret } from '../_shared/cronSecretGate.ts';
import { createNotification } from '../_shared/notificationService.ts';
import { raiseOpsAlert, resolveOpsAlert } from '../_shared/ops/opsAlert.ts';
import { refundEscalationLevel } from '../_shared/refundEscalation.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { serveCronPost } from '../_shared/serveEdge.ts';

const PENDING_AFTER_DAYS = 3;
const AWAITING_DETAILS_AFTER_DAYS = 2;

function verifyCancellationRefundCronSecret(req: Request): boolean {
  return verifyCronSecret(req, {
    envKey: 'CANCELLATION_REFUND_CRON_SECRET',
    headerName: 'x-cancellation-refund-cron-secret',
  });
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

serveCronPost('cancellation-refund-cron', verifyCancellationRefundCronSecret, async () => {
  const expiredRequests = await expireStaleCancellationRequests();
  const sb = createServiceClient();

  const { data: refunds } = await sb
    .from('booking_refunds')
    .select(
      'id, booking_id, property_id, organization_id, status, amount_due_php, created_at, guest_submissions(primary_guest_name)'
    )
    .in('status', ['pending', 'awaiting_guest_details'])
    .lt('created_at', daysAgoIso(AWAITING_DETAILS_AFTER_DAYS))
    .limit(500);

  let nudged = 0;
  const byOrg = new Map<string, number>();
  let escalated = 0;
  let overdue = 0;
  let overdueTotalPhp = 0;
  let oldestOverdueDays = 0;

  for (const row of (refunds ?? []) as Array<Record<string, unknown>>) {
    const status = String(row.status);
    const createdAt = String(row.created_at ?? '');
    const ageDays = Math.floor((Date.now() - Date.parse(createdAt)) / (24 * 60 * 60 * 1000));
    if (!Number.isFinite(ageDays)) continue;

    // Escalation is only for money the guest is waiting on. A missing refund-details row is
    // on the guest, not the host.
    const level = refundEscalationLevel({ status, ageDays });
    if (level !== 'none') {
      escalated += 1;
      if (level === 'overdue') {
        overdue += 1;
        overdueTotalPhp += Number(row.amount_due_php ?? 0);
        oldestOverdueDays = Math.max(oldestOverdueDays, ageDays);
      }
    }

    const threshold =
      status === 'pending'
        ? daysAgoIso(PENDING_AFTER_DAYS)
        : daysAgoIso(AWAITING_DETAILS_AFTER_DAYS);
    if (createdAt >= threshold) continue;

    const organizationId = String(row.organization_id ?? '');
    if (!organizationId) continue;
    const bookingId = String(row.booking_id);
    const guest = row.guest_submissions as Record<string, unknown> | undefined;
    const guestName = String(guest?.primary_guest_name ?? '').trim() || 'A guest';

    await createNotification({
      organizationId,
      propertyId: String(row.property_id),
      type: 'booking_refund_due',
      title: status === 'pending' ? 'Refund still pending' : 'Waiting for refund details',
      body:
        status === 'pending'
          ? `Send ${guestName}'s refund and mark it sent.`
          : `${guestName} has not added refund details yet.`,
      bookingId,
      metadata: { refund_id: String(row.id), amount_due_php: Number(row.amount_due_php ?? 0) },
      dedupeKey: `${bookingId}:refund_due:${new Date().toISOString().slice(0, 10)}`,
    });
    nudged += 1;
    byOrg.set(organizationId, (byOrg.get(organizationId) ?? 0) + 1);
  }

  if (escalated > 0) {
    // One open alert per class; the dispatcher aggregates occurrences and throttles repeats.
    await raiseOpsAlert({
      key: overdue > 0 ? 'refund:overdue_10d' : 'refund:escalated_7d',
      tier: overdue > 0 ? 'p1' : 'p2',
      source: 'job',
      title: overdue > 0 ? 'Guest refunds overdue' : 'Guest refunds waiting on the host',
      summary:
        overdue > 0
          ? `${overdue} refund(s) past 10 days. Confirm the host has sent them or contact the host.`
          : `${escalated} refund(s) past 7 days. The host has been reminded.`,
      context: {
        escalated,
        overdue,
        oldest_overdue_days: oldestOverdueDays,
        overdue_total_php: Math.round(overdueTotalPhp),
      },
    });
  }

  // Clear the ladder once nothing is overdue, and never leave both the 7-day and 10-day
  // alerts open for the same case.
  if (escalated === 0) {
    await resolveOpsAlert('refund:overdue_10d');
    await resolveOpsAlert('refund:escalated_7d');
  } else if (overdue > 0) {
    await resolveOpsAlert('refund:escalated_7d');
  }

  for (const [organizationId, count] of byOrg) {
    await logActivity({
      action: 'system.cron_run',
      organizationId,
      actor: buildActorContext('cron', { cron: 'cancellation-refund-cron' }),
      metadata: {
        message: 'Cancellation refund cron finished',
        count,
        refunds_nudged: count,
        refunds_escalated: escalated,
        requests_expired: expiredRequests,
      },
    });
  }

  return {
    refundsNudged: nudged,
    refundsEscalated: escalated,
    refundsOverdue: overdue,
    requestsExpired: expiredRequests,
  };
});
