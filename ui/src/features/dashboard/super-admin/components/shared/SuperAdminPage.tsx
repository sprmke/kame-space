import type { ReactNode } from 'react';

import { RotateCw } from 'lucide-react';

import { AdminPageHeader } from '@/features/dashboard/bookings/components/AdminPageHeader';
import { SuperAdminPageLoading } from '@/features/dashboard/super-admin/components/shared/SuperAdminPageLoading';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type SuperAdminPageProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Rendered between the header and `children` (summary cards, toolbars, tabs). */
  toolbar?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Show the standard loading skeleton instead of `children`. */
  isLoading?: boolean;
  /** Metric-card count for the loading skeleton (0 = list rows only). */
  loadingMetricCount?: number;
  /** Override default list/metric loading body (header stays mounted). */
  loadingBody?: ReactNode;
  /** Show a standard error message instead of `children`. */
  error?: unknown;
  errorMessage?: string;
  /** Optional refetch, rendered as a Retry action in the error state. */
  onRetry?: () => void;
};

/**
 * Standard Super Admin route shell — page header + consistent vertical rhythm,
 * with built-in loading / error states. Every `/admin/*` page renders through this.
 */
export function SuperAdminPage({
  title,
  subtitle,
  actions,
  toolbar,
  children,
  className,
  isLoading = false,
  loadingMetricCount = 0,
  loadingBody,
  error,
  errorMessage,
  onRetry,
}: SuperAdminPageProps) {
  return (
    <div className={cn('space-y-3 sm:space-y-4', className)}>
      <AdminPageHeader title={title} subtitle={subtitle} actions={actions} />
      {isLoading ? (
        (loadingBody ?? <SuperAdminPageLoading metricCount={loadingMetricCount} />)
      ) : error ? (
        <div className="border-border bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
          <p className="text-destructive-strong text-sm">
            {errorMessage ?? `Could not load ${title.toLowerCase()}.`}
          </p>
          {onRetry ? (
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              <RotateCw className="size-4" aria-hidden />
              Retry
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          {toolbar}
          {children}
        </>
      )}
    </div>
  );
}
