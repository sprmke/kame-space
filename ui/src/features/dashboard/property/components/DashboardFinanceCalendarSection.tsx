import { useMemo, useState } from 'react';

import { CalendarDays } from 'lucide-react';

import { BookingCalendarView } from '@/features/dashboard/bookings/components/BookingCalendarView';
import {
  BookingCalendarPillLabelToggle,
  type BookingCalendarPillLabelMode,
} from '@/features/dashboard/bookings/components/calendar/BookingCalendarPillLabelToggle';
import { calendarSupportsPillLabelToggle } from '@/features/dashboard/bookings/components/calendar/calendarDateUtils';
import { useBookings } from '@/features/dashboard/bookings/hooks/useBookings';
import {
  DEFAULT_BOOKINGS_QUERY,
  type BookingsQuery,
} from '@/features/dashboard/bookings/lib/types';
import { FinanceTransactionsChart } from '@/features/dashboard/finance/components/FinanceTransactionsChart';
import { useFinanceBookings } from '@/features/dashboard/finance/hooks/useFinanceBookings';
import { useFinanceLineItems } from '@/features/dashboard/finance/hooks/useFinanceLineItems';
import { buildFinanceChartData } from '@/features/dashboard/finance/lib/financeChartData';
import { FINANCE_CHART_BOOKINGS_LIMIT } from '@/features/dashboard/finance/lib/financePeriod';
import { DEFAULT_FINANCE_QUERY, type FinanceQuery } from '@/features/dashboard/finance/lib/types';
import { useDashboardCompactChrome } from '@/features/dashboard/lib/dashboardChromeContext';
import { propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';
import { DashboardAttentionCard } from '@/features/dashboard/property/components/DashboardAttentionCard';
import { DashboardMaintenanceRemindersCard } from '@/features/dashboard/property/components/DashboardMaintenanceRemindersCard';
import { DashboardMessagesPulseCard } from '@/features/dashboard/property/components/DashboardMessagesPulseCard';
import { DashboardRatesPulseCard } from '@/features/dashboard/property/components/DashboardRatesPulseCard';
import { DashboardTransactionsDueCard } from '@/features/dashboard/property/components/DashboardTransactionsDueCard';
import type {
  DashboardAttentionItem,
  DashboardRecentBooking,
} from '@/features/dashboard/property/lib/types';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { useAfterFirstPaint } from '@/hooks/useAfterFirstPaint';
import { formatDateRangeDisplay, fromIsoDate, type DatePreset } from '@/lib/date/navigation';

const CALENDAR_SYNC_ATTENTION_ID = 'calendar-sync-attention';

type Props = {
  from: string;
  to: string;
  datePreset: DatePreset;
  attentionItems: DashboardAttentionItem[];
  recentBookings: DashboardRecentBooking[];
  orgSlug: string;
  propertySlug: string;
  attentionLoading?: boolean;
  canViewFinance?: boolean;
  canViewMaintenance?: boolean;
  canViewInbox?: boolean;
  canViewPricing?: boolean;
  canEditRates?: boolean;
};

/**
 * Ops board after KPIs:
 * Needs attention | Calendar
 * Messages        | Rates (open nights + quick edit)
 * Cash flow (full) when finance:view
 * Transactions    | Maintenance
 */
export function DashboardFinanceCalendarSection({
  from,
  to,
  datePreset,
  attentionItems,
  recentBookings,
  orgSlug,
  propertySlug,
  attentionLoading,
  canViewFinance = true,
  canViewMaintenance = true,
  canViewInbox = true,
  canViewPricing = true,
  canEditRates = false,
}: Props) {
  const compactChrome = useDashboardCompactChrome();
  const rangeFrom = fromIsoDate(from);
  const rangeTo = fromIsoDate(to);
  const rangeLabel =
    rangeFrom && rangeTo
      ? formatDateRangeDisplay(rangeFrom, rangeTo, datePreset, { compact: compactChrome })
      : '';

  const syncConflictItem = useMemo(
    () => attentionItems.find((item) => item.id === CALENDAR_SYNC_ATTENTION_ID) ?? null,
    [attentionItems]
  );
  const opsAttentionItems = useMemo(
    () => attentionItems.filter((item) => item.id !== CALENDAR_SYNC_ATTENTION_ID),
    [attentionItems]
  );

  const financeQuery = useMemo(
    (): FinanceQuery => ({
      ...DEFAULT_FINANCE_QUERY,
      from,
      to,
      page: 1,
      limit: FINANCE_CHART_BOOKINGS_LIMIT,
    }),
    [from, to]
  );

  const bookingsQuery = useMemo(
    (): BookingsQuery => ({
      ...DEFAULT_BOOKINGS_QUERY,
      from,
      to,
      showCompletedBookings: true,
      limit: FINANCE_CHART_BOOKINGS_LIMIT,
      page: 1,
    }),
    [from, to]
  );

  // Secondary section: four reads that are not needed for the first frame. Held until the
  // dashboard has painted so they stop competing with the page's own data.
  const ready = useAfterFirstPaint();
  const financeReady = canViewFinance && ready;
  const lineItemsQuery = useFinanceLineItems(financeQuery, { enabled: financeReady });
  const financeBookingsQuery = useFinanceBookings(financeQuery, {
    enabled: financeReady,
  });
  const bookingsQueryResult = useBookings(bookingsQuery, { enabled: ready });

  const chartData = useMemo(
    () =>
      buildFinanceChartData(
        lineItemsQuery.data ?? [],
        financeBookingsQuery.data?.rows ?? [],
        from,
        to,
        financeQuery.basis
      ),
    [lineItemsQuery.data, financeBookingsQuery.data?.rows, from, to, financeQuery.basis]
  );

  const financeChartsLoading = lineItemsQuery.isPending || financeBookingsQuery.isPending;
  const [calendarPillLabelMode, setCalendarPillLabelMode] =
    useState<BookingCalendarPillLabelMode>('name');
  const showPillLabelToggle = useMemo(
    () => calendarSupportsPillLabelToggle(datePreset, rangeFrom, rangeTo),
    [datePreset, rangeFrom, rangeTo]
  );

  const bookingsHref = `${propertySectionPath(orgSlug, propertySlug, 'bookings')}?from=${from}&to=${to}`;
  const financeHref = `${propertySectionPath(orgSlug, propertySlug, 'finance')}?from=${from}&to=${to}`;

  return (
    <div className="grid min-w-0 items-stretch gap-2.5 sm:gap-3 lg:grid-cols-2 lg:gap-4">
      {/* Mobile: attention first so urgent work is not below the calendar. */}
      <DashboardAttentionCard
        className="h-full max-lg:order-1 lg:order-none"
        items={opsAttentionItems}
        recentBookings={recentBookings}
        orgSlug={orgSlug}
        propertySlug={propertySlug}
        viewAllHref={bookingsHref}
        rangeLabel={rangeLabel}
        isLoading={attentionLoading}
      />

      <section className="surface-card flex h-full min-w-0 flex-col overflow-hidden p-3 max-lg:order-2 sm:p-4 lg:order-none">
        <AdminSurfaceCardHeader
          icon={CalendarDays}
          title="Calendar"
          description={`Tap a date to open booking details · ${rangeLabel}`}
          iconClassName="bg-muted/80"
          action={
            showPillLabelToggle ? (
              <BookingCalendarPillLabelToggle
                value={calendarPillLabelMode}
                onChange={setCalendarPillLabelMode}
              />
            ) : undefined
          }
        />

        <BookingCalendarView
          rows={bookingsQueryResult.data?.rows ?? []}
          isLoading={bookingsQueryResult.isLoading}
          error={bookingsQueryResult.error ? (bookingsQueryResult.error as Error).message : null}
          isRefreshing={bookingsQueryResult.isFetching}
          variant="mini"
          rangeFrom={from}
          rangeTo={to}
          datePreset={datePreset}
          pillLabelMode={calendarPillLabelMode}
        />
      </section>

      {canViewInbox ? (
        <DashboardMessagesPulseCard className="h-full max-lg:order-3 lg:order-none" />
      ) : null}

      {canViewPricing ? (
        <DashboardRatesPulseCard
          className="h-full max-lg:order-4 lg:order-none"
          orgSlug={orgSlug}
          propertySlug={propertySlug}
          syncConflictItem={syncConflictItem}
          enabled={ready}
          canEditRates={canEditRates}
        />
      ) : null}

      {canViewFinance ? (
        <FinanceTransactionsChart
          embedded
          showBreakdown={false}
          cashFlowCardClassName="max-lg:order-5 lg:col-span-2 lg:order-none"
          isLoading={financeChartsLoading}
          cashFlowData={chartData.cashFlowData}
          incomeBreakdown={chartData.incomeBreakdown}
          expenseBreakdown={chartData.expenseBreakdown}
          financeHref={financeHref}
        />
      ) : null}

      {canViewFinance ? (
        <DashboardTransactionsDueCard
          className="max-lg:order-6 lg:order-none"
          items={lineItemsQuery.data ?? []}
          from={from}
          to={to}
          rangeLabel={rangeLabel}
          datePreset={datePreset}
          transactionsHref={financeHref}
          isLoading={lineItemsQuery.isLoading}
          isRefreshing={lineItemsQuery.isFetching}
        />
      ) : null}

      {canViewMaintenance ? (
        <DashboardMaintenanceRemindersCard
          className="max-lg:order-7 lg:order-none"
          from={from}
          to={to}
          rangeLabel={rangeLabel}
        />
      ) : null}
    </div>
  );
}
