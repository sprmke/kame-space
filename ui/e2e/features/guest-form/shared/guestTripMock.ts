import type { GuestTrip } from '@/features/guest/trip/lib/guestTripApi';

/**
 * Minimal `get-guest-trip` payload for mocked E2E journeys.
 *
 * The trip page reads a lot of the DTO, so a partial payload would render a broken page
 * rather than a failing assertion. Keep this in step with `GuestTripDetailDto`.
 */
export function guestTripMock(overrides: Partial<GuestTrip> = {}): GuestTrip {
  const checkInDate = '2026-12-10';
  const checkOutDate = '2026-12-12';

  return {
    bookingId: 'guest-form-e2e-booking-001',
    status: 'PENDING_REVIEW',
    statusUpdatedAt: null,
    createdAt: null,
    bookingSource: 'Direct',
    property: {
      id: 'property-e2e-001',
      slug: 'solea-mactan',
      name: 'Solea Mactan',
      imageUrl: null,
    },
    stay: {
      checkInDate,
      checkOutDate,
      checkInTime: '14:00',
      checkOutTime: '12:00',
      nights: 2,
      adults: 1,
      children: 0,
      guestNames: ['Maria Santos'],
      email: 'maria@example.com',
      phone: '09171234567',
      specialRequests: null,
    },
    pet: null,
    parking: {
      requested: false,
      carPlate: null,
      linkedBookingId: null,
      linkedStatus: null,
      findPath: null,
    },
    payment: {
      ratesConfirmed: false,
      bookingRate: null,
      downPayment: null,
      securityDeposit: null,
      petFee: null,
      additionalFee: null,
      totalBalance: null,
      balancePaid: 0,
      amountDue: null,
      isAirbnb: false,
    },
    refund: { amount: null, settledAt: null },
    cancellation: {
      policy: {
        title: 'Flexible',
        description: 'Free cancellation up to 3 days before check-in.',
        shortLabel: 'Flexible',
        timeline: [],
        fallbackRefundPercent: 100,
        needsReview: false,
        unset: false,
        capturedFrom: null,
      },
      nonRefundable: false,
      outcome: {
        mode: 'computed',
        refundPercent: 100,
        checkInInstantIso: `${checkInDate}T06:00:00.000Z`,
        cancellableUntilIso: `${checkInDate}T06:00:00.000Z`,
        deadlines: [],
        nextDeadline: null,
        amountPaidPhp: 0,
        refundablePaidPhp: 0,
        retainedPhp: 0,
        refundDuePhp: 0,
        appliedRule: null,
        warnings: [],
        lines: [],
      },
      canCancel: false,
      canRequest: true,
      canWithdraw: false,
      request: null,
      refund: null,
    },
    documents: [],
    actions: {
      canEditBooking: true,
      sdFormAvailable: false,
      reviewAvailable: false,
      reviewSubmitted: false,
    },
    review: {
      state: 'unavailable',
      closesAt: null,
      hostReviewed: false,
      guestRating: null,
      guestText: null,
      hostRating: null,
      hostText: null,
    },
    stayGuidePath: null,
    voucher: null,
    contact: {
      name: 'On-site Contact',
      phone: '09171234567',
      email: 'host@example.com',
      facebookUrl: '',
      airbnbUrl: '',
    },
    accessToken: null,
    ...overrides,
  };
}
