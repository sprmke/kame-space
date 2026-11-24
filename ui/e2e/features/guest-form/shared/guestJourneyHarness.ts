import { guestTripMock } from './guestTripMock';
import { mockPlatformStatus } from '../../../shared/edgeMocks/platformStatus';
import { mockEdgeFunctions } from '../../../shared/interceptEdge';
import { mockPublicPropertyBody, mockPublicPropertiesListBody } from '../../../shared/mockFixtures';

import type { EdgeMock } from '../../../shared/interceptEdge';
import type { Page } from '@playwright/test';

/**
 * Guest journey harness: search results -> listing -> reservation sheet -> guest form ->
 * trip page -> deposit refund (review / voucher / refund details).
 *
 * Written for the 2026-11 guest-flow UX audit. Every endpoint the journey touches is mocked
 * with a single `page.route` registration, so adding a page here never falls through to a
 * live Supabase stack mid-run.
 */

export const JOURNEY_PROPERTY_SLUG = 'solea-mactan';
export const JOURNEY_BOOKING_ID = 'guest-journey-booking-001';

/** `get-booked-dates` for the listing card and the reservation calendar. */
export const journeyBookedDates: string[] = [];

function searchListingsBody() {
  return {
    success: true,
    data: {
      query: {
        where: 'Solea',
        checkIn: '',
        checkOut: '',
        adults: 2,
        children: 0,
        infants: 0,
        pets: 0,
        type: 'all',
        page: 1,
        pageSize: 24,
        lat: null,
        lng: null,
        focus: null,
      },
      totals: { properties: 1, developments: 0, parkings: 0, all: 1 },
      properties: [
        {
          id: 'property-e2e-001',
          slug: JOURNEY_PROPERTY_SLUG,
          name: 'Solea Mactan',
          type: 'CONDO',
          city: 'Lapu-Lapu',
          locationLabel: 'Lapu-Lapu, Cebu',
          residenceName: 'Solea Residences',
          coverImage: null,
          images: [],
          maxGuests: 4,
          bedrooms: 2,
          bathrooms: 1,
          price: 3500,
          rating: 4.9,
          reviewCount: 12,
          amenities: ['WiFi', 'Air conditioning'],
        },
      ],
      developments: [],
      parkings: [],
      meta: {
        intent: 'literal',
        intentLabel: null,
        needsLocation: false,
        usedSmartFallback: false,
        conceptId: null,
      },
    },
  };
}

function sdFormBody() {
  return {
    success: true,
    data: {
      bookingId: JOURNEY_BOOKING_ID,
      primary_guest_name: 'Maria Santos',
      guest_phone_number: '09171234567',
      security_deposit: 3000,
      refund_preview: {
        security_deposit: 3000,
        deductions: 250,
        additions: 0,
        total: 2750,
      },
      check_in_date: '09-10-2026',
      check_out_date: '09-12-2026',
      guest_review_submitted: false,
      vouchers_enabled: true,
      voucher_reveal_style: 'wheel',
      next_stay_voucher_code: null,
      next_stay_voucher_amount: null,
    },
  };
}

