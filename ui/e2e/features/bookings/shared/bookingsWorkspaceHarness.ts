import { type Page, type Route } from '@playwright/test';

import {
  E2E_PROPERTY_BOOKING_ID,
  createParkingFlowState,
  e2ePropertyBookingRow,
} from '../../parking/shared/parkingFlowHarness';
import {
  PROPERTY_ID,
  PROPERTY_SLUG,
  createPropertyBookingParkingState,
  installPropertyBookingParkingMocks,
} from '../../parking/shared/propertyBookingParkingHarness';
import {
  FULL_ACCESS_PERMISSIONS,
  OPERATIONS_PERMISSIONS,
  READ_ONLY_PERMISSIONS,
} from '../../team/shared/propertyTeamRbacHarness';

/**
 * Bookings workspace fixtures — list + detail across every workflow stage, with
 * plan-tier and team-permission variants.
 *
 * The list endpoint is emulated closely enough to be trustworthy: search, status,
 * stage, date range, pets/parking, completed visibility, sort and pagination all
 * behave like `list-bookings`, so a spec that filters really filters.
 */

export const BOOKINGS_ORG_SLUG = 'sample-stays-ph';
export const BOOKINGS_PROPERTY_SLUG = PROPERTY_SLUG;
export const BOOKINGS_PRIMARY_ID = E2E_PROPERTY_BOOKING_ID;

export const bookingsPaths = {
  list: `/org/${BOOKINGS_ORG_SLUG}/property/${BOOKINGS_PROPERTY_SLUG}/bookings`,
  detail: (id: string = BOOKINGS_PRIMARY_ID) =>
    `/org/${BOOKINGS_ORG_SLUG}/property/${BOOKINGS_PROPERTY_SLUG}/bookings/${id}`,
  listView: (view: 'table' | 'card' | 'calendar' | 'kanban') =>
    `/org/${BOOKINGS_ORG_SLUG}/property/${BOOKINGS_PROPERTY_SLUG}/bookings?view=${view}`,
} as const;

export type BookingsPlan = 'starter' | 'business' | 'free';
export type BookingsPermissionTemplate = 'owner' | 'operations' | 'read_only';

export type BookingsWorkspaceRow = ReturnType<typeof e2ePropertyBookingRow>;

export const BOOKING_ROW_IDS = {
  pendingReview: 'bk-e2e-0001-pending-review',
  pendingDocs: BOOKINGS_PRIMARY_ID,
  petRequest: 'bk-e2e-0003-pet-request',
  parkingRequest: 'bk-e2e-0004-parking-request',
  readyCheckIn: 'bk-e2e-0005-ready-checkin',
  readyCheckOut: 'bk-e2e-0006-ready-checkout',
  sdRefund: 'bk-e2e-0007-sd-refund',
  completed: 'bk-e2e-0008-completed',
  cancelled: 'bk-e2e-0009-cancelled',
  awaitingApproval: 'bk-e2e-0010-awaiting-approval',
  importedAirbnb: 'bk-e2e-0011-imported-airbnb',
  pendingPayment: 'bk-e2e-0012-pending-payment',
} as const;

function row(overrides: Record<string, unknown>): BookingsWorkspaceRow {
  return e2ePropertyBookingRow({
    property_id: PROPERTY_ID,
    property_name: 'Solea Mactan',
    property_slug: PROPERTY_SLUG,
    booking_kind: 'property',
    // Fixture stays sit inside the default "This month" range (Nov 2026).
    guest_address: 'Cebu City',
    nationality: 'Filipino',
    guest_special_requests: null,
    find_us: 'Facebook',
    find_us_details: null,
    ...overrides,
  }) as BookingsWorkspaceRow;
}

