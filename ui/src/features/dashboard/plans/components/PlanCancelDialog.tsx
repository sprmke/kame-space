import { useEffect, useState } from 'react';

import { Loader2 } from 'lucide-react';

import { PlanChangeList } from '@/features/dashboard/plans/components/PlanChangeList';
import { useSchedulePlanPreview } from '@/features/dashboard/plans/hooks/useOrgPlan';
import { CANCEL_REASON_OPTIONS } from '@/features/dashboard/plans/lib/cancelReasons';
import type { CancelReason } from '@/features/dashboard/plans/lib/orgPlanApi';
import type { PlanFeatureChange } from '@/features/dashboard/plans/lib/planPresentation';

import { PlanBillingLegalNotice } from '@/components/legal/LegalNoticePresets';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { cn } from '@/lib/utils';
import { formatManilaLongDate } from '@/utils/format/dates';

type PlanCancelDialogProps = {
  open: boolean;
  orgId: string | null;
  planName: string;
  /** Paid features the org loses when it moves to Free. */
  losses?: PlanFeatureChange[];
  /** `period_end`: keeps paid features until the period ends. `now`: an overdue plan, ends today. */
  mode: 'period_end' | 'now';
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: CancelReason | null) => Promise<void>;
  isSubmitting: boolean;
};

export function PlanCancelDialog({
  open,
  orgId,
  planName,
  losses = [],
  mode,
  onOpenChange,
  onConfirm,
  isSubmitting,
}: PlanCancelDialogProps) {
  const [reason, setReason] = useState<CancelReason | null>(null);
  const preview = useSchedulePlanPreview(orgId, 'cancel', null, open && mode === 'period_end');

  useEffect(() => {
    if (!open) setReason(null);
  }, [open]);

  const data = preview.data;
  const effectiveDate = data ? formatManilaLongDate(data.effectiveAt) : null;
  const previewError = preview.error instanceof Error ? preview.error.message : null;
  const loading = mode === 'period_end' && (preview.isLoading || preview.isFetching) && !data;

  const title = mode === 'now' ? `End ${planName} now` : `Cancel ${planName}`;
  const description =
    mode === 'now'
      ? 'The organization moves to Free today. Your data is kept.'
      : effectiveDate
        ? `Your plan ends on ${effectiveDate}. You keep every paid feature until then, and you can resume before that date.`
        : 'Your plan ends at the end of the billing period. You keep every paid feature until then.';

  const handleConfirm = async () => {
    try {
      await onConfirm(reason);
      onOpenChange(false);
    } catch {
      // The mutation already toasts the reason; stay open so the host can retry.
    }
  };

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        sheetLayout="split"
        overlayClassName="z-[110]"
        className={cn(
          'z-[111] flex max-h-[min(90dvh,42rem)] w-[min(calc(100vw-1.5rem),28rem)] max-w-none flex-col gap-0 overflow-hidden p-0',
          'sm:max-w-[28rem] sm:p-0'
        )}
        aria-describedby="plan-cancel-description"
      >
        <ResponsiveModalHeader className="border-border shrink-0 space-y-1 border-b px-4 pb-3 pr-14 pt-5 text-left sm:px-5">
          <ResponsiveModalTitle>{title}</ResponsiveModalTitle>
          <ResponsiveModalDescription id="plan-cancel-description">
            {description}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch] sm:px-5"
          aria-busy={loading}
        >
          <div className="space-y-5">
            {loading ? (
              <div className="space-y-2" aria-hidden>
                <div className="bg-muted h-4 w-2/3 animate-pulse rounded" />
                <div className="bg-muted h-4 w-1/2 animate-pulse rounded" />
              </div>
            ) : null}

            {previewError ? (
              <div
                role="alert"
                className="border-destructive/30 bg-destructive/5 text-destructive rounded-xl border p-3 text-sm"
              >
                {previewError}
              </div>
            ) : null}

            <PlanChangeList
              title={effectiveDate ? `Turns off on ${effectiveDate}` : 'Turns off'}
              items={losses}
              tone="loss"
            />

            {data && data.impact.length > 0 ? (
              <div>
                <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  What this affects
                </p>
                <ul className="mt-2 space-y-2.5">
                  {data.impact.map((item) => (
                    <li key={item.key} className="text-sm leading-relaxed">
                      <span className="text-foreground font-medium">{item.label}.</span>{' '}
                      <span className="text-muted-foreground">{item.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {mode === 'period_end' ? (
              <p className="text-muted-foreground text-sm">
                Past bookings, finance records, templates and every other record are kept. Paid
                features turn off on the end date.
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">
                Paid features stay off. Past bookings, finance records and templates are kept.
              </p>
            )}

            <fieldset>
              <legend className="text-foreground text-sm font-medium">
                Why are you leaving?{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </legend>
              <RadioGroup
                value={reason ?? ''}
                onValueChange={(value) => setReason(value as CancelReason)}
                className="mt-2 gap-1"
              >
                {CANCEL_REASON_OPTIONS.map((option) => (
                  <Label
                    key={option.value}
                    htmlFor={`cancel-reason-${option.value}`}
                    className="hover:bg-muted/50 flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-2 text-sm font-normal"
                  >
                    <RadioGroupItem value={option.value} id={`cancel-reason-${option.value}`} />
                    {option.label}
                  </Label>
                ))}
              </RadioGroup>
            </fieldset>

            <PlanBillingLegalNotice kind="cancel" />
          </div>
        </div>

        <ResponsiveModalFooter className="border-border shrink-0 gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px]"
            onClick={() => onOpenChange(false)}
          >
            Keep plan
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="min-h-[44px]"
            disabled={isSubmitting || loading || Boolean(previewError)}
            onClick={handleConfirm}
          >
            {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {mode === 'now'
              ? 'End plan now'
              : effectiveDate
                ? `Cancel on ${effectiveDate}`
                : 'Cancel at period end'}
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