export function guestJourneyMocks(): EdgeMock[] {
  return [
    mockPlatformStatus(),
    {
      name: 'search-suggestions',
      body: {
        success: true,
        data: { query: '', locations: [], properties: [], developments: [], parkings: [] },
      },
    },
    { name: 'search-listings', body: searchListingsBody() },
    { name: 'list-public-properties', body: mockPublicPropertiesListBody },
    { name: 'list-public-place-groups', body: { success: true, data: [] } },
    { name: 'get-public-property', body: mockPublicPropertyBody },
    { name: 'property-page-view', method: 'POST', body: { success: true } },
    // Contract is `data: BookedDateRange[]` (both the form and the calendar hook call `.map`).
    { name: 'get-booked-dates', body: { success: true, data: journeyBookedDates } },
    { name: 'guest-profile', body: { success: true, data: null } },
    { name: 'guest-trips', body: { success: true, data: [] } },
    {
      name: 'get-guest-payment-info',
      body: {
        success: true,
        data: {
          gcashName: 'Sample Stays',
          gcashNumber: '09170000000',
          gcashQrImageUrl: '',
          paymentProvider: 'gcash',
          paymentMethods: [],
          emailLogoUrl: '',
          brandColor: '#0f766e',
          gafUnitOwner: 'Unit Owner',
          gafTowerAndUnitNumber: 'Tower 1 / 1204',
          gafGuestsOnsiteContactPerson: 'On-site Contact',
          gafOwnerContactNumber: '09171234567',
          allowPets: true,
          allowParking: true,
          allowSurpriseDecor: false,
          checkInTime: '14:00',
          checkOutTime: '12:00',
          cleaningBufferMinutes: 60,
          maxAdults: 4,
          maxChildren: 2,
          propertyName: 'Solea Mactan',
          propertyEyebrow: 'Sample Stays PH',
          propertyCoverImageUrl: null,
          residenceName: 'Solea Residences',
          organizationName: 'Sample Stays PH',
          defaultParkingRateGuest: 400,
          petFee: 300,
        },
      },
    },
    {
      name: 'identity-verification-mine',
      method: 'GET',
      body: { success: true, data: { hasIdentity: false, verification: null } },
    },
    {
      name: 'identity-session-create',
      method: 'POST',
      body: {
        success: true,
        data: {
          sessionId: 'guest-identity-e2e',
          token: 'guest-identity-token',
          expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
          verifyUrl: '/verify/guest-identity-token',
          qrPayload: '/verify/guest-identity-token',
          subjectKind: 'guest',
          guestSlot: 1,
        },
      },
    },
    {
      name: 'identity-session-get',
      method: 'GET',
      body: {
        success: true,
        data: {
          sessionId: 'guest-identity-e2e',
          verificationId: null,
          status: 'pending',
          step: 'captured',
          expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
          verdict: null,
          flags: [],
          documentType: null,
          maskedName: null,
          subjectKind: 'guest',
          guestSlot: 1,
          expired: false,
        },
      },
    },
    {
      name: 'identity-session-upload',
      method: 'POST',
      body: {
        success: true,
        data: { path: 'guest/user/session/document_front.jpg', kind: 'document_front' },
      },
    },
    {
      name: 'identity-session-submit',
      method: 'POST',
      body: {
        success: true,
        data: {
          sessionId: 'guest-identity-e2e',
          verificationId: 'guest-ver-e2e',
          status: 'completed',
          verdict: 'partially_verified',
          flags: [],
          documentType: 'philid',
          maskedName: 'Maria S.',
        },
      },
    },
    { name: 'identity-session-cancel', method: 'POST', body: { success: true, data: {} } },
    { name: 'submit-form', method: 'POST', body: { success: true, bookingId: JOURNEY_BOOKING_ID } },
    { name: 'get-guest-trip', body: { success: true, data: guestTripMock() } },
    { name: 'get-sd-form', body: sdFormBody() },
    {
      name: 'claim-sd-voucher',
      method: 'POST',
      body: { success: true, data: { code: 'OFF-10', amount: 10, alreadyAwarded: false } },
    },
    { name: 'submit-sd-form', method: 'POST', body: { success: true } },
    { name: 'submit-guest-review', method: 'POST', body: { success: true, data: {} } },
  ];
}

export async function installGuestJourneyMocks(page: Page) {
  await mockEdgeFunctions(page, guestJourneyMocks());
}

/**
 * Holds the current screen so a headed recording is watchable.
 * No-op unless `PLAYWRIGHT_DEMO_PAUSE_MS` is set (see `guestJourneyTour.slowmo.spec.ts`).
 */
export async function demoPause(page: Page, multiplier = 1): Promise<void> {
  const raw = process.env.PLAYWRIGHT_DEMO_PAUSE_MS;
  const ms = raw ? Number.parseInt(raw, 10) : 0;
  if (!ms || !Number.isFinite(ms)) return;
  await page.waitForTimeout(Math.round(ms * multiplier));
}

/** Scrolls a region into view and holds, so a recording shows it before moving on. */
export async function demoScroll(page: Page, y: number, multiplier = 0.6): Promise<void> {
  await page.evaluate((offset) => window.scrollTo({ top: offset, behavior: 'smooth' }), y);
  await demoPause(page, multiplier);
}
