import type { AddPropertyPreview } from '@/features/dashboard/plans/lib/orgPlanApi';

import { formatMoneyCompact } from '@/utils/format/currency';
import { formatManilaLongDate } from '@/utils/format/dates';

type Props = {
  preview: AddPropertyPreview | undefined;
  /** The quote request failed, so the price is unknown rather than free. */
  isError?: boolean;
  onRetry?: () => void;
};

/**
 * What adding a property does to the bill, from the server quote. Nothing on Free; on a paid plan
 * the property is covered at once and the prorated share joins the next payment; while payment
 * is overdue the property stays on Free until the host pays.
 */
export function AddPropertyBillingNote({ preview, isError = false, onRetry }: Props) {
  if (isError) {
    return (
      <p className="text-destructive text-xs" role="alert">
        Could not load the plan price.{' '}
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-[24px] items-center font-semibold underline underline-offset-2"
          >
            Retry
          </button>
        ) : null}
      </p>
    );
  }

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
