/**
 * Deterministic property analytics harness.
 *
 * Layers a full, realistic analytics bundle (KPIs with stable deltas, booking pace, the five
 * distributions, benchmark, public page, marketing, playbook) over the shared property RBAC mocks,
 * so the page renders every card in every tab without depending on the local database.
 *
 * The AI review fixture is pinned to the *current* Asia/Manila month, because the card only
 * renders a review for the current week/month/year. Charts and KPIs use the same month so the
 * header period control and the review agree.
 */

import { expect, type Page, type Route } from '@playwright/test';

import {
  FULL_ACCESS_PERMISSIONS,
  installPropertyTeamRbacMocks,
  TEAM_E2E_ORG_SLUG,
  TEAM_E2E_PROPERTY_ID,
  TEAM_E2E_PROPERTY_SLUG,
  type TeamRbacTemplate,
} from '../../team/shared/propertyTeamRbacHarness';

const PROPERTY_BASE = `/org/${TEAM_E2E_ORG_SLUG}/property/${TEAM_E2E_PROPERTY_SLUG}`;

export const analyticsTourPaths = {
  analytics: `${PROPERTY_BASE}/analytics`,
  pricing: `${PROPERTY_BASE}/pricing`,
  marketing: `${PROPERTY_BASE}/marketing`,
  publicPages: `${PROPERTY_BASE}/public-pages`,
} as const;

export const ANALYTICS_PLAYBOOK = {
  blockedDates: {
    slug: 'audit-blocked-dates',
    category: 'Availability',
    title: 'Audit your blocked dates',
    bodyMd: 'Open your calendar and release any date you blocked for a stay that never happened.',
    sortOrder: 1,
  },
  unpaidBalances: {
    slug: 'follow-up-unpaid-balances',
    category: 'Collections',
    title: 'Follow up on unpaid balances before check-in',
    bodyMd: 'Send a balance reminder the day before arrival so nobody checks in owing money.',
    sortOrder: 2,
  },
  channelDiversity: {
    slug: 'diversify-channels',
    category: 'Marketing',
    title: 'Diversify where your bookings come from',
    bodyMd: 'Add a second channel before one source carries most of your bookings.',
    sortOrder: 3,
  },
} as const;

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Current Asia/Manila calendar month. The AI review card only accepts the current period. */
export function currentManilaMonthRange(): { from: string; to: string } {
  const manila = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  const y = manila.getFullYear();
  const m = manila.getMonth();
  return {
    from: `${y}-${String(m + 1).padStart(2, '0')}-01`,
    to: `${y}-${String(m + 1).padStart(2, '0')}-${String(new Date(y, m + 1, 0).getDate()).padStart(2, '0')}`,
  };
}

/** A prior month, used for the "Current period only" branch. */
export function priorManilaMonthRange(): { from: string; to: string } {
  const manila = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  const d = new Date(manila.getFullYear(), manila.getMonth() - 1, 1);
  return {
    from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`,
    to: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()).padStart(2, '0')}`,
  };
}

export function analyticsPath(query = ''): string {
  const month = currentManilaMonthRange();
  const base = `${analyticsTourPaths.analytics}?from=${month.from}&to=${month.to}`;
  return query ? `${base}&${query}` : base;
}

const kpi = (value: number, changePctVsPrior: number | null = null) => ({
  value,
  changePctVsPrior,
  changePctVsLastYear: null,
});

/** 31 daily booking-pace buckets with a believable pickup curve and last-year comparison. */
function bookingPaceFixture(from: string) {
  const start = new Date(`${from}T00:00:00`);
  const counts = [
    0, 1, 0, 2, 1, 0, 0, 3, 1, 0, 2, 1, 0, 0, 1, 2, 0, 1, 0, 0, 2, 1, 0, 1, 0, 2, 1, 0, 0, 1, 0,
  ];
  return counts.map((reservations, index) => {
    const d = new Date(start);
    d.setDate(start.getDate() + index);
    return {
      monthStart: iso(d),
      reservations,
      revenue: reservations * 3480,
      reservationsLastYear: Math.max(0, reservations - (index % 3 === 0 ? 1 : 0)),
      revenueLastYear: Math.max(0, reservations - (index % 3 === 0 ? 1 : 0)) * 3210,
    };
  });
}

export type AnalyticsBundleOptions = {
  /** Non-cancelled bookings ever seen. Below 10 the AI review analyze path is disabled. */
  sampleSize?: number;
  /** An empty period: no bookings, no views, no playbook, no peer sample. */
  empty?: boolean;
  /** Omit the benchmark block values (peers too few) while keeping the card. */
  benchmarkUnavailable?: boolean;
};

