/**
 * Deterministic org Analytics harness: portfolio summary + org shell.
 *
 * Layers an `analytics-org-summary` fixture over the shared org RBAC mocks so the page
 * renders one property and one parking without a database. `org-access` is overridden so
 * read-only members really lose `org.analytics:export`.
 */

import { expect, type Page, type Route } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  TEAM_E2E_ORG_SLUG,
  type TeamRbacTemplate,
} from '../../team/shared/propertyTeamRbacHarness';

import { currentManilaMonthRange } from './analyticsHarness';

export const orgAnalyticsPaths = {
  analytics: `/org/${TEAM_E2E_ORG_SLUG}/analytics`,
} as const;

export function orgAnalyticsPath(query = ''): string {
  const month = currentManilaMonthRange();
  const base = `${orgAnalyticsPaths.analytics}?from=${month.from}&to=${month.to}`;
  return query ? `${base}&${query}` : base;
}

type Row = Record<string, unknown>;

function propertyRow(overrides: Row = {}): Row {
  return {
    kind: 'property',
    id: 'org-analytics-property-1',
    name: 'Monaco 2604',
    slug: 'kame-home',
    locked: false,
    propertyId: 'org-analytics-property-1',
    propertyName: 'Monaco 2604',
    propertySlug: 'kame-home',
    occupancyRate: 40,
    adr: 3500,
    revpar: 1400,
    grossRevenue: 42_000,
    reservations: 6,
    cancellationRate: 0,
    revenueChangePct: 0,
    forwardOccupancyState30d: 'building',
    forwardOccupancyRate30d: 40,
    balanceCollectionState: 'at_risk',
    unpaidBalanceUpcomingTotal: 16_500,
    unpaidBalanceUpcomingCount: 3,
    occupiedNights: 12,
    periodDays: 30,
    ...overrides,
  };
}

function parkingRow(overrides: Row = {}): Row {
  return {
    kind: 'parking',
    id: 'org-analytics-parking-1',
    name: 'Azure Monaco - Level 2 - Slot 27',
    slug: 'monaco-level-2-slot-27',
    locked: false,
    propertyId: 'org-analytics-parking-1',
    propertyName: 'Azure Monaco - Level 2 - Slot 27',
    propertySlug: 'monaco-level-2-slot-27',
    occupancyRate: 40,
    adr: 700,
    revpar: 280,
    grossRevenue: 4_200,
    reservations: 6,
    cancellationRate: 0,
    revenueChangePct: 500,
    forwardOccupancyState30d: 'building',
    forwardOccupancyRate30d: 40,
    balanceCollectionState: 'clear',
    unpaidBalanceUpcomingTotal: 0,
    unpaidBalanceUpcomingCount: 0,
    occupiedNights: 12,
    periodDays: 30,
    ...overrides,
  };
}

export type OrgAnalyticsMockOptions = {
  template?: TeamRbacTemplate;
  freePlan?: boolean;
  empty?: boolean;
  /** Mark one row underbooked and raise the attention count. */
  attention?: boolean;
  /** Return a plan-locked row instead of the property. */
  lockedRow?: boolean;
};

export function buildOrgAnalyticsSummary(options: OrgAnalyticsMockOptions = {}) {
  const month = currentManilaMonthRange();
  const empty = options.empty ?? false;
  const rows: Row[] = empty
    ? []
    : [
        options.lockedRow
          ? {
              kind: 'property',
              propertyId: 'org-analytics-property-1',
              propertyName: 'Monaco 2604',
              propertySlug: 'kame-home',
              locked: true,
            }
          : propertyRow(
              options.attention
                ? { forwardOccupancyState30d: 'underbooked', forwardOccupancyRate30d: 10 }
                : {}
            ),
        parkingRow(),
      ];

  const attentionCount = empty ? 0 : options.attention ? 1 : 0;

  return {
    period: month,
    priorPeriod: month,
    portfolio: {
      totalRevenue: empty ? 0 : 46_200,
      totalRevenueChangePct: empty ? null : 8.2,
      avgOccupancy: empty ? 0 : 40,
      avgOccupancyChangePts: empty ? null : 16.67,
      totalReservations: empty ? 0 : 12,
      totalReservationsChangePct: empty ? null : 71.43,
      propertyCount: empty ? 0 : 1,
      parkingCount: empty ? 0 : 1,
      listingCount: empty ? 0 : 2,
      attentionCount,
      unpaidBalanceTotal: empty ? 0 : 16_500,
      entitledPropertyCount: empty ? 0 : 1,
    },
    rows,
  };
}

function orgAccessFor(template: TeamRbacTemplate) {
  const canExport = template === 'full_access' || template === 'owner';
  return {
    accessKind: template === 'owner' ? 'owner' : 'member',
    permissions: [
      'org.dashboard:view',
      'org.bookings:view',
      'org.properties:view',
      'org.parkings:view',
      'org.team:view',
      'org.settings:view',
      'org.plans:view',
      'org.analytics:view',
      ...(canExport ? ['org.analytics:export'] : []),
    ],
    memberId: template === 'owner' ? null : 'member-org-analytics-e2e',
    canListAllProperties: true,
    orgId: 'org-team-e2e-001',
    orgSlug: TEAM_E2E_ORG_SLUG,
    orgName: 'Sample Stays PH',
    canManageTeam: canExport,
    canInviteTeam: canExport,
    canCreateProperties: canExport,
    canManageProperties: canExport,
    canCreateParkings: canExport,
    canManageParkings: canExport,
    canEditBasicSettings: canExport,
    canEditSocials: canExport,
    canEditAiPlatform: canExport,
    canEditAiAssistant: canExport,
    canEditSettings: canExport,
    planLimited: false,
  };
}

export type OrgAnalyticsCalls = { summary: string[] };

export async function installOrgAnalyticsMocks(
  page: Page,
  options: OrgAnalyticsMockOptions = {}
): Promise<OrgAnalyticsCalls> {
  const calls: OrgAnalyticsCalls = { summary: [] };
  const template = options.template ?? 'owner';
  await installPropertyTeamRbacMocks(page, template === 'owner' ? 'owner' : template, {
    orgHub: true,
    freePlan: options.freePlan,
  });

  await page.route('**/functions/v1/**', async (route: Route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.split('/').pop();

    if (endpoint === 'analytics-org-summary') {
      calls.summary.push(`${url.searchParams.get('from')}..${url.searchParams.get('to')}`);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: buildOrgAnalyticsSummary(options) }),
      });
      return;
    }

    if (endpoint === 'org-access') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: orgAccessFor(template) }),
      });
      return;
    }

    await route.fallback();
  });

  return calls;
}

export async function openOrgAnalytics(page: Page, query = ''): Promise<void> {
  await page.goto(orgAnalyticsPath(query));
  const essential = page.getByRole('button', { name: 'Essential only' });
  if ((await essential.count()) > 0) {
    await essential
      .first()
      .click({ timeout: 2000 })
      .catch(() => {});
  }
  await expect(page.getByRole('region', { name: 'Portfolio metrics' })).toBeVisible({
    timeout: 25_000,
  });
}
