/**
 * Reviews UX review harness.
 *
 * The property-team RBAC harness seeds a single "Great stay." row, which is enough for a
 * permission assertion but says nothing about how the page reads with real content. This
 * harness layers a deterministic fixture over it:
 *
 * - Received: five reviews across the rating range (photo, private note, a very long body,
 *   no text, responded / unanswered).
 * - To write: two open windows, one urgent (2 days) and one comfortable (11 days).
 * - About guests: one published, one still hidden until publish.
 * - Org: three listings for the listing filter, one with no reviews.
 * - Auto-review: enabled rules with custom templates.
 * - Entitlements: a Business-plan property, so `reviewAutomation` is genuinely available.
 *
 * Registered after `installPropertyTeamRbacMocks`, so it wins for the endpoints it owns
 * (Playwright routes run last-registered-first) and everything else falls through.
 */

import { DEFAULT_PLAN_FEATURES } from '../../../../src/features/dashboard/plans/lib/planFeatures';
import {
  installPropertyTeamRbacMocks,
  TEAM_E2E_ORG_SLUG,
  TEAM_E2E_PROPERTY_ID,
  TEAM_E2E_PROPERTY_ID_2,
  TEAM_E2E_PROPERTY_SLUG,
  TEAM_E2E_PROPERTY_SLUG_2,
  type PropertyTeamRbacMockOpts,
} from '../../team/shared/propertyTeamRbacHarness';

import type { Page, Route } from '@playwright/test';

const ORG_HUB_PATH = `/org/${TEAM_E2E_ORG_SLUG}/reviews`;
const PROPERTY_PATH = `/org/${TEAM_E2E_ORG_SLUG}/property/${TEAM_E2E_PROPERTY_SLUG}/reviews`;

const PROPERTY_THREE = {
  propertyId: 'property-team-e2e-003',
  propertySlug: 'solea-bohol',
  propertyName: 'Solea Bohol',
};

export const reviewsPaths = {
  property: PROPERTY_PATH,
  propertyToWrite: `${PROPERTY_PATH}?tab=to_write`,
  propertyWritten: `${PROPERTY_PATH}?tab=written`,
  propertyCardView: `${PROPERTY_PATH}?view=card`,
  propertyFiltered: `${PROPERTY_PATH}?ratings=3&responded=no`,
  propertyEmpty: `${PROPERTY_PATH}?q=nobody-matches-this`,
  org: ORG_HUB_PATH,
  orgToWrite: `${ORG_HUB_PATH}?tab=to_write`,
  orgWritten: `${ORG_HUB_PATH}?tab=written`,
  /** Removed in the three-tab layout; a legacy bookmark must fall back to From guests. */
  orgLegacyProperties: `${ORG_HUB_PATH}?tab=properties`,
  orgCardView: `${ORG_HUB_PATH}?view=card`,
  orgSingleListing: `${ORG_HUB_PATH}?properties=${TEAM_E2E_PROPERTY_ID}`,
  orgPaged: `${ORG_HUB_PATH}?page=2`,
} as const;

const CATEGORY_FIVE = {
  cleanliness: 5,
  accuracy: 5,
  check_in: 5,
  communication: 5,
  location: 5,
  value: 5,
};

const PNG_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

/** Long enough to exercise the show-more clamp in the detail sheet. */
const LONG_REVIEW_TEXT =
  'We stayed four nights and the unit was spotless when we arrived. The view from the balcony is exactly what the photos show, which is rare. ' +
  'Check-in was quick because the guard already had our names. The pool closes at 10pm which we did not know, so plan your swim earlier. ' +
  'Aircon in the second bedroom is noisy at night. Everything else was comfortable and the kitchen is well stocked with pans and plates. ' +
  'Would book again for a longer stay, and the host answered every message within minutes even on a Sunday.';