export function buildAnalyticsBundle(options: AnalyticsBundleOptions = {}) {
  const month = currentManilaMonthRange();
  const prior = priorManilaMonthRange();
  const empty = options.empty ?? false;
  const sampleSize = options.sampleSize ?? 36;

  if (empty) {
    return {
      tier: 'full',
      period: month,
      priorPeriod: prior,
      lastYearPeriod: { from: '', to: '' },
      kpis: {
        occupancyRate: kpi(0, 0),
        adr: kpi(0, 0),
        revpar: kpi(0, 0),
        grossRevenue: kpi(0, 0),
        netProfit: kpi(0, 0),
        reservations: kpi(0, 0),
        nightsBooked: kpi(0, 0),
        avgLeadTimeDays: kpi(0, 0),
        cancellationRate: kpi(0, 0),
        avgRating: kpi(0, 0),
        repeatGuestRate: kpi(0, 0),
        avgResponseMinutes: kpi(0, 0),
        responseWithin24hRate: kpi(0, 0),
      },
      trend: [],
      distributions: {
        lengthOfStay: [],
        leadTime: [],
        channelMix: [],
        guestAge: [],
        guestOrigins: [],
        partySize: [],
      },
      forward: {
        windowDays: 90,
        nightsBooked: 0,
        nightsAvailable: 90,
        occupancyOnBooks: 0,
        revenueOnBooks: 0,
        gapNights: [],
      },
      bookingPace: [],
      pickup: { last7Days: 0, last30Days: 0 },
      stateAssessment: {
        forwardOccupancyState30d: 'underbooked',
        forwardOccupancyState60d: 'underbooked',
        balanceCollectionState: 'clear',
        unpaidBalanceUpcomingTotal: 0,
        unpaidBalanceUpcomingCount: 0,
      },
      sufficiency: { sampleSize, enough: sampleSize >= 10 },
      publicPage: { pageViews: 0, uniqueVisitors: 0, topReferrers: [] },
      playbook: [],
      benchmark: {
        available: false,
        sampleSize: 0,
        medianOccupancyRate: null,
        medianAdr: null,
        occupancyPercentile: null,
        adrPercentile: null,
      },
      marketing: { trackedVisits: 0, attributedRequests: 0, channels: [] },
    };
  }

  return {
    tier: 'full',
    period: month,
    priorPeriod: prior,
    lastYearPeriod: { from: '2025-01-01', to: '2025-01-31' },
    kpis: {
      occupancyRate: kpi(72, 6.4),
      adr: kpi(3480, 4.1),
      revpar: kpi(2506, 3.2),
      grossRevenue: kpi(184_650, 12.4),
      netProfit: kpi(142_300, 9.8),
      reservations: kpi(18, 12.5),
      nightsBooked: kpi(27, 8.0),
      avgLeadTimeDays: kpi(14, -2.0),
      cancellationRate: kpi(5.6, -1.2),
      avgRating: kpi(4.7, 0.2),
      repeatGuestRate: kpi(11, 1.0),
      avgResponseMinutes: kpi(22, -8.0),
      responseWithin24hRate: kpi(96, 3.0),
    },
    trend: [],
    distributions: {
      leadTime: [
        { bucket: '0-3 days', count: 3 },
        { bucket: '4-7 days', count: 5 },
        { bucket: '8-14 days', count: 6 },
        { bucket: '15-30 days', count: 3 },
        { bucket: '31-60 days', count: 1 },
      ],
      lengthOfStay: [
        { bucket: '1 night', count: 4 },
        { bucket: '2-3 nights', count: 8 },
        { bucket: '4-6 nights', count: 5 },
        { bucket: '7-13 nights', count: 1 },
      ],
      channelMix: [
        { channel: 'Airbnb', count: 9, revenue: 96_000 },
        { channel: 'Direct', count: 4, revenue: 41_200 },
        { channel: 'Facebook', count: 3, revenue: 28_400 },
        { channel: 'Booking.com', count: 2, revenue: 19_050 },
      ],
      guestAge: [
        { bucket: '18-24', count: 1 },
        { bucket: '25-34', count: 7 },
        { bucket: '35-44', count: 6 },
        { bucket: '45-54', count: 3 },
        { bucket: '55-64', count: 1 },
      ],
      guestOrigins: [
        { origin: 'Makati, Metro Manila', count: 5, pct: 27.8 },
        { origin: 'Cebu City, Cebu', count: 4, pct: 22.2 },
        { origin: 'Quezon City, Metro Manila', count: 3, pct: 16.7 },
        { origin: 'Taguig, Metro Manila', count: 2, pct: 11.1 },
        { origin: 'Davao City, Davao del Sur', count: 2, pct: 11.1 },
        { origin: 'Singapore', count: 2, pct: 11.1 },
      ],
      partySize: [
        { bucket: '1', count: 3 },
        { bucket: '2', count: 7 },
        { bucket: '3', count: 4 },
        { bucket: '4', count: 3 },
        { bucket: '5+', count: 1 },
      ],
    },
    forward: {
      windowDays: 90,
      nightsBooked: 41,
      nightsAvailable: 90,
      occupancyOnBooks: 46,
      revenueOnBooks: 128_000,
      gapNights: [{ date: month.to }, { date: month.from }],
    },
    bookingPace: bookingPaceFixture(month.from),
    pickup: { last7Days: 4, last30Days: 18 },
    stateAssessment: {
      forwardOccupancyState30d: 'building',
      forwardOccupancyState60d: 'building',
      balanceCollectionState: 'attention_needed',
      unpaidBalanceUpcomingTotal: 6500,
      unpaidBalanceUpcomingCount: 2,
    },
    sufficiency: { sampleSize, enough: sampleSize >= 10 },
    publicPage: {
      pageViews: 412,
      uniqueVisitors: 318,
      topReferrers: [
        { referrer: 'Google', count: 180 },
        { referrer: 'Instagram', count: 96 },
        { referrer: 'Facebook', count: 74 },
        { referrer: 'Direct', count: 62 },
      ],
    },
    playbook: [
      ANALYTICS_PLAYBOOK.unpaidBalances,
      ANALYTICS_PLAYBOOK.channelDiversity,
      ANALYTICS_PLAYBOOK.blockedDates,
    ],
    benchmark: options.benchmarkUnavailable
      ? {
          available: false,
          sampleSize: 2,
          medianOccupancyRate: null,
          medianAdr: null,
          occupancyPercentile: null,
          adrPercentile: null,
        }
      : {
          available: true,
          sampleSize: 24,
          medianOccupancyRate: 64,
          medianAdr: 3100,
          occupancyPercentile: 68,
          adrPercentile: 61,
        },
    marketing: {
      trackedVisits: 96,
      attributedRequests: 7,
      channels: [
        { channel: 'instagram', visits: 61, requests: 5 },
        { channel: 'facebook', visits: 35, requests: 2 },
      ],
    },
  };
}

