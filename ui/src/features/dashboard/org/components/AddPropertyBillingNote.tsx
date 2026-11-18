import type { AddPropertyPreview } from '@/features/dashboard/plans/lib/orgPlanApi';

import { formatMoneyCompact } from '@/utils/format/currency';
import { formatManilaLongDate } from '@/utils/format/dates';

/**
 * What adding a property does to the bill, from the server quote. Nothing on Free; on a paid plan
 * the property is covered at once and the prorated share joins the next payment; while payment
 * is overdue the property stays on Free until the host pays.
 */
export function AddPropertyBillingNote({ preview }: { preview: AddPropertyPreview | undefined }) {
  if (!preview || preview.status === 'free') return null;

  if (preview.status === 'overdue') {
    return (
      <p className="text-muted-foreground text-xs" role="note">
        Your plan payment is overdue. This property stays on Free until you pay.
      </p>
    );
  }

  const renewsOn = preview.renewsAt ? formatManilaLongDate(preview.renewsAt) : null;
  return (
    <p className="text-muted-foreground text-xs" role="note">
      Adds {formatMoneyCompact(preview.addsMonthlyPhp)} a month to your {preview.planName} plan
      {renewsOn ? ` from ${renewsOn}` : ''}.
      {preview.trueUpPhp > 0
        ? ` ${formatMoneyCompact(preview.trueUpPhp)} for the rest of this period is added to your next payment.`
        : ''}
    </p>
  );
}
