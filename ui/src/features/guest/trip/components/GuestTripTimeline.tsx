import { Check } from 'lucide-react';

import { GuestTripSection } from '@/features/guest/trip/components/GuestTripSection';
import type { GuestTripTimelineItem } from '@/features/guest/trip/lib/guestTripPhase';

import { cn } from '@/lib/utils';

/**
 * Dated milestones still ahead of the guest (plan 3.2).
 *
 * The progress bar says where the booking is; this says what is coming and when.
 */
export function GuestTripTimeline({ items }: { items: GuestTripTimelineItem[] }) {
  if (items.length === 0) return null;

  return (
    <GuestTripSection id="trip-timeline" title="What happens next">
      <ol className="space-y-2.5">
        {items.map((item) => (
          <li key={item.key} className="flex items-start gap-3 text-sm">
            <span
              className={cn(
                'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full',
                item.done
                  ? 'bg-foreground text-background'
                  : 'border-border text-muted-foreground border'
              )}
              aria-hidden
            >
              {item.done ? <Check className="size-3" strokeWidth={3} /> : null}
            </span>
            <span className="min-w-0 flex-1">{item.label}</span>
            {item.dateLabel ? (
              <span className="text-muted-foreground shrink-0 tabular-nums">{item.dateLabel}</span>
            ) : null}
            <span className="sr-only">{item.done ? 'Done' : 'Coming up'}</span>
          </li>
        ))}
      </ol>
    </GuestTripSection>
  );
}