export function buildAiReview() {
  const month = currentManilaMonthRange();
  return {
    id: 'review-analytics-tour',
    generated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    model: 'analytics-e2e',
    headline: 'Rate is holding. Two unpaid balances need attention before the weekend.',
    score: 74,
    score_delta: 4,
    period_start: month.from,
    period_end: month.to,
    payload: {
      strengths: [
        {
          title: 'Rate is holding',
          evidence: 'Avg nightly rate is PHP 3,480, up 4.1% on the prior period.',
        },
        {
          title: 'Fast guest replies',
          evidence: '96% of messages answered within 24 hours.',
        },
        {
          title: 'Two channels carry most bookings',
          evidence: 'Airbnb and Direct brought 13 of 18 bookings this month.',
        },
      ],
      improvements: [
        {
          title: 'Collect the two unpaid balances',
          why: 'Two stays checking in this month still owe PHP 6,500 in total.',
          action: 'Send a balance reminder from Bookings before the guest arrives.',
          deepLink: null,
          articleSlugs: [ANALYTICS_PLAYBOOK.unpaidBalances.slug],
        },
        {
          title: 'Diversify beyond two channels',
          why: 'Airbnb and Direct carry 72% of bookings this month.',
          action: 'Turn on a second OTA and price the open week.',
          deepLink: analyticsTourPaths.pricing,
          articleSlugs: [ANALYTICS_PLAYBOOK.channelDiversity.slug],
        },
      ],
      avoid: [
        {
          title: 'Do not cut the base rate after one soft week',
          why: 'ADR rose while occupancy held at 72%.',
          deepLink: analyticsTourPaths.pricing,
        },
      ],
      metricsSnapshot: {},
    },
  };
}

export type AnalyticsMockOptions = AnalyticsBundleOptions & {
  template?: TeamRbacTemplate;
  freePlan?: boolean;
  /** Review returned by GET /analytics-ai-review. */
  aiReview?: 'present' | 'none';
  /** Force the AI review feature-availability key off (super-admin switch). */
  aiReviewUnavailable?: boolean;
};

export type AnalyticsMockCalls = {
  summary: string[];
  aiReviewGets: number;
  aiReviewPosts: number;
};

export function createAnalyticsCalls(): AnalyticsMockCalls {
  return { summary: [], aiReviewGets: 0, aiReviewPosts: 0 };
}

/**
 * Seeded grants: Full Access gets view + export + AI review; Operations and Read Only get
 * view only. The page hides Export and Analyze on the view-only grants.
 */
function permissionsForAnalytics(template: TeamRbacTemplate): string[] {
  if (template === 'full_access' || template === 'owner') {
    return [
      ...FULL_ACCESS_PERMISSIONS,
      'analytics:view',
      'analytics:export',
      'analytics.aiReview:add',
    ];
  }
  return ['analytics:view'];
}

