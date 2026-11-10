import { useEffect } from 'react';

import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';

import dayjs from 'dayjs';
import { Users, User, Mail, Phone, Info } from 'lucide-react';

import {
  DEFAULT_GUEST_PAYMENT_INFO,
  useGuestPaymentInfo,
} from '@/features/guest/form/hooks/useGuestPaymentInfo';
import { bookingSourceFromUrlSearchParams } from '@/features/guest/form/lib/bookingSourceFromSearchParams';
import { pickGuestBrandHeaderProps } from '@/features/guest/form/lib/guestFormBranding';
import { useGuestPropertySlug } from '@/features/guest/hooks/useGuestPropertySlug';
import { guestCalendarPath, guestTripPath } from '@/features/guest/lib/guestPublicPaths';
import { GuestStayDateRangeDisplay } from '@/features/guest/property/components/GuestStayDateRangeDisplay';

import { GuestFormBrandHeader } from '@/components/branding/GuestFormBrandHeader';
import { Button } from '@/components/ui/button';
import { formatTimeToAMPM, stringToDate } from '@/utils/format/dates';

interface BookingData {
  checkInDate: string;
  checkOutDate: string;
  checkInTime: string;
  checkOutTime: string;
  numberOfAdults: number;
  numberOfChildren: number;
  primaryGuestName: string;
  guest2Name?: string;
  guest3Name?: string;
  guest4Name?: string;
  guest5Name?: string;
  hasPets: boolean;
  petName?: string;
  needParking: boolean;
  guestEmail: string;
  guestPhoneNumber: string;
}

/**
 * Legacy confirmation page.
 *
 * A new submission lands on the trip page instead (plan D1) — the trip page is the single
 * home for a booking and never says "confirmed" before the host proceeds. This route stays
 * for old links: it redirects to the trip when the booking is known, and otherwise shows a
 * minimal "Request sent" card with a way to sign in and see the trip.
 */
