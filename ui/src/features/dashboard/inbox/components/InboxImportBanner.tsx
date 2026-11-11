import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

type Props = {
  loadedCount?: number;
  className?: string;
};

/**
 * Import progress, without blocking the inbox.
 *
 * The old modal covered the thread list and told the host to keep the page open, because the
 * browser drove the import. The server owns it now, so this is a quiet line above the list.
 */
export function InboxImportBanner({ loadedCount = 0, className }: Props) {
  return (
    <div
      className={cn(
        'text-muted-foreground bg-muted/60 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
        className
      )}
      role="status"
    >
      <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
      <span className="truncate">
        Bringing in your recent chats. You can keep working.
        {loadedCount > 0
          ? ` ${loadedCount} conversation${loadedCount === 1 ? '' : 's'} loaded.`
          : ''}
      </span>
    </div>
  );
}
