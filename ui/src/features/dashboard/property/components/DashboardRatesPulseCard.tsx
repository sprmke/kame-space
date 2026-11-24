import { useCallback, useMemo, useState } from 'react';

import { Link } from 'react-router-dom';

import { useQueries } from '@tanstack/react-query';
import { ArrowRight, CalendarRange, Check } from 'lucide-react';

import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';
import { PricingDateModal } from '@/features/dashboard/pricing/components/PricingDateModal';
import { useSavePropertyPricing } from '@/features/dashboard/pricing/hooks/usePropertyPricing';
import {
  dateKey,
  mergeDateRateOverrides,
} from '@/features/dashboard/pricing/lib/pricingCalendarUtils';
import { resolveNightlyRateForDate } from '@/features/dashboard/pricing/lib/pricingCompute';
import { dateOverridesRecordFromMap } from '@/features/dashboard/pricing/lib/pricingSave';
import {
  fetchPropertyPricing,
  PROPERTY_PRICING_QUERY_KEY,
} from '@/features/dashboard/pricing/lib/propertyPricingApi';
import {
  buildOpenRateHorizon,
  DASHBOARD_OPEN_HORIZON_DAYS,
  dashboardRatesMonthKeys,
  groupOpenNightsByWeek,
  mergePropertyPricingSlices,
  parseRateNightDates,
} from '@/features/dashboard/property/lib/dashboardRatesPulse';
import { resolvePropertyDashboardHref } from '@/features/dashboard/property/lib/resolvePropertyDashboardHref';
import type { DashboardAttentionItem } from '@/features/dashboard/property/lib/types';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { manilaTodayIso } from '@/lib/date/manilaPeriod';
import { ATTENTION_SEVERITY_STYLES } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';
import { formatMoneyCompact } from '@/utils/format/currency';

type Props = {
  orgSlug: string;
  propertySlug: string;
  syncConflictItem?: DashboardAttentionItem | null;
  className?: string;
  enabled?: boolean;
  canEditRates?: boolean;
};

/**
 * Open nights queue with multi-select + PricingDateModal save (no full-page hop).
 */
