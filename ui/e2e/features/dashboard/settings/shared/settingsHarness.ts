import {
  createParkingFlowState,
  installParkingFlowMocks,
} from '../../../parking/shared/parkingFlowHarness';
import {
  TEAM_E2E_ORG_SLUG,
  TEAM_E2E_PROPERTY_ID,
  TEAM_E2E_PROPERTY_SLUG,
  installPropertyTeamRbacMocks,
  teamRbacPaths,
} from '../../../team/shared/propertyTeamRbacHarness';

import type { Page, Route } from '@playwright/test';

const SETTINGS_ORG_ID = 'org-team-e2e-001';

/** Every settings leaf, so a "full access" run can actually save every section. */
export const SETTINGS_EDIT_LEAVES = [
  'settings.basicInfo:edit',
  'settings.media:edit',
  'settings.propertyDetails:edit',
  'settings.amenities:edit',
  'settings.houseRules:edit',
  'settings.guestForm:edit',
  'settings.cancellationPolicy:edit',
  'settings.location:edit',
  'settings.socials:edit',
  'settings.payment:edit',
  'settings.buildingForms:edit',
  'settings.emailAutomations:edit',
  'settings.listingStatus:edit',
] as const;

/**
 * Settings surfaces harness.
 *
 * The three settings pages (org, property, parking) share the same shell and are
 * fully data-driven, so the review needs one deterministic fixture set per scope:
 *
 * - org:     `/org/:orgSlug/settings`      — profile, socials, superhost, AI, activity, danger
 * - property `/org/:orgSlug/property/:propertySlug/settings`
 *                                          — 19 nav sections, incl. payment OTP
 * - parking `/org/:orgSlug/parking/:parkingSlug/settings`
 *
 * The org + property pages reuse the shared property-team RBAC mocks (already the
 * canonical mocked Supabase surface for this app). Parking reuses the parking flow
 * harness, which owns its own session and routes.
 */

export const SETTINGS_ORG_SLUG = TEAM_E2E_ORG_SLUG;
export const SETTINGS_PROPERTY_SLUG = TEAM_E2E_PROPERTY_SLUG;
export const SETTINGS_PARKING_SLUG = 'slot-12a';

export const settingsPaths = {
  org: `/org/${SETTINGS_ORG_SLUG}/settings`,
  property: teamRbacPaths.settings,
  parking: `/org/${SETTINGS_ORG_SLUG}/parking/${SETTINGS_PARKING_SLUG}/settings`,
} as const;

export const propertySettingsSections = [
  { id: 'section-basic', label: 'Basic Information' },
  { id: 'section-details', label: 'Property Details' },
  { id: 'section-media', label: 'Photos & Videos' },
  { id: 'section-amenities', label: 'Amenities' },
  { id: 'section-house-rules', label: 'House Rules' },
  { id: 'section-cancellation', label: 'Cancellation' },
  { id: 'section-location', label: 'Location' },
  { id: 'section-branding', label: 'Socials' },
  { id: 'section-search', label: 'Search preview' },
  { id: 'section-guest-form', label: 'Guest Form' },
  { id: 'section-guest-experience', label: 'Guest experience' },
  { id: 'section-guest-rewards', label: 'Reviews & vouchers' },
  { id: 'section-payment', label: 'Payment' },
  { id: 'section-building-forms', label: 'Building Forms' },
  { id: 'section-email-automations', label: 'Email Automations' },
  { id: 'section-integrations', label: 'Integrations' },
  { id: 'section-activity', label: 'Activity' },
  { id: 'section-danger', label: 'Listing status' },
] as const;

export const orgSettingsSections = [
  { id: 'section-basic', label: 'Basic information' },
  { id: 'section-branding', label: 'Socials' },
  { id: 'section-superhost', label: 'Superhost' },
  { id: 'section-ai', label: 'AI' },
  { id: 'section-activity', label: 'Activity' },
  { id: 'section-danger', label: 'Danger zone' },
] as const;

export const parkingSettingsSections = [
  { id: 'section-basic', label: 'Basic Information' },
  { id: 'section-media', label: 'Photos' },
  { id: 'section-details', label: 'Parking Details' },
  { id: 'section-features', label: 'Amenities' },
  { id: 'section-location', label: 'Location' },
  { id: 'section-automations', label: 'Automations' },
  { id: 'section-integrations', label: 'Integrations' },
  { id: 'section-activity', label: 'Activity' },
  { id: 'section-danger', label: 'Danger Zone' },
] as const;

export type SettingsScope = 'org' | 'property' | 'parking';

