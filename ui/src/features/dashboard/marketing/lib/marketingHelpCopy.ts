/**
 * test: N/A — copy-only module. Every `*HelpCopy.ts` file is scanned by
 * `ui/src/lib/help/helpCopy.test.ts`.
 */
import type { HelpCopyModule } from '@/lib/help/types';

/** Marketing Studio media library. Source: `marketingMediaRules.ts#limitMessage`. */
export const MARKETING_HELP_COPY = {
  mediaStorage: {
    hint: 'Photos, videos, and audio you upload here count toward your plan storage. When it is full, new uploads stop until you delete files or upgrade.',
  },
} satisfies HelpCopyModule;