/** Twelve bookings covering every canonical stage plus the non-canonical ones in the wild. */
export function bookingsWorkspaceRows(): BookingsWorkspaceRow[] {
  return [
    row({
      id: BOOKING_ROW_IDS.pendingReview,
      primary_guest_name: 'Ana Villanueva',
      guest_facebook_name: 'Ana Villanueva',
      guest_email: 'ana.villanueva@example.com',
      check_in_date: '11-26-2026',
      check_out_date: '11-28-2026',
      number_of_nights: 2,
      status: 'PENDING_REVIEW',
      need_parking: false,
      has_pets: false,
      booking_rate: 5000,
      down_payment: 1500,
      gaf_request_pdf_url: null,
      valid_id_url: 'https://example.com/e2e-id-ana.pdf',
      created_at: '2026-11-20T02:10:00.000Z',
    }),
    row({
      id: BOOKINGS_PRIMARY_ID,
      primary_guest_name: 'Maria Santos',
      guest_facebook_name: 'Maria Santos',
      check_in_date: '11-25-2026',
      check_out_date: '11-27-2026',
      number_of_nights: 2,
      status: 'PENDING_DOCUMENTS',
      need_parking: true,
      has_pets: false,
      booking_rate: 6000,
      down_payment: 2000,
      balance: 4000,
      security_deposit: 1500,
      created_at: '2026-11-19T05:00:00.000Z',
    }),
    row({
      id: BOOKING_ROW_IDS.petRequest,
      primary_guest_name: 'Liam Tan',
      guest_facebook_name: 'Liam Tan',
      guest_email: 'liam.tan@example.com',
      check_in_date: '11-27-2026',
      check_out_date: '11-30-2026',
      number_of_nights: 3,
      status: 'PENDING_PET_REQUEST',
      need_parking: false,
      has_pets: true,
      pet_name: 'Coco',
      pet_type: 'Dog',
      pet_breed: 'Shih Tzu',
      pet_age: '3',
      pet_fee: 500,
      created_at: '2026-11-18T08:30:00.000Z',
    }),
    row({
      id: BOOKING_ROW_IDS.parkingRequest,
      primary_guest_name: 'Sofia Reyes',
      guest_facebook_name: 'Sofia Reyes',
      guest_email: 'sofia.reyes@example.com',
      check_in_date: '11-26-2026',
      check_out_date: '11-29-2026',
      number_of_nights: 3,
      status: 'PENDING_PARKING_REQUEST',
      need_parking: true,
      has_pets: false,
      car_plate_number: 'NCR-8891',
      car_brand_model: 'Honda City',
      car_color: 'White',
      parking_rate_guest: 350,
      created_at: '2026-11-18T11:45:00.000Z',
    }),
    row({
      id: BOOKING_ROW_IDS.readyCheckIn,
      primary_guest_name: 'Noah Lim',
      guest_facebook_name: 'Noah Lim',
      guest_email: 'noah.lim@example.com',
      check_in_date: '11-26-2026',
      check_out_date: '11-29-2026',
      number_of_nights: 3,
      status: 'READY_FOR_CHECKIN',
      need_parking: false,
      has_pets: false,
      booking_rate: 7500,
      down_payment: 2500,
      balance: 5000,
      created_at: '2026-11-12T03:15:00.000Z',
    }),
    row({
      id: BOOKING_ROW_IDS.readyCheckOut,
      primary_guest_name: 'Isabella Cruz',
      guest_facebook_name: 'Isabella Cruz',
      guest_email: 'isabella.cruz@example.com',
      check_in_date: '11-21-2026',
      check_out_date: '11-24-2026',
      number_of_nights: 3,
      status: 'READY_FOR_CHECKOUT',
      need_parking: false,
      has_pets: false,
      booking_rate: 7500,
      security_deposit: 1500,
      created_at: '2026-11-10T09:00:00.000Z',
    }),
    row({
      id: BOOKING_ROW_IDS.sdRefund,
      primary_guest_name: 'Ethan Ong',
      guest_facebook_name: 'Ethan Ong',
      guest_email: 'ethan.ong@example.com',
      check_in_date: '11-18-2026',
      check_out_date: '11-21-2026',
      number_of_nights: 3,
      status: 'PENDING_SD_REFUND',
      need_parking: false,
      has_pets: false,
      booking_rate: 7000,
      security_deposit: 1500,
      sd_refund_amount: 1200,
      created_at: '2026-11-05T06:20:00.000Z',
    }),
    row({
      id: BOOKING_ROW_IDS.completed,
      primary_guest_name: 'Chloe Reyes',
      guest_facebook_name: 'Chloe Reyes',
      guest_email: 'chloe.reyes@example.com',
      check_in_date: '11-10-2026',
      check_out_date: '11-12-2026',
      number_of_nights: 2,
      status: 'COMPLETED',
      need_parking: false,
      has_pets: false,
      booking_rate: 5000,
      settled_at: '2026-11-13T04:00:00.000Z',
      created_at: '2026-10-28T02:00:00.000Z',
    }),
    row({
      id: BOOKING_ROW_IDS.cancelled,
      primary_guest_name: 'Daniel Padilla',
      guest_facebook_name: 'Daniel Padilla',
      guest_email: 'daniel.padilla@example.com',
      check_in_date: '11-15-2026',
      check_out_date: '11-17-2026',
      number_of_nights: 2,
      status: 'CANCELLED',
      need_parking: false,
      has_pets: false,
      booking_rate: 5000,
      created_at: '2026-10-30T07:30:00.000Z',
    }),
    row({
      id: BOOKING_ROW_IDS.awaitingApproval,
      primary_guest_name: 'Grace Uy',
      guest_facebook_name: 'Grace Uy',
      guest_email: 'grace.uy@example.com',
      check_in_date: '11-28-2026',
      check_out_date: '11-30-2026',
      number_of_nights: 2,
      status: 'PENDING_DOCUMENTS',
      need_parking: false,
      has_pets: false,
      booking_rate: 5000,
      gaf_request_pdf_url: 'https://example.com/e2e-gaf-request.pdf',
      approved_gaf_pdf_url: null,
      valid_id_url: null,
      created_at: '2026-11-21T01:00:00.000Z',
    }),
    row({
      id: BOOKING_ROW_IDS.importedAirbnb,
      primary_guest_name: 'Julia Mercado',
      guest_facebook_name: 'Julia Mercado',
      guest_email: 'julia.mercado@example.com',
      check_in_date: '11-29-2026',
      check_out_date: '12-02-2026',
      number_of_nights: 3,
      status: 'PENDING_REVIEW',
      need_parking: false,
      has_pets: false,
      booking_rate: 8200,
      external_source: 'airbnb',
      external_uid: 'HM-AIRBNB-5521',
      created_at: '2026-11-22T12:00:00.000Z',
    }),
    row({
      id: BOOKING_ROW_IDS.pendingPayment,
      primary_guest_name: 'Marco Diaz',
      guest_facebook_name: 'Marco Diaz',
      guest_email: 'marco.diaz@example.com',
      check_in_date: '11-30-2026',
      check_out_date: '12-02-2026',
      number_of_nights: 2,
      status: 'PENDING_PAYMENT',
      need_parking: false,
      has_pets: false,
      booking_rate: 5000,
      parking_payment_expires_at: '2026-11-25T10:00:00.000Z',
      created_at: '2026-11-23T02:00:00.000Z',
    }),
  ];
}

