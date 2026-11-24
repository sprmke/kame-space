/**
 * test: N/A — copy-only module. Every `*HelpCopy.ts` file is scanned by
 * `ui/src/lib/help/helpCopy.test.ts`.
 */
import type { HelpCopyModule } from '@/lib/help/types';

/**
 * Finance summary cards. Source: `_shared/financeService.ts` and
 * `features/dashboard/finance/lib/financeSummaryStats.ts`.
 */
export const FINANCE_HELP_COPY = {
  netProfit: {
    hint: 'Collected income minus expenses for the selected dates. Unpaid bookings are not counted here and are shown separately as pipeline.',
  },
  totalIncome: {
    hint: 'Operating income plus stays that completed in the selected dates. Unpaid bookings stay out of this figure.',
  },
  totalExpenses: {
    hint: 'Operating expenses plus booking costs and security deposit expenses in the selected dates.',
  },
  pendingPayments: {
    hint: 'Guest balances still unpaid plus ledger entries marked pending. Excluded from collected income and Net Profit.',
  },
} satisfies HelpCopyModule;
