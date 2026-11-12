import { useEffect, useState } from 'react';

import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { useGuestPropertySlug } from '@/features/guest/hooks/useGuestPropertySlug';
import { resolveBookingPropertySlug } from '@/features/guest/lib/guestBookingPropertyResolver';
import { guestCalendarPath, guestTripPath } from '@/features/guest/lib/guestPublicPaths';

import { Button } from '@/components/ui/button';
import { PublicFullBleedPageSkeleton } from '@/components/skeletons/GuestPageSkeletons';

/**
 * Legacy booking confirmation route.
 *
 * A new submission lands on the trip page instead (plan D1): the trip page is the single
 * home for a booking and never says "confirmed" before the host proceeds. This route only
 * exists for links already in the wild, so it resolves the booking and forwards to the
 * trip. It renders no booking summary of its own.
 */
export function GuestFormSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const routePropertySlug = useGuestPropertySlug();
  const bookingId = searchParams.get('bookingId')?.trim() ?? '';
  const [failed, setFailed] = useState(false);

  // Legacy global links (`/success?bookingId=`) carry no property, so resolve the slug.
  const needsSlugResolution = Boolean(bookingId) && !routePropertySlug;

  useEffect(() => {
    if (!bookingId) {
      navigate(routePropertySlug ? guestCalendarPath(routePropertySlug) : '/properties', {
        replace: true,
      });
      return;
    }
    if (routePropertySlug) {
      navigate(guestTripPath(routePropertySlug, bookingId), { replace: true });
      return;
    }

    let cancelled = false;
    void (async () => {
      const slug = await resolveBookingPropertySlug(bookingId);
      if (cancelled) return;
      if (!slug) {
        setFailed(true);
        return;
      }
      navigate(guestTripPath(slug, bookingId), { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId, navigate, routePropertySlug]);

  if (!failed) {
    // The trip page owns the interstitial, so show a neutral loading state rather than a
    // flash of an unrelated card.
    return needsSlugResolution ? <PublicFullBleedPageSkeleton label="Opening your booking" /> : null;
  }

  return (
    <div className="guest-inner-enter mx-auto max-w-md px-5 py-16 text-center">
      <h1 className="text-lg font-semibold">We couldn&apos;t open this booking</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Open the link from your booking email, or sign in with the email you booked with.
      </p>
      <div className="mt-6 flex flex-col items-center gap-2">
        <Button asChild variant="outline">
          <Link to="/account/trips">Your trips</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to="/properties">Browse properties</Link>
        </Button>
      </div>
    </div>
  );
}