export type BookingsWorkspaceState = {
  rows: BookingsWorkspaceRow[];
  plan: BookingsPlan;
  permissionTemplate: BookingsPermissionTemplate;
  /** Last query string seen by the emulated list endpoint. */
  lastListQuery: URLSearchParams | null;
  /** Every list request, in order (proves the page does not refetch in a loop). */
  listRequests: URLSearchParams[];
};

export type InstallBookingsWorkspaceOptions = {
  rows?: BookingsWorkspaceRow[];
  plan?: BookingsPlan;
  permissionTemplate?: BookingsPermissionTemplate;
  /** Free plan hides automated sends; detail page switches to manual triggers. */
  primaryStatus?: string;
  /** Emulate a transition failure (HTTP 400) from the workflow endpoint. */
  transitionFailure?: string;
  /** Emulate a list failure. */
  listFailure?: { status: number; message: string };
};

function permissionsFor(template: BookingsPermissionTemplate): readonly string[] {
  if (template === 'owner') return FULL_ACCESS_PERMISSIONS;
  if (template === 'operations') return OPERATIONS_PERMISSIONS;
  return READ_ONLY_PERMISSIONS;
}

function entitlementsFor(plan: BookingsPlan) {
  if (plan === 'free') {
    return {
      automatedBookingFlow: false,
      bookingImport: false,
      aiValidations: false,
      teamManagement: { enabled: false, maxMembers: null },
      financeReporting: false,
      maintenanceReporting: false,
      customRoles: false,
      planId: 'plan-e2e-free',
      planCode: 'free',
      planName: 'Free',
      propertySubscriptionId: 'sub-e2e-free',
      status: 'active',
      pricingModel: 'monthly',
    };
  }
  return {
    automatedBookingFlow: true,
    // Starter+ = import; Business = AI validations + custom templates too.
    bookingImport: true,
    aiValidations: plan === 'business',
    teamManagement: { enabled: true, maxMembers: null },
    financeReporting: true,
    maintenanceReporting: true,
    customRoles: true,
    planId: plan === 'business' ? 'plan-e2e-business' : 'plan-e2e-starter',
    planCode: plan,
    planName: plan === 'business' ? 'Business' : 'Starter',
    propertySubscriptionId: `sub-e2e-${plan}`,
    status: 'active',
    pricingModel: 'monthly',
  };
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

/** MM-DD-YYYY → YYYY-MM-DD (the DB guest-date convention). */
function isoFromGuestDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return value;
  return `${match[3]}-${match[1]}-${match[2]}`;
}

