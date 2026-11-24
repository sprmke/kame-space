import { seedSupabaseAuthSession } from '../../../shared/authSeam';

import type { Page, Route } from '@playwright/test';

/**
 * Mocks for the super admin module tour.
 *
 * Covers the console destinations exercised by `superAdminModuleTour.spec.ts` and the
 * phone shell in `superAdminMobileShell.spec.ts`: the super-admin gate, orgs list +
 * hub, support tickets, audit log, rate limits and platform settings. Fixtures mirror
 * the real `list-*` payloads so a shape change breaks the test instead of the console.
 */

const uuid = (suffix: number) => `5eed0000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;

export const superAdminGate = {
  success: true,
  data: { organizations: [], isSuperAdmin: true },
};

export const superAdminOverview = {
  success: true,
  data: {
    range: '30d',
    generatedAt: '2026-11-20T00:00:00.000Z',
    kpis: {
      organizations: 4,
      hosts: 6,
      properties: 12,
      parkings: 3,
      developments: 2,
      liveSubscriptions: 3,
      trialingSubscriptions: 1,
      mrrPhp: 7197,
      openTickets: 5,
      pendingApprovals: 2,
      undisbursedParkingPayouts: 1,
      aiSpendUsd: 12.4,
    },
    growthSeries: [
      {
        label: 'Oct 2026',
        month: '2026-10',
        newOrgs: 1,
        newSubscriptions: 1,
        cumulativeOrgs: 3,
        cumulativeSubscriptions: 2,
      },
      {
        label: 'Nov 2026',
        month: '2026-11',
        newOrgs: 1,
        newSubscriptions: 1,
        cumulativeOrgs: 4,
        cumulativeSubscriptions: 3,
      },
    ],
    planMix: [
      { code: 'pro', label: 'Business', count: 3 },
      { code: 'growth', label: 'Pro', count: 1 },
    ],
    aiCostByFeature: [{ feature: 'analytics', costUsd: 12.4 }],
    attention: {
      pendingApprovals: 2,
      pendingApprovalsBreakdown: {
        orgVerification: 1,
        listingVerification: 1,
        externalReview: 0,
      },
      openTickets: 5,
      undisbursedParkingPayouts: 1,
      unassignedSubscriptions: 1,
    },
    recent: { organizations: [], subscriptions: [], tickets: [] },
  },
};

export const superAdminOrgRow = {
  id: uuid(1),
  name: 'Kame Space',
  slug: 'kame-homes',
  createdAt: '2026-11-08T05:40:57.297788+00:00',
  propertyCount: 1,
  parkingCount: 1,
  planCode: 'pro',
  planName: 'Business',
  subscriptionStatus: 'active',
  mrrPhp: 1799,
};

export const superAdminOrgsSummary = {
  total: 1,
  subscribed: 1,
  unsubscribed: 0,
  properties: 1,
  parkings: 1,
};

export const superAdminOrg = {
  id: uuid(1),
  name: 'Kame Space',
  slug: 'kame-homes',
  createdAt: '2026-11-08T05:40:57.297788+00:00',
  owner: { name: 'Dana Reyes', email: 'dana@example.com', avatarUrl: null },
  counts: { properties: 1, parkings: 1, members: 5 },
  plan: {
    code: 'pro',
    name: 'Business',
    status: 'active',
    mrrPhp: 1799,
    currentPeriodEnd: '2026-12-18T00:00:00+00:00',
  },
  verification: { baseStatus: 'approved', enhancedStatus: 'approved' },
  openWork: { pendingApprovals: 0, openTickets: 3 },
};

const supportTickets = [
  {
    id: uuid(101),
    organization_id: uuid(1),
    property_id: null,
    parking_id: null,
    submitted_by_user_id: uuid(9),
    submitted_by_name: 'Demo Host',
    submitted_by_email: 'host.demo@example.com',
    category: 'bug_report',
    subject: 'Calendar shows a blocked date twice',
    status: 'open',
    priority: 'high',
    category_fields: { area: 'pricing', steps: 'Open Pricing calendar, then refresh' },
    created_at: '2026-11-19T19:21:15.531787+00:00',
    updated_at: '2026-11-19T19:21:15.531787+00:00',
    channel: 'host',
    organizationName: 'Kame Space',
    organizationSlug: 'kame-homes',
  },
  {
    id: uuid(102),
    organization_id: uuid(1),
    property_id: null,
    parking_id: null,
    submitted_by_user_id: uuid(9),
    submitted_by_name: 'Demo Host',
    submitted_by_email: 'host.demo@example.com',
    category: 'feature_suggestion',
    subject: 'Add a weekly maintenance digest',
    status: 'in_progress',
    priority: 'medium',
    category_fields: { area: 'maintenance' },
    created_at: '2026-11-19T19:21:15.531787+00:00',
    updated_at: '2026-11-19T19:21:15.531787+00:00',
    channel: 'host',
    organizationName: 'Kame Space',
    organizationSlug: 'kame-homes',
  },
];

export const supportTicketsSummary = { total: 2, open: 1, inProgress: 1, resolved: 0 };

const auditEvents = [
  {
    id: uuid(201),
    actorEmail: 'owner@example.com',
    action: 'pricing_plan_updated',
    targetType: 'organization',
    targetId: uuid(1),
    summary: 'Changed the org plan to Business',
    metadata: { seed: true, index: 0 },
    createdAt: '2026-11-19T19:21:40.938633+00:00',
  },
  {
    id: uuid(202),
    actorEmail: 'owner@example.com',
    action: 'help_center.faq_updated',
    targetType: 'help_center_faq',
    targetId: uuid(203),
    summary: 'Updated Help Center FAQ',
    metadata: { fields: ['is_published'] },
    createdAt: '2026-11-18T12:56:03.70725+00:00',
  },
];

export const platformSettingsFixture = {
  defaultPlanCode: 'free',
  signupsEnabled: true,
  maintenanceMode: false,
  maintenanceMessage: '',
  supportEmail: 'support@example.com',
  legalTermsUrl: 'https://example.com/terms',
  legalPrivacyUrl: 'https://example.com/privacy',
  publicRateLimitPerMin: 600,
  authenticatedRateLimitEnforce: false,
  authenticatedRateLimitPerMin: 600,
  hostRewardEnabled: false,
  hostRewardPlanCode: 'growth',
  hostRewardDurationDays: 30,
  hostRewardTrigger: 'recommended_verification_approved',
  hostRewardCampaignStart: null,
  hostRewardCampaignEnd: null,
  hostRewardMaxPerOrg: 1,
  hostRewardApplyToPaidOrg: 'skip',
  updatedAt: '2026-11-19T19:21:40.938633+00:00',
};

/** Hub sections below the overview load on mount; empty successes keep them quiet. */
const hubSectionStubs: Record<string, unknown> = {
  'list-properties': { properties: [], total: 0 },
  'list-parkings': { parkings: [], total: 0 },
  'pricing-plans': { plans: [], total: 0 },
  'ai-platform-credit-wallet': {
    organizationId: uuid(1),
    organizationName: 'Kame Space',
    balanceCredits: 0,
    ledger: [],
  },
  'ai-platform-generation-overrides': {
    organizationId: uuid(1),
    organizationName: 'Kame Space',
    properties: [],
  },
  'super-admin-ai-limits': { rows: [] },
};

/** `org-subscriptions-admin` answers three shapes depending on its query. */
const orgBillingDetail = {
  subscription: null,
  recentEvents: [],
  transactions: [],
  ledger: [],
  ledgerBalancePhp: 0,
};

export type SuperAdminMocks = {
  /** Where `PUT platform-settings` lands; the test asserts on the body. */
  onSettingsSave?: (body: Record<string, unknown>) => void;
  /** Where `POST update-support-ticket-status` lands. */
  onTicketStatus?: (body: Record<string, unknown>) => void;
  /** Where `POST super-admin-rate-limits/block` lands. */
  onBlockIdentity?: (body: Record<string, unknown>) => void;
};

async function fulfill(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

/**
 * Super-admin session plus every console endpoint the tour touches.
 * Register before `page.goto`.
 */
export async function installSuperAdminConsoleMocks(page: Page, mocks: SuperAdminMocks = {}) {
  await seedSupabaseAuthSession(page, 'host');

  await page.route('**/functions/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const endpoint = url.pathname.split('/').filter(Boolean).pop() ?? '';
    const method = request.method();

    if (method !== 'GET' && method !== 'OPTIONS') {
      const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
      if (endpoint === 'platform-settings') {
        mocks.onSettingsSave?.(body ?? {});
        await fulfill(route, {
          success: true,
          data: { settings: { ...platformSettingsFixture, ...(body ?? {}) } },
        });
        return;
      }
      if (endpoint === 'update-support-ticket-status') {
        mocks.onTicketStatus?.(body ?? {});
        const ticket = supportTickets.find((row) => row.id === body?.ticketId) ?? supportTickets[0];
        await fulfill(route, {
          success: true,
          data: { ticket: { ...ticket, status: body?.status ?? ticket.status } },
        });
        return;
      }
      if (endpoint === 'super-admin-rate-limits') {
        mocks.onBlockIdentity?.(body ?? {});
        await fulfill(route, {
          success: true,
          data: {
            block: {
              id: uuid(301),
              identity: body?.identity,
              reason: body?.reason ?? null,
              blockedBy: 'owner@example.com',
              blockedAt: '2026-11-20T10:00:00+00:00',
              expiresAt: null,
            },
          },
        });
        return;
      }
      await fulfill(route, { success: true, data: {} });
      return;
    }

    switch (endpoint) {
      case 'list-organizations':
        await fulfill(route, superAdminGate);
        return;
      case 'super-admin-overview':
        await fulfill(route, superAdminOverview);
        return;
      case 'list-organizations-admin':
        await fulfill(
          route,
          url.searchParams.get('summary') === 'true'
            ? { success: true, data: { summary: superAdminOrgsSummary } }
            : {
                success: true,
                data: {
                  organizations: [superAdminOrgRow],
                  total: 1,
                  page: 1,
                  limit: 25,
                },
              }
        );
        return;
      case 'get-organization-admin':
        await fulfill(route, { success: true, data: { organization: superAdminOrg } });
        return;
      case 'list-support-tickets-admin':
        if (url.searchParams.get('summary') === 'true') {
          await fulfill(route, { success: true, data: { summary: supportTicketsSummary } });
          return;
        }
        await fulfill(route, {
          success: true,
          data: { tickets: supportTickets, total: supportTickets.length },
        });
        return;
      case 'get-support-ticket-admin': {
        const id = url.searchParams.get('ticket_id');
        const ticket = supportTickets.find((row) => row.id === id) ?? supportTickets[0];
        await fulfill(route, {
          success: true,
          data: {
            ticket,
            messages: [
              {
                id: uuid(401),
                ticket_id: ticket.id,
                sender_type: 'host',
                sender_user_id: uuid(9),
                sender_name: 'Demo Host',
                body: 'Blocked on Nov 20 and Nov 27.',
                attachments: [],
                created_at: '2026-11-19T19:21:15.531787+00:00',
              },
            ],
          },
        });
        return;
      }
      case 'list-super-admin-audit':
        if (url.searchParams.get('facets') === 'true') {
          await fulfill(route, {
            success: true,
            data: {
              actions: ['pricing_plan_updated', 'help_center.faq_updated'],
              targetTypes: ['organization', 'help_center_faq'],
            },
          });
          return;
        }
        await fulfill(route, {
          success: true,
          data: { events: auditEvents, total: auditEvents.length, page: 1, limit: 25 },
        });
        return;
      case 'super-admin-rate-limits':
        await fulfill(route, {
          success: true,
          data: { enforceEnabled: false, limit: 600, activeCounters: [], blocks: [] },
        });
        return;
      case 'platform-settings':
        await fulfill(route, {
          success: true,
          data: { settings: platformSettingsFixture },
        });
        return;
      case 'list-super-admin-approvals':
        await fulfill(route, {
          success: true,
          data: url.searchParams.get('summary') === 'true'
            ? {
                summary: {
                  total: 2,
                  pending: 2,
                  orgVerifications: 1,
                  listingVerifications: 1,
                  reviews: 0,
                },
              }
            : { approvals: [], total: 0 },
        });
        return;
      case 'org-subscriptions-admin':
        if (url.searchParams.get('organizationId')) {
          await fulfill(route, { success: true, data: orgBillingDetail });
          return;
        }
        await fulfill(route, { success: true, data: { organizations: [], total: 0 } });
        return;
      default: {
        const stub = hubSectionStubs[endpoint];
        if (stub) {
          await fulfill(route, { success: true, data: stub });
          return;
        }
        await route.continue();
      }
    }
  });
}