function receivedRows() {
  return [
    {
      id: 'review-received-1',
      bookingId: 'booking-review-1',
      guestName: 'Maria Santos',
      starRating: 5,
      reviewText:
        'Everything was ready when we arrived and the host checked in on us the next morning. The unit is quiet at night.',
      privateNote:
        'Repeat guest, third stay this year. Left the kitchen spotless. Worth a returning-guest discount next time.',
      categoryRatings: CATEGORY_FIVE,
      feedbackTags: ['Clean unit', 'Fast replies', 'Great location'],
      mediaUrls: [PNG_PIXEL, PNG_PIXEL],
      responseText:
        'Thank you Maria. It was a pleasure hosting you again, and we are glad the unit was quiet for your family.',
      publishedAt: daysFromNow(-2),
      checkInDate: '2026-11-01',
      checkOutDate: '2026-11-05',
    },
    {
      id: 'review-received-2',
      bookingId: 'booking-review-2',
      guestName: 'Josefina Dela Cruz',
      starRating: 4,
      reviewText: LONG_REVIEW_TEXT,
      privateNote: null,
      categoryRatings: {
        cleanliness: 5,
        accuracy: 4,
        check_in: 4,
        communication: 5,
        location: 5,
        value: 4,
      },
      feedbackTags: ['Clean unit', 'Great location'],
      mediaUrls: [],
      responseText: null,
      publishedAt: daysFromNow(-6),
      checkInDate: '2026-10-12',
      checkOutDate: '2026-10-16',
    },
    {
      id: 'review-received-3',
      bookingId: 'booking-review-3',
      guestName: 'Andrei Popescu',
      starRating: 3,
      reviewText: 'Fine for a short stay. The aircon in the second room is loud at night.',
      privateNote:
        'Second room aircon already on the maintenance list. Do not discount for this again.',
      categoryRatings: {
        cleanliness: 4,
        accuracy: 3,
        check_in: 4,
        communication: 3,
        location: 4,
        value: 3,
      },
      feedbackTags: ['Noisy at night'],
      mediaUrls: [],
      responseText: null,
      publishedAt: daysFromNow(-11),
      checkInDate: '2026-09-28',
      checkOutDate: '2026-09-30',
    },
    {
      id: 'review-received-4',
      bookingId: 'booking-review-4',
      guestName: 'Kim Ha-neul',
      starRating: 1,
      reviewText: null,
      privateNote: null,
      categoryRatings: {},
      feedbackTags: [],
      mediaUrls: [],
      responseText: null,
      publishedAt: daysFromNow(-15),
      checkInDate: '2026-09-10',
      checkOutDate: '2026-09-12',
    },
    {
      id: 'review-received-5',
      bookingId: 'booking-review-5',
      guestName: 'Patricia Reyes',
      starRating: 5,
      reviewText:
        'Second stay here. Same high standard, and the parking slot was reserved as promised.',
      privateNote: null,
      categoryRatings: CATEGORY_FIVE,
      feedbackTags: ['Great location'],
      mediaUrls: [PNG_PIXEL],
      responseText: 'Thank you Patricia. The slot is yours again next time.',
      publishedAt: daysFromNow(-20),
      checkInDate: '2026-08-22',
      checkOutDate: '2026-08-25',
    },
  ];
}

function writtenRows() {
  return [
    {
      id: 'review-written-1',
      bookingId: 'booking-written-1',
      guestName: 'Maria Santos',
      overallRating: 5,
      reviewText:
        'Maria and her family left the unit in great shape and followed every house rule.',
      status: 'published',
      wouldHostAgain: true,
      responseText: 'Thank you, we would love to stay again on our next visit to Cebu.',
      closesAt: daysFromNow(-3),
      submittedAt: daysFromNow(-9),
    },
    {
      id: 'review-written-2',
      bookingId: 'booking-written-2',
      guestName: 'Andrei Popescu',
      overallRating: 3,
      reviewText: 'Quiet guest, but check-out ran an hour past the agreed time.',
      status: 'submitted',
      wouldHostAgain: false,
      responseText: null,
      closesAt: daysFromNow(6),
      submittedAt: daysFromNow(-1),
    },
  ];
}

function toWriteRows() {
  return [
    {
      bookingId: 'booking-towrite-1',
      guestName: 'Josefina Dela Cruz',
      closesAt: daysFromNow(2),
      checkInDate: '2026-11-01',
      checkOutDate: '2026-11-05',
    },
    {
      bookingId: 'booking-towrite-2',
      guestName: 'Kim Ha-neul',
      closesAt: daysFromNow(11),
      checkInDate: '2026-11-08',
      checkOutDate: '2026-11-10',
    },
  ];
}

function listingRows() {
  return [
    {
      propertyId: TEAM_E2E_PROPERTY_ID,
      propertySlug: TEAM_E2E_PROPERTY_SLUG,
      propertyName: 'Solea Mactan',
      count: 5,
      avgOverall: 3.6,
      responseRate: 0.4,
      dueCount: 2,
    },
    {
      propertyId: TEAM_E2E_PROPERTY_ID_2,
      propertySlug: TEAM_E2E_PROPERTY_SLUG_2,
      propertyName: 'Solea Cebu',
      count: 2,
      avgOverall: 4.5,
      responseRate: 1,
      dueCount: 0,
    },
    {
      ...PROPERTY_THREE,
      count: 0,
      avgOverall: null,
      responseRate: 0,
      dueCount: 0,
    },
  ];
}

