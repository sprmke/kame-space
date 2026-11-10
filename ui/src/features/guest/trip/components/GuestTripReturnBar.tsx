import { Link } from 'react-router-dom';

import { MessageCircle, Luggage } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Slim return bar for guest pages that live outside the trip page (stay guide, booking
 * document, parking request status).
 *
 * Every guest page must offer a way back to the booking, otherwise a guest who follows an
 * email link has no way home (plan §3.1, finding A7). The bar is sticky at the bottom on
 * phone so it stays reachable without scrolling back up.
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
        'border-border/70 bg-background/95 text-muted-foreground sticky bottom-0 z-20 flex items-center justify-between gap-3 border-t px-4 py-2 text-sm backdrop-blur',
        'pb-[max(0.5rem,env(safe-area-inset-bottom))]',
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
        <Link
          to={chat}
          className="hover:text-foreground inline-flex min-h-[44px] items-center gap-2"
        >
          <MessageCircle className="size-4" aria-hidden />
          Message host
        </Link>
      ) : null}
    </div>
  );
}
