/**
 * Refund escalation ladder (readiness PAY-02).
 *
 * The host is reminded on day 3 by `cancellation-refund-cron`. A refund the guest is still
 * waiting for then escalates past the host: support visibility at day 7, overdue at day 10.
 * A row waiting on the guest's own refund details never escalates against the host.
 */

export type RefundEscalationLevel = 'none' | 'support' | 'overdue';

export const REFUND_ESCALATE_AFTER_DAYS = 7;
export const REFUND_OVERDUE_AFTER_DAYS = 10;

export function refundEscalationLevel(input: {
  status: string;
  ageDays: number;
}): RefundEscalationLevel {
  if (input.status !== 'pending') return 'none';
  if (!Number.isFinite(input.ageDays) || input.ageDays < REFUND_ESCALATE_AFTER_DAYS) return 'none';
  return input.ageDays >= REFUND_OVERDUE_AFTER_DAYS ? 'overdue' : 'support';
}