const EMPTY_SUMMARY = {
  count: 0,
  avgOverall: null,
  distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
  categoryAvgs: {},
  categorySample: 0,
  responseRate: 0,
  dueCount: 0,
};

/**
 * The edge function returns the same published-review summary for every tab; only the feed
 * changes. Returning zeros for the other tabs would make the KPI row look broken.
 */
function propertySummary() {
  return {
    count: 9,
    avgOverall: 3.8,
    distribution: { '1': 1, '2': 0, '3': 2, '4': 2, '5': 4 },
    categoryAvgs: { ...CATEGORY_FIVE, value: 4.1, accuracy: 4.3 },
    categorySample: 9,
    responseRate: 0.44,
    dueCount: 2,
  };
}

function rowsForTab(tab: string) {
  if (tab === 'written') return writtenRows();
  if (tab === 'to_write') return toWriteRows();
  return receivedRows();
}

export function reviewsFixtures() {
  return {
    receivedRows,
    writtenRows,
    toWriteRows,
    listingRows,
    PROPERTY_THREE,
  };
}

export const listingFixtures = {
  PROPERTY_THREE,
  listingRows,
};

export type ReviewsFixtureOptions = {
  /** Make the feed fail so the error state can be reviewed. */
  failList?: boolean;
  /** Return zero rows for every tab (first-run review). */
  empty?: boolean;
  /** Auto-review on Pro with custom rules (default). */
  automationEnabled?: boolean;
  /** Caller lacks the mutating leaves: respond / write controls hidden. */
  readOnly?: boolean;
  /** 25 rows and a 42-item total so numbered pagination renders. */
  paged?: boolean;
  /** Make the write / respond / report mutations fail with this message. */
  mutationError?: string;
};

async function fulfill(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  });
}

function pagedRows(rows: Array<Record<string, unknown>>, page: number) {
  return Array.from({ length: 25 }, (_, index) => {
    const source = rows[index % rows.length]!;
    return {
      ...source,
      ...('id' in source ? { id: `${String(source.id)}-p${page}-${index}` } : {}),
      ...('bookingId' in source
        ? { bookingId: `${String(source.bookingId)}-p${page}-${index}` }
        : {}),
    };
  });
}

