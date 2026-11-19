import { Loader2, Save } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useDashboardCompactChrome } from '@/features/dashboard/lib/dashboardChromeContext';
import { computeParkingNightlyPayout } from '@/features/dashboard/parking/lib/parkingPayout';
import {
  STUB_COMMISSION_PCT,
  STUB_GUEST_FEE_FIXED,
  STUB_GUEST_FEE_PCT,
} from '@/features/dashboard/parking/lib/parkingPricingDefaults';
import {
  isValidParkingRate,
  PARKING_MIN_NIGHTLY_RATE,
  PARKING_RATE_STEP,
} from '@/features/dashboard/parking/lib/parkingRateRules';
import {
  pricingRatesFormStackClassName,
  pricingRatesFormSurfaceClassName,
} from '@/features/dashboard/pricing/lib/pricingCalendarLayout';
import { PRICING_HELP_COPY } from '@/features/dashboard/pricing/lib/pricingHelpCopy';

import { InfoHint } from '@/components/help/InfoHint';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type Props = {
  weekdayRate: number;
  weekendRate: number;
  /** Live super-admin-configured values; fall back to the stub defaults until loaded. */
  commissionPct?: number;
  guestFeePct?: number;
  guestFeeFixed?: number;
  readOnly?: boolean;
  hasChanges?: boolean;
  saving?: boolean;
  /** Hide the card footer save button (Setup Guide uses modal footer save). */
  embedded?: boolean;
  /** A cleared field reports NaN, which is never saved. */
  onWeekdayChange: (value: number) => void;
  onWeekendChange: (value: number) => void;
  onSaveClick: () => void;
};

function formatPhp(amount: number): string {
  return `₱${Math.round(amount).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

function formatPct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function MoneyInput({
  id,
  label,
  value,
  commissionPct,
  readOnly,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  commissionPct: number;
  readOnly?: boolean;
  onChange: (value: number) => void;
}) {
  // Keep what the host types as text so the field can be cleared and retyped.
  const [draft, setDraft] = useState(Number.isFinite(value) ? String(value) : '');
  useEffect(() => {
    if (!Number.isFinite(value)) return;
    setDraft((current) => (Number(current) === value ? current : String(value)));
  }, [value]);

  const invalid = !isValidParkingRate(value);
  const { commissionAmount, hostNet } = computeParkingNightlyPayout({
    hostRate: value,
    commissionPct,
  });

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-muted-foreground text-sm">
        {label}
      </Label>
      <div className="relative">
        <span className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm">
          ₱
        </span>
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={PARKING_MIN_NIGHTLY_RATE}
          step={PARKING_RATE_STEP}
          value={draft}
          disabled={readOnly}
          aria-invalid={invalid || undefined}
          aria-describedby={`${id}-help`}
          onChange={(e) => {
            const raw = e.target.value;
            setDraft(raw);
            onChange(raw.trim() === '' ? NaN : Number(raw));
          }}
          className={cn(
            'h-10 pl-8 text-sm tabular-nums',
            invalid && 'border-destructive focus-visible:ring-destructive'
          )}
        />
      </div>
      {invalid ? (
        <p id={`${id}-help`} className="text-destructive text-xs">
          Enter at least {formatPhp(PARKING_MIN_NIGHTLY_RATE)}.
        </p>
      ) : (
        <dl id={`${id}-help`} className="space-y-1 text-xs">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Guests see</dt>
            <dd className="text-foreground tabular-nums">{formatPhp(value)} / night</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Platform fee ({formatPct(commissionPct)})</dt>
            <dd className="text-muted-foreground tabular-nums">-{formatPhp(commissionAmount)}</dd>
          </div>
          <div className="border-border/60 flex items-baseline justify-between gap-3 border-t pt-1">
            <dt className="text-foreground font-medium">You receive</dt>
            <dd className="text-foreground font-semibold tabular-nums">
              {formatPhp(hostNet)} / night
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}

export function ParkingPricingRatesFormCard({
  weekdayRate,
  weekendRate,
  commissionPct = STUB_COMMISSION_PCT,
  guestFeePct = STUB_GUEST_FEE_PCT,
  guestFeeFixed = STUB_GUEST_FEE_FIXED,
  readOnly = false,
  hasChanges = false,
  saving = false,
  embedded = false,
  onWeekdayChange,
  onWeekendChange,
  onSaveClick,
}: Props) {
  const compactChrome = useDashboardCompactChrome();
  const ratesInvalid = !isValidParkingRate(weekdayRate) || !isValidParkingRate(weekendRate);

  return (
    <section className={pricingRatesFormSurfaceClassName(compactChrome)}>
      <div className={pricingRatesFormStackClassName(compactChrome)}>
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-foreground text-sm font-semibold">Base rates</h3>
            <InfoHint
              label="Base rates"
              text={PRICING_HELP_COPY.parkingPayout.hint}
              variant="section"
            />
          </div>
          <div className="mt-3 space-y-4">
            <MoneyInput
              id="parking-weekday-rate"
              label="Weekday / night"
              value={weekdayRate}
              commissionPct={commissionPct}
              readOnly={readOnly}
              onChange={onWeekdayChange}
            />
            <MoneyInput
              id="parking-weekend-rate"
              label="Fri–Sun / night"
              value={weekendRate}
              commissionPct={commissionPct}
              readOnly={readOnly}
              onChange={onWeekendChange}
            />
            <p className="text-muted-foreground text-xs">
              Guests also pay a service fee at checkout ({formatPct(guestFeePct)} +{' '}
              {formatPhp(guestFeeFixed)} per booking). It does not reduce your payout.
            </p>
          </div>
        </div>

        {!embedded && !readOnly && hasChanges ? (
          <>
            <div className="border-border/60 border-t" role="separator" />
            <Button
              type="button"
              className="min-h-[44px] w-full"
              disabled={saving || ratesInvalid}
              onClick={onSaveClick}
            >
              {saving ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-4 w-4" />
              )}
              Save
            </Button>
          </>
        ) : null}
      </div>
    </section>
  );
}
