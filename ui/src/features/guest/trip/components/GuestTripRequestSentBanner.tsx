import { useEffect, useState } from 'react';

import { Mail, X } from 'lucide-react';

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
  propertyName,
  reviewExpectation,
  className,
}: {
  /** Address the confirmation went to. */
  guestEmail: string | null;
  propertyName: string;
  /** Pre-formatted, e.g. "Most hosts reply within a day". */
  reviewExpectation?: string | null;
  className?: string;
}) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [propertyName]);

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
      <div className="min-w-0 flex-1">
        <p className="text-foreground font-semibold">Request sent</p>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          {propertyName} has your booking request. {expectation}.
        </p>
        {email ? (
          <p className="text-muted-foreground mt-1.5 flex items-center gap-1.5 text-sm">
            <Mail className="size-4 shrink-0" aria-hidden />
            We emailed {email}
          </p>
        ) : null}
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
