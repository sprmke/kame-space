import { mockEdgeFunctions } from '../../../shared/interceptEdge';

import { guestTripMock } from './guestTripMock';

import { expect, type Locator, type Page } from '@playwright/test';

function manilaTodayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
}

function addDaysYmd(ymd: string, days: number): string {
  const noonManila = new Date(`${ymd}T12:00:00+08:00`);
  noonManila.setUTCDate(noonManila.getUTCDate() + days);
  return noonManila.toISOString().slice(0, 10);
}

/** Future stay window so CI does not fail when URL dates drift into the past (Manila calendar). */
function defaultStayQueryParams(): { checkInDate: string; checkOutDate: string } {
  const today = manilaTodayYmd();
  const checkInDate = addDaysYmd(today, 14);
  const checkOutDate = addDaysYmd(today, 16);
  return { checkInDate, checkOutDate };
}

export const GUEST_FORM_PROPERTY_SLUG = 'solea-mactan';

export type GuestIdentityMockState = {
  status: 'pending' | 'completed';
  verdict: 'verified' | 'partially_verified' | 'unverified';
  verificationId: string;
};

type GuestFormMockOptions = {
  allowPets?: boolean;
  allowParking?: boolean;
  bookedDates?: string[];
  /** When set, the identity session endpoints are driven by this state (phone → desktop). */
  identity?: GuestIdentityMockState;
};

export async function installGuestFormMocks(page: Page, options: GuestFormMockOptions = {}) {
  const allowPets = options.allowPets ?? false;
  const allowParking = options.allowParking ?? false;

  await mockEdgeFunctions(page, [
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
          allowPets,
          allowParking,
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
      name: 'get-booked-dates',
      body: { success: true, data: { bookedDates: options.bookedDates ?? [] } },
    },
    {
      // The primary slot asks whether the guest already holds a live verification. Mock an
      // empty answer so the flow never falls through to a real endpoint.
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
      handler: async (route) => {
        const identity = options.identity;
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              sessionId: 'guest-identity-e2e',
              verificationId: identity?.status === 'completed' ? identity.verificationId : null,
              status: identity?.status ?? 'pending',
              step: identity?.status === 'completed' ? 'done' : 'captured',
              expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
              verdict: identity?.status === 'completed' ? identity.verdict : null,
              flags: [],
              documentType: identity?.status === 'completed' ? 'philid' : null,
              maskedName: identity?.status === 'completed' ? 'Maria S.' : null,
              subjectKind: 'guest',
              guestSlot: 1,
              expired: false,
            },
          }),
        });
      },
    },
    {
      name: 'identity-session-upload',
      method: 'POST',
      body: { success: true, data: { path: 'guest/user/session/document_front.jpg', kind: 'document_front' } },
    },
    {
      name: 'identity-session-submit',
      method: 'POST',
      handler: async (route) => {
        const identity = options.identity;
        if (identity) identity.status = 'completed';
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              sessionId: 'guest-identity-e2e',
              verificationId: identity?.verificationId ?? 'guest-ver-e2e',
              status: 'completed',
              verdict: identity?.verdict ?? 'partially_verified',
              flags: [],
              documentType: 'philid',
              maskedName: 'Maria S.',
            },
          }),
        });
      },
    },
    {
      name: 'identity-session-cancel',
      method: 'POST',
      body: { success: true, data: {} },
    },
    {
      name: 'submit-form',
      method: 'POST',
      body: { success: true, bookingId: 'guest-form-e2e-booking-001' },
    },
    {
      name: 'get-guest-trip',
      body: { success: true, data: guestTripMock() },
    },
    {
      // `null` on purpose. A real property body would carry a cancellation policy, and the form
      // then requires the policy checkbox, which these journeys do not tick. Null also stops the
      // request reaching a real endpoint and stalling the page.
      name: 'get-public-property',
      body: { success: true, data: null },
    },
  ]);
}

export function guestFormPath(extraQuery = '') {
  const { checkInDate, checkOutDate } = defaultStayQueryParams();
  const base = `/properties/${GUEST_FORM_PROPERTY_SLUG}/form?checkInDate=${checkInDate}&checkOutDate=${checkOutDate}`;
  return extraQuery ? `${base}&${extraQuery}` : base;
}

export function guestCalendarPath() {
  return `/properties/${GUEST_FORM_PROPERTY_SLUG}/calendar`;
}

/**
 * Fill a field and keep it filled.
 *
 * Outside production the form seeds itself with random sample data on load, and a second seed
 * pass (the sample effect re-runs when the URL stay dates resolve) can land after the first
 * keystrokes. A plain `fill` then leaves a concatenated value such as
 * `sample@example.comtyped@example.com`, which fails validation and disables Continue.
 * Retrying until the field actually holds the expected value is the only stable ordering.
 */
export async function fillStable(locator: Locator, value: string, timeout = 15_000): Promise<void> {
  await expect
    .poll(
      async () => {
        try {
          await locator.fill(value);
          return await locator.inputValue();
        } catch {
          // The field can detach while the seed re-renders the step.
          return '<not-ready>';
        }
      },
      { timeout, intervals: [100, 250, 500, 1_000] }
    )
    .toBe(value);
}