function propertyAccessWithAnalytics(template: TeamRbacTemplate) {
  return {
    accessKind: 'member' as const,
    permissions: permissionsForAnalytics(template),
    memberId: 'member-analytics-e2e-001',
    propertyId: TEAM_E2E_PROPERTY_ID,
    orgSlug: TEAM_E2E_ORG_SLUG,
    orgName: 'Sample Stays PH',
    propertySlug: TEAM_E2E_PROPERTY_SLUG,
    propertyName: 'Solea Mactan',
    planLimited: false,
  };
}

export async function installAnalyticsMocks(
  page: Page,
  options: AnalyticsMockOptions = {}
): Promise<AnalyticsMockCalls> {
  const calls = createAnalyticsCalls();
  const template = options.template ?? 'full_access';
  await installPropertyTeamRbacMocks(page, template, { freePlan: options.freePlan });

  // Registered last, so it wins over the shared harness handler; everything else falls through.
  await page.route('**/functions/v1/**', async (route: Route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.split('/').pop();
    const method = route.request().method();

    if (endpoint === 'analytics-summary') {
      calls.summary.push(`${url.searchParams.get('from')}..${url.searchParams.get('to')}`);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: buildAnalyticsBundle(options) }),
      });
      return;
    }

    if (endpoint === 'analytics-ai-review') {
      if (method === 'POST') {
        calls.aiReviewPosts += 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { review: buildAiReview(), available: true },
          }),
        });
        return;
      }
      calls.aiReviewGets += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { review: options.aiReview === 'none' ? null : buildAiReview() },
        }),
      });
      return;
    }

    if (endpoint === 'property-access') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: propertyAccessWithAnalytics(template) }),
      });
      return;
    }

    if (endpoint === 'get-feature-availability' && options.aiReviewUnavailable) {
      const now = new Date().toISOString();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            serverNow: now,
            entries: [
              {
                key: 'analytics.ai_review',
                available: false,
                bypassed: false,
                reason: 'maintenance',
                message: 'AI review is paused while we tune it. Your last review stays available.',
                expectedBackAt: null,
                source: 'self',
                showBanner: true,
                updatedAt: now,
              },
            ],
          },
        }),
      });
      return;
    }

    await route.fallback();
  });

  return calls;
}

/** Clear the first-visit cookie banner so it never covers a control (or a recording). */
export async function dismissConsent(page: Page): Promise<void> {
  const essential = page.getByRole('button', { name: 'Essential only' });
  if ((await essential.count()) > 0) {
    await essential
      .first()
      .click({ timeout: 2000 })
      .catch(() => {});
  }
}

/** Land on the page and wait for the KPI strip to render. */
export async function openAnalytics(page: Page, query = ''): Promise<void> {
  await page.goto(analyticsPath(query));
  await dismissConsent(page);
  await expect(page.getByRole('region', { name: 'Key metrics' })).toBeVisible({
    timeout: 25_000,
  });
}

export async function openAnalyticsTab(
  page: Page,
  tab: 'Overview' | 'Trends' | 'Guests' | 'AI review',
  query = ''
): Promise<void> {
  await openAnalytics(page, query);
  await page.getByRole('tab', { name: tab }).click();
}

function readPositiveIntEnv(name: string): number {
  const raw = process.env[name];
  if (!raw) return 0;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** Hold on the current screen so a headed demo is watchable (no-op without the env). */
export async function demoPause(page: Page, multiplier = 1): Promise<void> {
  const ms = readPositiveIntEnv('PLAYWRIGHT_DEMO_PAUSE_MS');
  if (!ms) return;
  await page.waitForTimeout(Math.round(ms * multiplier));
}

/** Step-scroll the admin scrollport so a recording shows the whole page. */
export async function demoScroll(
  page: Page,
  options?: { step?: number; steps?: number; back?: boolean }
): Promise<void> {
  const step = options?.step ?? 320;
  const steps = options?.steps ?? 6;
  await page.evaluate(
    async ({ step: stepSize, steps: count, back }) => {
      const scrollport =
        (document.querySelector('[data-admin-scrollport]') as HTMLElement | null) ??
        (document.querySelector('main') as HTMLElement | null) ??
        (document.scrollingElement as HTMLElement | null) ??
        document.body;
      for (let i = 0; i < count; i += 1) {
        scrollport.scrollBy({ top: stepSize, behavior: 'smooth' });
        await new Promise((resolve) => {
          window.setTimeout(resolve, 420);
        });
      }
      if (back !== false) {
        scrollport.scrollTo({ top: 0, behavior: 'smooth' });
        await new Promise((resolve) => {
          window.setTimeout(resolve, 420);
        });
      }
    },
    { step, steps, back: options?.back }
  );
}
