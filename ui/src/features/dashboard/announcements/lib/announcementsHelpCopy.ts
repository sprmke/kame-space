/**
 * test: N/A — copy-only module. Every `*HelpCopy.ts` file is scanned by
 * `ui/src/lib/help/helpCopy.test.ts`.
 */
import type { HelpCopyModule } from '@/lib/help/types';

/** Announcement summary cards. Severity maps to action, attention, and updates. */
export const ANNOUNCEMENTS_HELP_COPY = {
  actionRequired: {
    hint: 'Critical announcements that need a decision or a fix from you.',
  },
  attention: {
    hint: 'Warning announcements worth checking soon.',
  },
  updates: {
    hint: 'Information only. Nothing to do.',
  },
} satisfies HelpCopyModule;