/** Installs the deterministic fixture set for one settings scope. */
export async function installSettingsMocks(
  page: Page,
  scope: SettingsScope,
  options?: {
    freePlan?: boolean;
    multiProperty?: boolean;
    /** Leave the listing incomplete (missing tower, no amenities) for empty-state review. */
    incompleteListing?: boolean;
    /** Seed an uploaded organization logo (org save is blocked without one). */
    orgLogoUploaded?: boolean;
    /** Property/org team template. Defaults to full access. */
    permissions?: 'full_access' | 'operations' | 'read_only';
  }
): Promise<void> {
  if (scope === 'parking') {
    await installParkingFlowMocks(page, createParkingFlowState());
    await page.route('**/functions/v1/update-parking*', async (route) => {
      await fulfillJson(route, { success: true, data: { parking: { id: 'parking-e2e-001' } } });
    });
    return;
  }

  await installPropertyTeamRbacMocks(
    page,
    scope === 'org' ? 'owner' : (options?.permissions ?? 'full_access'),
    {
      orgHub: scope === 'org',
      multiProperty: options?.multiProperty ?? true,
      freePlan: options?.freePlan ?? false,
      orgLogoUploaded: options?.orgLogoUploaded ?? scope === 'org',
      extraPermissions:
        options?.permissions && options.permissions !== 'full_access'
          ? undefined
          : [...SETTINGS_EDIT_LEAVES],
      /*
       * The shared team fixture names a residence the settings form does not know, so the
       * page drops the tower and flags a required field the host cannot edit. Settings
       * specs use a real residence/tower pair unless the test is reviewing that empty state.
       */
      propertyListing: options?.incompleteListing
        ? undefined
        : {
            type: 'condo',
            residenceName: 'Azure North Residences',
            tower: 'Monaco',
            unitNumber: '1204',
            maxGuests: 4,
          },
    }
  );

  await installSettingsSaveMocks(page);
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

/**
 * Save-path mocks the shared RBAC harness leaves on its `{ success: true, data: {} }`
 * fallback. Without these, `update-property` / `update-organization` resolve to an
 * empty object and the mutation's `onSuccess` throws on a missing record.
 */
async function installSettingsSaveMocks(page: Page): Promise<void> {
  await page.route('**/functions/v1/check-property-name*', async (route) => {
    await fulfillJson(route, { success: true, available: true, message: null });
  });

  await page.route('**/functions/v1/setup-guide-state*', async (route) => {
    await fulfillJson(route, {
      success: true,
      setupGuide: {
        version: 1,
        dismissedAt: null,
        completedAt: null,
        lastStepId: null,
        skippedSteps: [],
        reviewedSteps: [],
      },
    });
  });

  await page.route('**/functions/v1/list-activity-log*', async (route) => {
    await fulfillJson(route, { success: true, data: { entries: [], nextCursor: null } });
  });

  await page.route('**/functions/v1/update-organization*', async (route) => {
    const body = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
    await fulfillJson(route, {
      success: true,
      data: {
        organization: {
          id: SETTINGS_ORG_ID,
          name: 'Sample Stays PH',
          slug: SETTINGS_ORG_SLUG,
          description: null,
          logoUrl: null,
          settings: {},
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-11-23T00:00:00.000Z',
          ...body,
        },
      },
    });
  });

  await page.route('**/functions/v1/update-property*', async (route) => {
    const body = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
    const { propertyId: _propertyId, ...patch } = body;
    await fulfillJson(route, {
      success: true,
      data: {
        property: {
          id: TEAM_E2E_PROPERTY_ID,
          organizationId: SETTINGS_ORG_ID,
          name: 'Solea Mactan',
          slug: SETTINGS_PROPERTY_SLUG,
          type: 'condo',
          status: 'ACTIVE',
          address: 'Mactan',
          towerAndUnit: null,
          tower: 'Monaco',
          unitNumber: '1204',
          residenceName: 'Azure North Residences',
          maxGuests: 4,
          settings: {},
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-11-23T00:00:00.000Z',
          ...patch,
        },
      },
    });
  });

  await page.route('**/functions/v1/app-settings*', async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.fallback();
      return;
    }
    const body = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
    await fulfillJson(route, { success: true, data: { ...body, updatedAt: null } });
  });
}

/** Holds the current screen so a headed tour is watchable. No-op unless the demo env is set. */
export async function demoPause(page: Page, multiplier = 1): Promise<void> {
  const raw = process.env.PLAYWRIGHT_DEMO_PAUSE_MS;
  const ms = raw ? Number.parseInt(raw, 10) : 0;
  if (!ms || !Number.isFinite(ms)) return;
  await page.waitForTimeout(Math.round(ms * multiplier));
}

/** Scrolls a section into view and holds, so a recording shows each card. */
export async function demoSection(page: Page, sectionId: string): Promise<void> {
  const target = page.locator(`#${sectionId}`);
  if ((await target.count()) === 0) return;
  await target.first().scrollIntoViewIfNeeded();
  await demoPause(page, 0.6);
}

/** True when the current viewport is the compact (phone/tablet) admin shell. */
export function isCompactShell(page: Page): boolean {
  const width = page.viewportSize()?.width ?? 1440;
  return width < 1024;
}
