import { useState } from 'react';

import {
  useCancelPriceMigration,
  usePriceMigrationPreview,
  useSchedulePriceMigration,
} from '@/features/dashboard/super-admin/hooks/usePricingPlans';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatMoneyCompact } from '@/utils/format/currency';
import { formatManilaLongDate } from '@/utils/format/dates';

const MIN_NOTICE_DAYS = 30;

function earliestDateInput(): string {
  const date = new Date(Date.now() + (MIN_NOTICE_DAYS + 1) * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

/**
 * Subscribers keep the price they bought. This moves them to the plan's current price at their
 * first renewal on or after the chosen date, and tells every affected owner first.
 */
export function PriceMigrationSection({ planId }: { planId: string }) {
  const preview = usePriceMigrationPreview(planId, true);
  const schedule = useSchedulePriceMigration(planId);
  const cancel = useCancelPriceMigration(planId);
  const [date, setDate] = useState(earliestDateInput());

  const data = preview.data;
  const change = data?.monthlyChangePhp ?? 0;

  return (
    <section
      aria-labelledby="price-migration-heading"
      className="border-border/60 space-y-3 rounded-xl border p-4"
    >
      <div>
        <h3 id="price-migration-heading" className="text-sm font-semibold">
          Move subscribers to the current price
        </h3>
        <p className="text-muted-foreground mt-1 text-xs">
          Changing a price above only affects new purchases. Existing subscribers keep what they
          bought until you move them. They are emailed first and move at their first renewal on or
          after the date.
        </p>
      </div>

      {preview.isLoading ? (
        <div className="bg-muted h-8 animate-pulse rounded" aria-hidden />
      ) : data ? (
        <p className="text-sm">
          {data.affectedCount === 0
            ? 'Everyone on this plan already has the current price.'
            : `${data.affectedCount} ${data.affectedCount === 1 ? 'subscription is' : 'subscriptions are'} on an older price. Combined monthly change: ${change < 0 ? '-' : '+'}${formatMoneyCompact(Math.abs(change))}.`}
        </p>
      ) : null}

      {data && data.affectedCount > 0 ? (
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            if (!date) return;
            schedule.mutate(new Date(`${date}T00:00:00+08:00`).toISOString());
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="price-migration-date">Effective on or after</Label>
            <Input
              id="price-migration-date"
              type="date"
              min={earliestDateInput()}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          <Button type="submit" className="min-h-[44px]" disabled={schedule.isPending || !date}>
            {schedule.isPending ? 'Scheduling…' : 'Notify and schedule'}
          </Button>
        </form>
      ) : null}

      {data && data.scheduled.length > 0 ? (
        <ul className="divide-border divide-y text-sm">
          {data.scheduled.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-2">
              <span>
                From {formatManilaLongDate(item.effectiveOn)}
                <span className="text-muted-foreground"> · {item.notifiedCount} notified</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-[44px]"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate(item.id)}
              >
                Cancel
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
