import { Link } from 'react-router-dom';

import { MessageCircle } from 'lucide-react';

import { describeGuestLinkProblem } from '@/features/guest/lib/guestLinkProblem';
import { guestMessagesPath } from '@/features/guest/lib/guestPublicPaths';

import { Button } from '@/components/ui/button';

/**
 * One recovery screen for every guest link that cannot open: expired checkout email, revoked
 * access token, wrong booking. Plain copy first, then two ways forward (message the host, home).
 */
export function GuestLinkUnavailable({
  error,
  propertySlug,
  bookingId,
  className,
}: {
  error?: unknown;
  propertySlug?: string | null;
  bookingId?: string | null;
  className?: string;
}) {
  const problem = describeGuestLinkProblem(error);
  const messagesHref =
    propertySlug && bookingId
      ? guestMessagesPath(propertySlug, new URLSearchParams({ bookingId }))
      : null;

  return (
    <div
      className={className ?? 'relative space-y-4 p-6 text-center sm:p-8'}
      role="alert"
      aria-labelledby="guest-link-problem-title"
    >
      <div className="space-y-2">
        <h1
          id="guest-link-problem-title"
          className="text-foreground text-base font-bold sm:text-lg"
        >
          {problem.title}
        </h1>
        <p className="text-muted-foreground mx-auto max-w-sm text-sm leading-relaxed">
          {problem.body}
        </p>
      </div>
      <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
        {messagesHref ? (
          <Button asChild className="min-h-[44px] w-full sm:w-auto">
            <Link to={messagesHref}>
              <MessageCircle className="size-4" aria-hidden />
              Message the host
            </Link>
          </Button>
        ) : null}
        <Button asChild variant="outline" className="min-h-[44px] w-full sm:w-auto">
          <Link to="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