function matchesStatusFilter(row: BookingsWorkspaceRow, statuses: string[]): boolean {
  if (statuses.length === 0) return true;
  return statuses.some((status) => {
    if (status === row.status) return true;
    // IMPORTED filter includes future/past imported batches that now carry a normal status.
    if (status === 'IMPORTED') {
      return Boolean(row.external_uid) || Boolean(row.external_source);
    }
    return false;
  });
}

function matchesSearch(row: BookingsWorkspaceRow, needle: string): boolean {
  if (!needle) return true;
  const haystack = [
    row.primary_guest_name,
    row.guest_facebook_name,
    row.guest_email,
    row.guest_phone_number,
    row.car_plate_number,
    row.pet_name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle.toLowerCase());
}

function sortRows(rows: BookingsWorkspaceRow[], sort: string): BookingsWorkspaceRow[] {
  const out = [...rows];
  if (sort === 'check_in_date:asc' || sort === 'check_in_date:desc') {
    const dir = sort.endsWith('asc') ? 1 : -1;
    out.sort((a, b) =>
      String(isoFromGuestDate(a.check_in_date)).localeCompare(
        String(isoFromGuestDate(b.check_in_date))
      ) * dir
    );
    return out;
  }
  const dir = sort === 'created_at:asc' ? 1 : -1;
  out.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) * dir);
  return out;
}

/**
 * Installs the whole property bookings workspace: org/property/plan/team envelopes,
 * the emulated `list-bookings` endpoint, and a detail row for every fixture id.
 */