export function DashboardRatesPulseCard({
  orgSlug,
  propertySlug,
  syncConflictItem = null,
  className,
  enabled = true,
  canEditRates = false,
}: Props) {
  const { property } = useOrgContext();
  const propertyId = usePropertyIdParam() ?? property.id;
  const startIso = manilaTodayIso();
  const monthKeys = useMemo(
    () => dashboardRatesMonthKeys(startIso, DASHBOARD_OPEN_HORIZON_DAYS),
    [startIso]
  );
  const pricingHref = propertySectionPath(orgSlug, propertySlug, 'pricing');
  const saveMutation = useSavePropertyPricing();

  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [newPrice, setNewPrice] = useState('');

  const monthQueries = useQueries({
    queries: monthKeys.map((monthKey) => ({
      queryKey: [PROPERTY_PRICING_QUERY_KEY, propertyId, monthKey],
      queryFn: () => fetchPropertyPricing(propertyId, monthKey),
      enabled: enabled && Boolean(propertyId),
      staleTime: 30_000,
    })),
  });

  const isLoading = enabled && monthQueries.some((query) => query.isPending);
  const dataStamp = monthQueries.map((query) => query.dataUpdatedAt).join('|');
  const merged = useMemo(
    () => mergePropertyPricingSlices(monthQueries.map((query) => query.data)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stamp tracks payload freshness
    [dataStamp]
  );

  const openNights = useMemo(
    () =>
      buildOpenRateHorizon({
        startIso,
        defaults: merged.defaults,
        dateOverrides: merged.dateOverrides,
        holidayRules: merged.holidayRules,
        smartRecommendations: merged.smartRecommendations,
        smartPricingEnabled: merged.smartPricingEnabled,
        bookedDateKeys: merged.bookedDateKeys,
        blockedDateKeys: merged.blockedDateKeys,
      }),
    [merged, startIso]
  );

  const buckets = useMemo(
    () => groupOpenNightsByWeek(openNights, startIso),
    [openNights, startIso]
  );

  const selectedDates = useMemo(() => parseRateNightDates(selectedKeys), [selectedKeys]);

  const customDatePrices = useMemo(
    () => new Map(Object.entries(merged.dateOverrides)),
    [merged.dateOverrides]
  );

  const baseNightlyForDate = useCallback(
    (date: Date) => {
      const key = dateKey(date);
      const overridesWithout = { ...merged.dateOverrides };
      delete overridesWithout[key];
      return resolveNightlyRateForDate(date, merged.defaults, {
        dateOverrides: overridesWithout,
        holidayRules: merged.holidayRules,
      });
    },
    [merged.dateOverrides, merged.defaults, merged.holidayRules]
  );

  const suggestedPrice = useMemo(() => {
    const first = selectedDates[0];
    return first ? baseNightlyForDate(first) : 0;
  }, [baseNightlyForDate, selectedDates]);

  const smartSuggestedPrice = useMemo(() => {
    const firstKey = selectedKeys[0];
    if (!firstKey || !merged.smartPricingEnabled) return null;
    const night = openNights.find((row) => row.dateKey === firstKey);
    return night?.smartRate ?? null;
  }, [merged.smartPricingEnabled, openNights, selectedKeys]);

  const openEditor = useCallback(
    (keys: string[]) => {
      if (!canEditRates || keys.length === 0) return;
      const dates = parseRateNightDates(keys);
      const first = dates[0];
      const live =
        first != null
          ? resolveNightlyRateForDate(first, merged.defaults, {
              dateOverrides: merged.dateOverrides,
              holidayRules: merged.holidayRules,
              smartRecommendations: merged.smartPricingEnabled
                ? merged.smartRecommendations
                : null,
            })
          : suggestedPrice;
      setSelectedKeys(keys);
      setNewPrice(String(live));
      setModalOpen(true);
    },
    [canEditRates, merged, suggestedPrice]
  );

  const toggleNight = (dateKeyStr: string) => {
    if (!canEditRates) return;
    setSelectedKeys((prev) =>
      prev.includes(dateKeyStr) ? prev.filter((key) => key !== dateKeyStr) : [...prev, dateKeyStr]
    );
  };

  const clearSelection = () => {
    setSelectedKeys([]);
    setModalOpen(false);
    setNewPrice('');
  };

  const persistOverrides = (next: Map<string, number>) => {
    saveMutation.mutate(
      { dateOverrides: dateOverridesRecordFromMap(next) },
      { onSuccess: () => clearSelection() }
    );
  };

  const applyCustomPrice = () => {
    if (!canEditRates || selectedDates.length === 0 || !newPrice.trim()) return;
    const price = Number(newPrice);
    if (!Number.isFinite(price) || price < 0) return;
    const next = mergeDateRateOverrides(
      customDatePrices,
      selectedDates,
      price,
      baseNightlyForDate
    );
    persistOverrides(next);
  };

  const resetSelectedToDefault = () => {
    if (!canEditRates || selectedDates.length === 0) return;
    const next = new Map(customDatePrices);
    for (const date of selectedDates) next.delete(dateKey(date));
    persistOverrides(next);
  };

  return (
    <section
      className={cn(
        'surface-card flex min-h-0 min-w-0 flex-col overflow-hidden p-3 sm:p-4',
        className
      )}
      aria-label="Rates"
    >
      <AdminSurfaceCardHeader
        icon={CalendarRange}
        title="Rates"
        description="Open nights"
        iconClassName="bg-muted/80"
        action={
          <Link
            to={pricingHref}
            className="text-primary hover:bg-primary/10 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold transition-colors"
          >
            Pricing
            <ArrowRight className="size-4 shrink-0" aria-hidden />
          </Link>
        }
      />

      {syncConflictItem ? (
        <Link
          to={resolvePropertyDashboardHref(syncConflictItem.href, orgSlug, propertySlug)}
          className={cn(
            'mb-3 flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
            ATTENTION_SEVERITY_STYLES[syncConflictItem.severity].chipInteractive
          )}
        >
          <span
            className={cn(
              'size-2 shrink-0 rounded-full',
              ATTENTION_SEVERITY_STYLES[syncConflictItem.severity].dot
            )}
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate">{syncConflictItem.label}</span>
          {syncConflictItem.count != null ? (
            <span
              className={cn(
                'tabular-nums font-bold',
                ATTENTION_SEVERITY_STYLES[syncConflictItem.severity].count
              )}
            >
              {syncConflictItem.count}
            </span>
          ) : null}
        </Link>
      ) : null}

      {isLoading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading rates">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : openNights.length === 0 ? (
        <div className="border-border/60 flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center">
          <CalendarRange className="text-muted-foreground/70 size-6" aria-hidden />
          <p className="text-foreground text-sm font-semibold">No open nights soon</p>
          <Link
            to={pricingHref}
            className="text-primary inline-flex min-h-11 items-center gap-1 text-sm font-semibold"
          >
            Open pricing
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {buckets.map((bucket) => (
            <div key={bucket.id} className="space-y-1.5">
              <p className="text-muted-foreground px-0.5 text-[11px] font-semibold tracking-wide">
                {bucket.label}
              </p>
              <ul className="border-border/50 divide-border/50 overflow-hidden rounded-xl border">
                {bucket.nights.map((night) => {
                  const selected = selectedKeys.includes(night.dateKey);
                  return (
                    <li key={night.dateKey} className="border-border/50 border-t first:border-t-0">
                      <div
                        className={cn(
                          'flex min-h-12 w-full items-center gap-2.5 px-3 py-2',
                          selected && 'bg-primary/5'
                        )}
                      >
                        {canEditRates ? (
                          <button
                            type="button"
                            aria-pressed={selected}
                            aria-label={`Select ${night.dayLabel}`}
                            className={cn(
                              'flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors',
                              selected
                                ? 'border-primary bg-primary-strong text-primary-foreground'
                                : 'border-border/70 bg-background hover:bg-muted/50'
                            )}
                            onClick={() => toggleNight(night.dateKey)}
                          >
                            {selected ? <Check className="size-3.5" aria-hidden /> : null}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={!canEditRates}
                          className={cn(
                            'min-w-0 flex-1 text-left',
                            canEditRates && 'hover:opacity-90'
                          )}
                          onClick={() =>
                            canEditRates ? openEditor([night.dateKey]) : undefined
                          }
                        >
                          <p className="text-foreground truncate text-sm font-medium">
                            <span className="tabular-nums">{night.weekdayShort}</span>
                            <span className="text-muted-foreground"> · </span>
                            <span className="tabular-nums">{night.dayLabel}</span>
                          </p>
                        </button>
                        {night.smartRate != null ? (
                          <span className="bg-muted/70 text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums">
                            Smart {formatMoneyCompact(night.smartRate)}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          disabled={!canEditRates}
                          className={cn(
                            'shrink-0 rounded-lg px-2 py-1 text-sm font-bold tabular-nums',
                            canEditRates
                              ? 'text-primary hover:bg-primary/10 min-h-11'
                              : 'text-foreground'
                          )}
                          onClick={() =>
                            canEditRates ? openEditor([night.dateKey]) : undefined
                          }
                        >
                          {formatMoneyCompact(night.rate)}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {canEditRates && selectedKeys.length > 0 && !modalOpen ? (
            <div className="border-border/60 bg-muted/30 flex items-center gap-2 rounded-xl border px-3 py-2">
              <p className="text-muted-foreground min-w-0 flex-1 text-xs font-medium tabular-nums">
                {selectedKeys.length} selected
              </p>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground min-h-11 rounded-lg px-2 text-sm font-semibold"
                onClick={clearSelection}
              >
                Clear
              </button>
              <button
                type="button"
                className="bg-primary-strong text-primary-foreground native-press min-h-11 rounded-lg px-3 text-sm font-semibold"
                onClick={() => openEditor(selectedKeys)}
              >
                Set rate
              </button>
            </div>
          ) : null}
        </div>
      )}

      <PricingDateModal
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open) clearSelection();
          else setModalOpen(true);
        }}
        selectedDates={selectedDates}
        suggestedPrice={suggestedPrice}
        smartSuggestedPrice={smartSuggestedPrice}
        newPrice={newPrice}
        onNewPriceChange={setNewPrice}
        onResetToDefault={resetSelectedToDefault}
        onApply={applyCustomPrice}
        saving={saveMutation.isPending}
      />
    </section>
  );
}
