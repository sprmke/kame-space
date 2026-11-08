/**
 * test: N/A — copy-only module. Every `*HelpCopy.ts` file is scanned by
 * `ui/src/lib/help/helpCopy.test.ts`.
 */
import type { HelpCopyModule } from '@/lib/help/types';

/** Reviews KPI cards. Source: `features/reviews/lib/propertyReviewsApi.ts`. */
export const REVIEWS_HELP_COPY = {
  responded: {
    hint: 'Share of guest reviews that have a host response.',
  },
  toWrite: {
    hint: 'Guest reviews you still need to write.',
  },
} satisfies HelpCopyModule;
