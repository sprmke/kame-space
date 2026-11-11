import { useState } from 'react';

import { X } from 'lucide-react';

import { guestJourneyReviewExpectation } from '@/features/guest/trip/lib/guestJourneyCopy';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * "Request sent" banner on the trip page right after a submission.
 *
 * The booking is still `PENDING_REVIEW`, so the guest needs to know it arrived, what
 * happens next and how long a wait to expect. Dismissible, and dismissed for the rest of
 * the session so a refresh does not bring it back.
 */
export function GuestTripRequestSentBanner({
  guestEmail,
  reviewExpectation,
  className,
}: {
  /** Address the confirmation went to. */
  guestEmail: string | null;
  /** Pre-formatted, e.g. "Most hosts reply within a day". */
  reviewExpectation?: string | null;
  className?: string;
}) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const email = guestEmail?.trim() ?? '';
  const expectation = reviewExpectation?.trim() || guestJourneyReviewExpectation(null);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'border-primary/25 bg-primary/[0.06] flex items-start gap-3 rounded-2xl border p-4',
        className
      )}
    >
      {/* The Now card directly below already says "Request sent", so this strip carries only
          what that card cannot: where the receipt went and how long to expect. */}
      <div className="min-w-0 flex-1">
        <p className="text-foreground text-sm leading-relaxed">
          {email ? (
            <>
              A receipt is on its way to <span className="font-semibold">{email}</span>.{' '}
            </>
          ) : null}
          {expectation}.
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-9 shrink-0"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
      >
        <X className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
