import type { FinanceLedgerStatus } from '@/features/dashboard/finance/lib/types';

import { compactStatusBadgeClasses, softBadgeClasses } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';

const STATUS_VARIANT: Record<
  FinanceLedgerStatus,
  { label: string; variant: 'success' | 'pending' | 'danger' }
> = {
  completed: { label: 'Completed', variant: 'success' },
  pending: { label: 'Pending', variant: 'pending' },
  canceled: { label: 'Canceled', variant: 'danger' },
};

type Props = {
  status: FinanceLedgerStatus;
  /** Optional host-facing label (e.g. Disbursed / Awaiting payout). */
  label?: string;
  /**
   * `compact` for dense table cells; `comfortable` for card / calendar chips
   * (closer to body text size).
   */
  size?: 'compact' | 'comfortable';
  className?: string;
};

export function FinanceLedgerStatusBadge({
  status,
  label,
  size = 'compact',
  className,
}: Props) {
  const config = STATUS_VARIANT[status];
  return (
    <span
      className={cn(
        size === 'comfortable'
          ? cn(softBadgeClasses(config.variant), 'font-semibold uppercase tracking-wide')
          : compactStatusBadgeClasses(config.variant),
        className
      )}
    >
      {label ?? config.label}
    </span>
  );
}
