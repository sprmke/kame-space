/**
 * test: N/A — copy-only module. Every `*HelpCopy.ts` file is scanned by
 * `ui/src/lib/help/helpCopy.test.ts`.
 */
import type { HelpCopyModule } from '@/lib/help/types';

/** Maintenance summary cards. */
export const MAINTENANCE_HELP_COPY = {
  overdue: {
    hint: 'Unfinished reminders whose scheduled date has passed.',
  },
  pending: {
    hint: 'Unfinished reminders for today or later.',
  },
} satisfies HelpCopyModule;
