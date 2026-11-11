import { Link } from 'react-router-dom';

import { Luggage, MessageCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Slim return bar for guest pages that live outside the trip shell (the stay guide).
 *
 * A guest who follows an email into the stay guide must be able to get back to the booking
 * and to their host (plan §3.1, findings A7 and D2). Pinned to the bottom on phone and
 * inline from `lg`, where the guide already has its own navigation.
 *
 * Renders nothing without a trip path, so a preview with no real booking shows no bar.
 */
export function GuestTripReturnBar({
  tripPath,
  chatPath,
  className,
}: {
  /** Trip page path. The bar is hidden when there is nothing to link to. */
  tripPath: string | null;
  /** Optional "Message host" link. Hidden when absent. */
  chatPath?: string | null;
  className?: string;
}) {
  const trip = tripPath?.trim() ?? '';
  if (!trip) return null;
  const chat = chatPath?.trim() ?? '';

  return (
    <div
      className={cn(
        'border-border/70 bg-background/95 text-muted-foreground z-30 flex items-center justify-between gap-3 border-t px-4 py-2 text-sm backdrop-blur',
        'fixed inset-x-0 bottom-0 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:static lg:pb-2',
        className
      )}
    >
      <Link
        to={trip}
        className="text-foreground hover:text-primary inline-flex min-h-[44px] items-center gap-2 font-medium"
      >
        <Luggage className="size-4" aria-hidden />
        Your trip
      </Link>
      {chat ? (
        <Link to={chat} className="hover:text-foreground inline-flex min-h-[44px] items-center gap-2">
          <MessageCircle className="size-4" aria-hidden />
          Message host
        </Link>
      ) : null}
    </div>
  );
}