export async function installBookingsWorkspaceMocks(
  page: Page,
  options: InstallBookingsWorkspaceOptions = {}
): Promise<BookingsWorkspaceState> {
  const rows = (options.rows ?? bookingsWorkspaceRows()).map((r) =>
    options.primaryStatus && r.id === BOOKINGS_PRIMARY_ID
      ? { ...r, status: options.primaryStatus }
      : r
  );
  const plan = options.plan ?? 'starter';
  const permissionTemplate = options.permissionTemplate ?? 'owner';

  const state: BookingsWorkspaceState = {
    rows,
    plan,
    permissionTemplate,
    lastListQuery: null,
    listRequests: [],
  };

  const primary = rows.find((r) => r.id === BOOKINGS_PRIMARY_ID) ?? rows[0];

  await installPropertyBookingParkingMocks(
    page,
    createParkingFlowState(),
    createPropertyBookingParkingState({ linked: false, hasOwnDefaultParking: false }),
    {
      freePlan: plan === 'free',
      bookingOverrides: {
        ...primary,
        status: options.primaryStatus ?? primary.status,
      },
    }
  );

  // Team access + plan envelope, last-wins over the parking harness defaults.
  await page.route('**/functions/v1/property-access**', async (route) => {
    const template = state.permissionTemplate;
    await fulfillJson(route, {
      success: true,
      data: {
        accessKind: template === 'owner' ? 'owner' : 'member',
        permissions: [...permissionsFor(template)],
        memberId: template === 'owner' ? null : 'member-bookings-e2e-001',
        propertyId: PROPERTY_ID,
        orgSlug: BOOKINGS_ORG_SLUG,
        orgName: 'Sample Stays PH',
        propertySlug: PROPERTY_SLUG,
        propertyName: 'Solea Mactan',
        planLimited: false,
      },
    });
  });

  await page.route('**/functions/v1/property-entitlements**', async (route) => {
    await fulfillJson(route, { success: true, data: entitlementsFor(state.plan) });
  });

  await page.route('**/functions/v1/get-guest-reputation**', async (route) => {
    await fulfillJson(route, {
      success: true,
      data: {
        hostReview: null,
        canHostReview: true,
        guest: { name: 'Maria Santos', stays: 2, rating: 4.8 },
      },
    });
  });

  await page.route('**/functions/v1/activity-log**', async (route) => {
    await fulfillJson(route, {
      success: true,
      data: { entries: [], nextCursor: null },
    });
  });

  await page.route('**/functions/v1/list-bookings**', async (route) => {
    const url = new URL(route.request().url());
    state.lastListQuery = url.searchParams;
    state.listRequests.push(url.searchParams);

    if (options.listFailure) {
      await fulfillJson(
        route,
        { success: false, error: options.listFailure.message },
        options.listFailure.status
      );
      return;
    }

    const statuses = url.searchParams.getAll('status');
    const q = url.searchParams.get('q') ?? '';
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const hasPets = url.searchParams.get('has_pets');
    const needParking = url.searchParams.get('need_parking');
    const bookingKind = url.searchParams.get('booking_kind');
    const showCompleted = url.searchParams.get('show_completed_bookings') === 'true';
    const sort = url.searchParams.get('sort') ?? 'status_priority:asc';
    const page_ = Number(url.searchParams.get('page') ?? '1');
    const limit = Number(url.searchParams.get('limit') ?? '31');

    let filtered = state.rows.filter((r) => matchesStatusFilter(r, statuses));
    filtered = filtered.filter((r) => matchesSearch(r, q));
    if (hasPets) filtered = filtered.filter((r) => Boolean(r.has_pets) === (hasPets === 'true'));
    if (needParking) {
      filtered = filtered.filter((r) => Boolean(r.need_parking) === (needParking === 'true'));
    }
    if (bookingKind) filtered = filtered.filter((r) => r.booking_kind === bookingKind);
    if (from || to) {
      filtered = filtered.filter((r) => {
        const iso = isoFromGuestDate(r.check_in_date);
        if (!iso) return false;
        if (from && iso < from) return false;
        if (to && iso > to) return false;
        return true;
      });
    }
    if (statuses.length === 0 && !showCompleted) {
      filtered = filtered.filter((r) => r.status !== 'COMPLETED' && r.status !== 'CANCELLED');
    }

    const sorted = sortRows(filtered, sort);
    const start = (page_ - 1) * limit;
    await fulfillJson(route, {
      success: true,
      data: sorted.slice(start, start + limit),
      total: sorted.length,
    });
  });

  await page.route('**/functions/v1/get-booking**', async (route) => {
    const url = new URL(route.request().url());
    const bookingId = url.searchParams.get('booking_id');
    const found = state.rows.find((r) => r.id === bookingId);
    if (bookingId === BOOKINGS_PRIMARY_ID) {
      await fulfillJson(route, { success: true, data: { ...found } });
      return;
    }
    if (!found) {
      await fulfillJson(route, { success: false, error: 'Booking not found' }, 404);
      return;
    }
    await fulfillJson(route, { success: true, data: { ...found } });
  });

  await page.route('**/functions/v1/transition-booking**', async (route) => {
    if (options.transitionFailure) {
      await fulfillJson(route, { success: false, error: options.transitionFailure }, 400);
      return;
    }
    const body = (route.request().postDataJSON?.() as Record<string, unknown> | undefined) ?? {};
    await route.fallback();
    // Keep the emulated list/detail rows in step with the transition the harness just accepted.
    if (typeof body.bookingId === 'string' && typeof body.toStatus === 'string') {
      state.rows = state.rows.map((r) =>
        r.id === body.bookingId ? { ...r, status: body.toStatus as string } : r
      );
    }
  });

  return state;
}

/** Slow-motion demo helpers (per-feature copies are the convention in this repo). */
export async function dismissCookieConsent(page: Page): Promise<void> {
  await page
    .locator('#app-loader-host')
    .waitFor({ state: 'detached', timeout: 20_000 })
    .catch(() => undefined);
  for (const name of ['Essential only', 'Necessary only']) {
    const button = page.getByRole('button', { name });
    if (await button.isVisible().catch(() => false)) {
      await button.click();
      return;
    }
  }
}

export async function demoPause(page: Page, multiplier = 1): Promise<void> {
  const raw = process.env.PLAYWRIGHT_DEMO_PAUSE_MS;
  const ms = raw ? Number.parseInt(raw, 10) : 0;
  if (!ms || !Number.isFinite(ms)) return;
  await page.waitForTimeout(Math.round(ms * multiplier));
}

export async function demoScroll(page: Page, y: number, multiplier = 0.6): Promise<void> {
  // Put the pointer over the scrollport first: on emulated phones a wheel event at
  // (0,0) lands outside the admin shell and does nothing.
  const viewport = page.viewportSize();
  if (viewport) {
    await page.mouse.move(viewport.width / 2, viewport.height / 2);
  }
  await page.mouse.wheel(0, y);
  await demoPause(page, multiplier);
}

/** Screenshot capture helper — no-op unless PLAYWRIGHT_CAPTURE_SCREENS=1. */
export async function capture(page: Page, dir: string, name: string): Promise<void> {
  if (process.env.PLAYWRIGHT_CAPTURE_SCREENS !== '1') return;
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: false });
}