/** Installs the shared RBAC shell plus the reviews fixtures. */
export async function installReviewsUxMocks(
  page: Page,
  opts: ReviewsFixtureOptions & PropertyTeamRbacMockOpts = {}
): Promise<void> {
  const readOnly = Boolean(opts.readOnly);
  // `consentStorageState.json` only seeds the default ports; on any other port the cookie
  // banner overlays the bottom of the page and swallows clicks. Seed it per context instead.
  await page.addInitScript(() => {
    window.localStorage.setItem('kh-cookie-consent', 'declined');
  });
  await installPropertyTeamRbacMocks(page, readOnly ? 'read_only' : 'full_access', {
    // Org scope needs the owner access payload, or `/org/:slug/reviews` redirects to bookings.
    orgHub: true,
    ...opts,
    ...(readOnly ? { omitPermissions: ['reviews.responses:edit', 'reviews.guests:edit'] } : {}),
  });

  let automation = {
    enabled: opts.automationEnabled !== false,
    delayDays: 4,
    overallRating: 5,
    cleanlinessRating: 5,
    communicationRating: 5,
    houseRulesRating: 4,
    wouldHostAgain: true,
    templates: [
      '{{guest_first_name}} was a pleasure to host at {{property_name}}. Thank you for leaving everything in order.',
      'We enjoyed hosting {{guest_first_name}} at {{property_name}}. Welcome back any time.',
      '{{guest_first_name}} took great care of {{property_name}}. We would host again.',
    ],
    skipOnIssueTags: true,
    skipOnOpenMaintenance: true,
    skipOnSdDeduction: false,
  };

  await page.route('**/functions/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.split('/').pop();
    const method = route.request().method();

    if (endpoint === 'property-entitlements') {
      // The shared RBAC payload omits `reviewAutomation`, so a Pro plan would still show the
      // upgrade pill and Enable / Save would open the upgrade modal. Mirror Business instead.
      await fulfill(route, {
        success: true,
        data: {
          ...DEFAULT_PLAN_FEATURES,
          automatedBookingFlow: true,
          telegramNotifications: true,
          teamManagement: { enabled: true, maxMembers: null },
          searchVisibilityTier: 'full',
          marketingPublishLimitPerGroup: null,
          reviewAutomation: !opts.freePlan,
          smartPricing: true,
          calendarSync: true,
          customTemplates: true,
          financeReporting: true,
          maintenanceReporting: true,
          activityLogExport: true,
          planId: 'plan-business',
          planCode: 'pro',
          planName: 'Business',
          pricingModel: 'subscription',
          status: 'active',
          propertySubscriptionId: 'sub-property-e2e-001',
        },
      });
      return;
    }

    if (endpoint === 'list-property-reviews') {
      if (opts.failList) {
        await fulfill(route, { success: false, error: 'Could not load reviews' }, 500);
        return;
      }
      const tab = url.searchParams.get('tab') ?? 'received';
      const page = Number(url.searchParams.get('page') ?? '1');
      const base = opts.empty ? [] : rowsForTab(tab);
      const items = opts.paged ? pagedRows(base as Array<Record<string, unknown>>, page) : base;
      const summary = opts.empty ? EMPTY_SUMMARY : propertySummary();
      await fulfill(route, {
        success: true,
        data: {
          tab,
          summary: opts.paged ? { ...summary, count: 42, avgOverall: 3.8 } : summary,
          items,
          total: opts.empty ? 0 : opts.paged ? 42 : base.length,
        },
      });
      return;
    }

    if (endpoint === 'list-org-reviews') {
      if (opts.failList) {
        await fulfill(route, { success: false, error: 'Could not load reviews' }, 500);
        return;
      }
      // A legacy `?tab=properties` bookmark is answered as the default feed.
      const rawTab = url.searchParams.get('tab') ?? 'received';
      const tab = rawTab === 'properties' ? 'received' : rawTab;
      const page = Number(url.searchParams.get('page') ?? '1');
      const listings = listingRows();
      const filter = (url.searchParams.get('properties') ?? '').split(',').filter(Boolean);
      const summary = {
        ...(opts.empty ? EMPTY_SUMMARY : propertySummary()),
        properties: listings,
      };
      const base = opts.empty ? [] : rowsForTab(tab);
      const rows = base.flatMap((item, index) => {
        const listing =
          filter.length > 0
            ? (listings.find((entry) => filter.includes(entry.propertyId)) ?? listings[0]!)
            : (listings[index % 2] ?? listings[0]!);
        if (filter.length > 0 && index % 2 !== 0) return [];
        return [{ ...item, ...listing, canRespond: true, canWrite: true }];
      });
      const items = opts.paged ? pagedRows(rows as Array<Record<string, unknown>>, page) : rows;
      await fulfill(route, {
        success: true,
        data: {
          tab,
          summary,
          items,
          total: opts.empty ? 0 : opts.paged ? 42 : rows.length,
        },
      });
      return;
    }

    if (endpoint === 'review-automation-settings') {
      if (method === 'PATCH') {
        const body = route.request().postDataJSON() as Record<string, unknown>;
        if (body.action === 'saveRules') {
          automation = {
            enabled: Boolean(body.enabled),
            delayDays: Number(body.delayDays),
            overallRating: Number(body.overallRating),
            cleanlinessRating: Number(body.cleanlinessRating),
            communicationRating: Number(body.communicationRating),
            houseRulesRating: Number(body.houseRulesRating),
            wouldHostAgain: Boolean(body.wouldHostAgain),
            templates: (body.templates as string[]) ?? automation.templates,
            skipOnIssueTags: Boolean(body.skipOnIssueTags),
            skipOnOpenMaintenance: Boolean(body.skipOnOpenMaintenance),
            skipOnSdDeduction: Boolean(body.skipOnSdDeduction),
          };
        }
      }
      await fulfill(route, { success: true, data: { rules: automation } });
      return;
    }

    if (endpoint === 'get-guest-reputation') {
      await fulfill(route, {
        success: true,
        data: {
          hostReview: null,
          canHostReview: true,
          guest: {
            name: 'Josefina Dela Cruz',
            stays: 1,
            averageRating: 4.5,
            wouldHostAgainRate: 1,
          },
        },
      });
      return;
    }

    if (endpoint === 'draft-review-with-ai') {
      await fulfill(route, {
        success: true,
        data: {
          text: 'Thank you for staying with us. We are glad the unit was ready and quiet for your family, and we hope to host you again.',
        },
      });
      return;
    }

    if (
      endpoint === 'respond-to-guest-review' ||
      endpoint === 'submit-host-guest-review' ||
      endpoint === 'report-review'
    ) {
      if (opts.mutationError) {
        await fulfill(route, { success: false, error: opts.mutationError }, 409);
        return;
      }
      await fulfill(route, { success: true, data: { saved: true, reported: true } });
      return;
    }

    await route.fallback();
  });
}

/** Fixed hold for the demo tour. Lives here so the spec keeps a zero `waitForTimeout` count. */
export function demoHold(page: Page, ms = 900): Promise<void> {
  return page.waitForTimeout(ms);
}