export function GuestFormSuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const propertySlug = useGuestPropertySlug();
  const bookingId = searchParams.get('bookingId')?.trim() ?? '';
  const bookingData = location.state?.bookingData as BookingData | undefined;
  const { data: guestBrand = DEFAULT_GUEST_PAYMENT_INFO } = useGuestPaymentInfo();
  const brandHeader = pickGuestBrandHeaderProps(guestBrand);
  const organizationName = guestBrand.organizationName?.trim() || 'us';
  const bookingSource = bookingSourceFromUrlSearchParams(searchParams);
  const isAirbnb = bookingSource === 'Airbnb';
  const isFacebook = bookingSource === 'Facebook';

  // A known booking goes straight to its trip page.
  useEffect(() => {
    if (!bookingId) return;
    if (!propertySlug) return;
    navigate(guestTripPath(propertySlug, bookingId), { replace: true });
  }, [bookingId, navigate, propertySlug]);

  // No booking id at all: send the guest back to browse.
  useEffect(() => {
    if (bookingId) return;
    navigate(propertySlug ? guestCalendarPath(propertySlug) : '/properties', { replace: true });
  }, [bookingId, navigate, propertySlug]);

  // Calculate number of nights
  const numberOfNights = bookingData
    ? Math.max(
        1,
        Math.ceil(
          (dayjs(bookingData.checkOutDate).valueOf() - dayjs(bookingData.checkInDate).valueOf()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0;

  // Get all guest names
  const guestNames = bookingData
    ? [
        bookingData.primaryGuestName,
        bookingData.guest2Name,
        bookingData.guest3Name,
        bookingData.guest4Name,
        bookingData.guest5Name,
      ].filter(Boolean)
    : [];

  const totalGuests = bookingData ? bookingData.numberOfAdults + bookingData.numberOfChildren : 0;

  return (
    <div className="guest-inner-enter public-section-y relative flex flex-col items-center justify-center px-5 text-center">
      <div className="w-full max-w-xl space-y-6 md:space-y-8">
        <GuestFormBrandHeader {...brandHeader} title="Request sent" />
        <p className="text-muted-foreground public-lead">
          Thank you for booking with <strong className="text-primary">{organizationName}</strong>!
        </p>

        {bookingId && propertySlug ? (
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link to={guestTripPath(propertySlug, bookingId)}>View your booking</Link>
          </Button>
        ) : null}

        {bookingData && (
          <div className="space-y-6">
            {/* Booking Summary Card */}
            <div className="border-border bg-card overflow-hidden rounded-xl border shadow-sm">
              <div className="border-separator public-card-pad border-b py-3">
                <h2 className="public-card-title text-foreground font-semibold">Booking Summary</h2>
              </div>

              <div className="public-card-pad space-y-5 text-left">
                {/* Total Nights Badge */}
                <div className="flex justify-center">
                  <div className="bg-primary/10 text-primary inline-flex items-center gap-2 rounded-full px-4 py-2">
                    <span className="text-xl font-bold tabular-nums sm:text-2xl">
                      {numberOfNights}
                    </span>
                    <span className="font-medium">{numberOfNights === 1 ? 'Night' : 'Nights'}</span>
                  </div>
                </div>

                {/* Stay dates */}
                <GuestStayDateRangeDisplay
                  checkIn={stringToDate(bookingData.checkInDate)}
                  checkOut={stringToDate(bookingData.checkOutDate)}
                  checkInDetail={formatTimeToAMPM(bookingData.checkInTime, true)}
                  checkOutDetail={formatTimeToAMPM(bookingData.checkOutTime, false)}
                />

                <div className="space-y-5 border-t pt-5">
                  {/* Number of Guests */}
                  <div className="flex items-start gap-4">
                    <div className="bg-primary/10 rounded-lg p-2">
                      <Users className="text-primary h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                        Guests
                      </p>
                      <p className="text-foreground font-bold">
                        {totalGuests} {totalGuests === 1 ? 'Guest' : 'Guests'}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {bookingData.numberOfAdults}{' '}
                        {bookingData.numberOfAdults === 1 ? 'Adult' : 'Adults'}
                        {bookingData.numberOfChildren > 0 &&
                          ` • ${bookingData.numberOfChildren} ${
                            bookingData.numberOfChildren === 1 ? 'Child' : 'Children'
                          }`}
                      </p>
                    </div>
                  </div>

                  {/* Guest Names */}
                  <div className="flex items-start gap-4">
                    <div className="bg-primary/10 rounded-lg p-2">
                      <User className="text-primary h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-muted-foreground mb-2 text-xs font-medium uppercase">
                        Guest Names
                      </p>
                      <div className="space-y-1.5">
                        {guestNames.map((name, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <div className={`bg-muted-foreground h-1.5 w-1.5 rounded-full`} />
                            <p
                              className={`text-base ${
                                index === 0 ? 'text-foreground font-bold' : 'text-foreground'
                              }`}
                            >
                              {name}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="space-y-4 border-t pt-5">
                    <div className="flex items-start gap-4">
                      <div className="bg-primary/10 rounded-lg p-2">
                        <Mail className="text-primary h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                          Email
                        </p>
                        <p className="text-foreground break-all text-sm">
                          {bookingData.guestEmail}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="bg-primary/10 rounded-lg p-2">
                        <Phone className="text-primary h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                          Phone
                        </p>
                        <p className="text-foreground text-sm">{bookingData.guestPhoneNumber}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Next Steps Info Box */}
        <div className="border-primary/25 bg-primary/5 dark:border-primary/30 dark:bg-primary/10 overflow-hidden rounded-xl border shadow-sm">
          <div className="flex-1 space-y-2 p-5 text-left">
            <div className="flex items-center space-x-2">
              <div className="bg-primary/15 dark:bg-primary/20 flex-shrink-0 rounded-lg p-1">
                <Info className="text-primary dark:text-primary h-4 w-4" />
              </div>
              <h3 className="text-primary dark:text-primary text-base font-semibold">Next Steps</h3>
            </div>
            <div className="text-foreground dark:text-foreground space-y-2 text-sm leading-relaxed">
              <p>
                Your host is reviewing this booking request. We will email you once it is
                confirmed.
              </p>
              {isAirbnb ? (
                <p>Keep your conversation on Airbnb open for any questions.</p>
              ) : isFacebook ? (
                <p>Keep your conversation on Facebook open for any questions.</p>
              ) : (
                <p>Message your host from the booking page for any questions.</p>
              )}
              <p className="pt-1 font-medium">See you soon!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
