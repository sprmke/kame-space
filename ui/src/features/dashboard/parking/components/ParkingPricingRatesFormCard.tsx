import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Save } from 'lucide-react';

import { useDashboardCompactChrome } from '@/features/dashboard/lib/dashboardChromeContext';
import {
  STUB_COMMISSION_PCT,
  STUB_GUEST_PARKING_RATE_WEEKDAY,
  STUB_GUEST_PARKING_RATE_WEEKEND,
} from '@/features/dashboard/parking/lib/parkingPricingDefaults';
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
  /** Live super-admin-configured guest rates — what riders actually pay. */
  guestRateWeekday?: number;
  guestRateWeekend?: number;
  commissionPct?: number;
  readOnly?: boolean;
  hasChanges?: boolean;
  saving?: boolean;
  /** Hide the card footer save button (Setup Guide uses modal footer save). */
  embedded?: boolean;
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
  guestRate,
  commissionPct,
  readOnly,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  guestRate: number;
  commissionPct: number;
  readOnly?: boolean;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const isEmptyDraft = draft !== null && draft.trim() === '';
  const display = draft ?? String(value);
  /** Empty field counts as 0 for fee / net / soft-warn math without forcing `0` into the input. */
  const effectiveRate = isEmptyDraft ? 0 : value;
  const aboveGuestRate = effectiveRate > guestRate;
  const commissionAmount = Math.round(effectiveRate * commissionPct);
  const netPayout = effectiveRate - commissionAmount;

  useEffect(() => {
    // Keep an in-progress empty clear; only drop draft when parent value changes otherwise.
    if (isEmptyDraft && value === 0) return;
    setDraft(null);
  }, [value, isEmptyDraft]);

  return (
    <div className="space-y-2.5">
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
          min={0}
          step={50}
          inputMode="numeric"
          value={display}
          disabled={readOnly}
          aria-invalid={aboveGuestRate || undefined}
          onChange={(e) => {
            const raw = e.target.value;
            setDraft(raw);
            if (raw.trim() === '') {
              onChange(0);
              return;
            }
            const n = Number(raw);
            if (!Number.isFinite(n)) return;
            onChange(Math.max(0, n));
          }}
          onBlur={() => {
            if (draft === null) return;
            const trimmed = draft.trim();
            if (trimmed === '') {
              onChange(0);
              setDraft(null);
              return;
            }
            const n = Number(trimmed);
            if (!Number.isFinite(n)) {
              setDraft(null);
              return;
            }
            onChange(Math.max(0, Math.round(n)));
            setDraft(null);
          }}
          className={cn(
            'h-10 pl-8 text-sm tabular-nums',
            aboveGuestRate && 'border-amber-500/80 focus-visible:ring-amber-500/40'
          )}
        />
      </div>
      {aboveGuestRate ? (
        <p className="text-amber-700 dark:text-amber-400 flex items-start gap-1.5 text-xs">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Above guest rate {formatPhp(guestRate)}. Marketplace will not match this listing.
        </p>
      ) : null}
      <div className="space-y-2">
        <dl className="space-y-1.5 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Guests pay</dt>
            <dd className="text-foreground tabular-nums">{formatPhp(guestRate)} / night</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Platform fee ({formatPct(commissionPct)})</dt>
            <dd className="text-muted-foreground tabular-nums">-{formatPhp(commissionAmount)}</dd>
          </div>
        </dl>
        <div className="bg-muted/50 border-border/50 flex items-baseline justify-between gap-3 rounded-lg border px-3 py-2.5">
          <p className="text-foreground text-sm font-semibold">You receive</p>
          <p className="text-foreground text-base font-bold tabular-nums sm:text-lg">
            {formatPhp(netPayout)}
            <span className="text-muted-foreground ms-1 text-xs font-medium">/ night</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export function ParkingPricingRatesFormCard({
  weekdayRate,
  weekendRate,
  guestRateWeekday = STUB_GUEST_PARKING_RATE_WEEKDAY,
  guestRateWeekend = STUB_GUEST_PARKING_RATE_WEEKEND,
  commissionPct = STUB_COMMISSION_PCT,
  readOnly = false,
  hasChanges = false,
  saving = false,
  embedded = false,
  onWeekdayChange,
  onWeekendChange,
  onSaveClick,
}: Props) {
  const compactChrome = useDashboardCompactChrome();

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
          <div className="mt-3 space-y-5">
            <MoneyInput
              id="parking-weekday-rate"
              label="Weekday / night"
              value={weekdayRate}
              guestRate={guestRateWeekday}
              commissionPct={commissionPct}
              readOnly={readOnly}
              onChange={onWeekdayChange}
            />
            <MoneyInput
              id="parking-weekend-rate"
              label="Fri–Sun / night"
              value={weekendRate}
              guestRate={guestRateWeekend}
              commissionPct={commissionPct}
              readOnly={readOnly}
              onChange={onWeekendChange}
            />
          </div>
        </div>

        {!embedded && !readOnly && hasChanges ? (
          <>
            <div className="border-border/60 border-t" role="separator" />
            <Button
              type="button"
              className="min-h-[44px] w-full"
              disabled={saving}
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
