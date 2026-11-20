import {
  BarChart3,
  CalendarDays,
  Car,
  DollarSign,
  FileText,
  Percent,
  PieChart,
  Receipt,
} from 'lucide-react';

import { AdminMetricCardSkeleton } from '@/features/dashboard/bookings/components/AdminMetricCard';

import { BookingsCalendarSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Skeleton } from '@/components/ui/skeleton';
import { CHART_HEIGHT_CLASS } from '@/lib/charts/chartStyles';
import { cn } from '@/lib/utils';

function ParkingCardHeaderSkeleton({
  title,
  icon: Icon,
  description,
  action,
}: {
  title: string;
  icon: typeof BarChart3;
  description?: string;
  action?: 'view' | 'segment' | 'toggle';
}) {
  return (
    <div className="mb-2.5 flex flex-col gap-2 sm:mb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="icon-well-sm bg-muted/80 inline-flex !size-8 shrink-0 items-center justify-center !rounded-lg lg:!size-10 lg:!rounded-xl">
          <Icon className="text-muted-foreground size-4 lg:size-5" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-card-title">{title}</p>
          {description ? (
            <p className="text-muted-foreground hidden text-xs leading-snug lg:block">
              {description}
            </p>
          ) : (
            <Skeleton className="hidden h-3 w-44 max-w-full lg:block" />
          )}
        </div>
      </div>
      {action === 'view' ? (
        <Skeleton className="h-9 w-14 shrink-0 rounded-lg" />
      ) : action === 'segment' ? (
        <Skeleton className="h-9 w-36 shrink-0 rounded-lg" />
      ) : action === 'toggle' ? (
        <Skeleton className="hidden h-9 w-[7.25rem] shrink-0 rounded-lg sm:block" />
      ) : null}
    </div>
  );
}

/**
 * Mirrors `ParkingDashboardPage` after load: 4 KPIs, then the same 5-col grid as
 * `ParkingDashboardCalendarSection` (Cash flow | Breakdown, Calendar | Transactions).
 * No attention-strip skeleton — the strip only mounts when there are items.
 */
export function ParkingDashboardSkeleton() {
  return (
    <div
      role="status"
      className="native-stagger flex min-w-0 flex-col gap-2.5 sm:gap-3 lg:gap-4"
      aria-busy="true"
      aria-label="Loading parking dashboard"
    >
      <section aria-label="Key metrics" aria-hidden>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4">
          {[
            { title: 'Total Revenue', icon: DollarSign },
            { title: 'Total Reservations', icon: FileText },
            { title: 'Occupancy Rate', icon: Percent },
            { title: 'Average Nightly Rate', icon: Car },
          ].map((card, index) => (
            <AdminMetricCardSkeleton
              key={card.title}
              title={card.title}
              icon={card.icon}
              showTrend
              changeLabel="vs last period"
              titleAdornment={<span aria-hidden className="h-4 w-6 shrink-0" />}
              style={{ opacity: 1 - index * 0.05 }}
            />
          ))}
        </div>
      </section>

      <div className="min-w-0 space-y-3 sm:space-y-4" aria-hidden>
        <div className="grid min-w-0 items-stretch gap-3 lg:grid-cols-5 xl:gap-4">
          <section
            className={cn(
              'surface-card flex h-full min-w-0 flex-col p-3 sm:p-4',
              'lg:col-span-3 lg:col-start-1'
            )}
          >
            <ParkingCardHeaderSkeleton
              title="Cash flow"
              icon={BarChart3}
              description="Stay net, transactions, and expenses over time"
            />
            <Skeleton className={cn(CHART_HEIGHT_CLASS, 'rounded-xl')} />
            <div className="mt-4 hidden justify-center gap-6 lg:flex">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          </section>

          <section
            className={cn(
              'surface-card flex h-full min-w-0 flex-col p-3 sm:p-4',
              'lg:col-span-2 lg:col-start-4'
            )}
          >
            <ParkingCardHeaderSkeleton
              title="Breakdown"
              icon={PieChart}
              description="By category"
              action="segment"
            />
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex min-h-[160px] flex-1 items-center justify-center px-2 pb-10 sm:min-h-[200px]">
                <Skeleton className="size-40 shrink-0 rounded-full sm:size-48" />
              </div>
              <div className="border-border/50 shrink-0 border-t pt-2">
                <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-4 w-full" />
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section
            className={cn(
              'surface-card flex min-h-0 min-w-0 flex-col overflow-hidden p-3 sm:p-4',
              'lg:col-span-2 lg:col-start-4 lg:row-start-2'
            )}
          >
            <ParkingCardHeaderSkeleton
              title="Transactions"
              icon={Receipt}
              action="view"
            />
            <div className="mb-3 flex flex-wrap gap-2">
              <Skeleton className="h-7 w-16 rounded-full" />
              <Skeleton className="h-7 w-24 rounded-full" />
            </div>
            <div className="flex min-h-0 flex-1 flex-col space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className="h-14 w-full rounded-xl"
                  style={{ opacity: 1 - index * 0.08 }}
                />
              ))}
            </div>
          </section>

          <section
            className={cn(
              'surface-card flex min-w-0 flex-col overflow-hidden p-3 sm:p-4',
              'lg:col-span-3 lg:col-start-1 lg:row-start-2'
            )}
          >
            <ParkingCardHeaderSkeleton
              title="Calendar"
              icon={CalendarDays}
              description="Tap a date to open reservation details"
              action="toggle"
            />
            <BookingsCalendarSkeleton gridOnly compact />
          </section>
        </div>
      </div>
    </div>
  );
}

export function ParkingBookingDetailSkeleton() {
  return (
    <div role="status" className="space-y-4" aria-busy="true" aria-label="Loading parking booking">
      <div className="flex flex-wrap gap-2 lg:hidden">
        <Skeleton className="h-11 w-28 rounded-lg" />
        <Skeleton className="h-11 w-24 rounded-lg" />
      </div>
      <div className="surface-card space-y-5 p-4 sm:p-4 md:p-5">
        <Skeleton className="h-5 w-20 rounded-md" />
        <div className="border-border/80 bg-muted/30 flex gap-3 rounded-xl border p-4 sm:p-5">
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="h-3 w-32 max-w-full" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="border-border/60 bg-muted/20 flex gap-3 rounded-xl border p-3.5"
            >
              <Skeleton className="mt-0.5 size-4 shrink-0 rounded" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-2.5 w-12" />
                <Skeleton className="h-3.5 w-24 max-w-full" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Skeleton className="h-11 flex-1 rounded-lg sm:w-32 sm:flex-none" />
          <Skeleton className="h-11 flex-1 rounded-lg sm:w-32 sm:flex-none" />
        </div>
      </div>
    </div>
  );
}
