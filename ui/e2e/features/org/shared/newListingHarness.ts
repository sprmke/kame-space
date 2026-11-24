/**
 * Fixtures for the New listing flow: org inventory -> New listing dialog -> create.
 *
 * Layers the onboarding endpoints on top of the team RBAC harness (organizations, org-access,
 * plan, entitlements). Only the four endpoints this flow owns are overridden:
 * check-property-name, check-tower-unit, preview-org-plan-change, create-property,
 * create-parking. Everything else falls through.
 */

import { expect, type Page } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  TEAM_E2E_ORG_SLUG,
} from '../../team/shared/propertyTeamRbacHarness';

export const NEW_LISTING_ORG_ID = 'org-team-e2e-001';

export const NEW_LISTING_PATHS = {
  properties: `/org/${TEAM_E2E_ORG_SLUG}/properties`,
  parkings: `/org/${TEAM_E2E_ORG_SLUG}/parkings`,
} as const;

/** What the billing preview says about the new property. `error` simulates a failed quote. */
export type NewListingBilling = 'covered' | 'free' | 'overdue' | 'error';

export type NewListingTemplate = 'full_access' | 'owner' | 'read_only';

export type NewListingState = {
  createdProperties: Array<Record<string, unknown>>;
  createdParkings: Array<Record<string, unknown>>;
  previewCalls: number;
  /** Flip to false to let a Retry succeed after a failed quote. */
  previewShouldFail: boolean;
};

export type NewListingOptions = {
  template?: NewListingTemplate;
  billing?: NewListingBilling;
  /** Remove `org:properties:create` and `org:parkings:create` from org-access. */
  canCreate?: boolean;
  /** Org inventory with no properties (empty state + Add CTA). */
  empty?: boolean;
  /** The display name check reports the name as taken. */
  propertyNameTaken?: boolean;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function propertyPayload(body: Record<string, unknown>) {
  const name = String(body.name ?? 'Monaco 1204');
  return {
    id: `property-new-${slugify(name)}`,
    organizationId: NEW_LISTING_ORG_ID,
    name,
    slug: slugify(name),
    type: 'condo',
    status: 'ACTIVE',
    address: null,
    towerAndUnit: null,
    tower: String(body.tower ?? 'Monaco'),
    unitNumber: String(body.unitNumber ?? '1204'),
    residenceName: String(body.residenceName ?? 'Azure North Residences'),
    maxGuests: 4,
    settings: {},
    createdAt: '2026-11-24T00:00:00.000Z',
    updatedAt: '2026-11-24T00:00:00.000Z',
  };
}

function parkingPayload(body: Record<string, unknown>) {
  const name = String(body.name ?? 'Monaco Level 2 Slot 27');
  return {
    id: `parking-new-${slugify(name)}`,
    organizationId: NEW_LISTING_ORG_ID,
    name,
    slug: slugify(name),
    tower: String(body.tower ?? 'Monaco'),
    level: String(body.level ?? 'Level 2'),
    slotLabel: String(body.slotLabel ?? '27'),
    parkingType: String(body.parkingType ?? 'covered'),
    residenceName: String(body.residenceName ?? 'Azure North Residences'),
    ratePerNight: null,
    status: 'ACTIVE',
    settings: {},
    createdAt: '2026-11-24T00:00:00.000Z',
    updatedAt: '2026-11-24T00:00:00.000Z',
  };
}

function billingPreview(billing: NewListingBilling) {
  if (billing === 'free') {
    return {
      kind: 'add_property',
      status: 'free',
      planName: null,
      propertyCount: 1,
      addsMonthlyPhp: 0,
      trueUpPhp: 0,
      nextRenewalPhp: 0,
      renewsAt: null,
    };
  }
  if (billing === 'overdue') {
    return {
      kind: 'add_property',
      status: 'overdue',
      planName: 'Business',
      propertyCount: 1,
      addsMonthlyPhp: 399,
      trueUpPhp: 266,
      nextRenewalPhp: 798,
      renewsAt: '2026-12-01T00:00:00.000Z',
    };
  }
  return {
    kind: 'add_property',
    status: 'covered',
    planName: 'Business',
    propertyCount: 1,
    addsMonthlyPhp: 399,
    trueUpPhp: 266,
    nextRenewalPhp: 798,
    renewsAt: '2026-12-01T00:00:00.000Z',
  };
}

export async function installNewListingMocks(
  page: Page,
  opts: NewListingOptions = {}
): Promise<NewListingState> {
  const template = opts.template ?? 'full_access';
  const billing = opts.billing ?? 'covered';
  const canCreate = opts.canCreate ?? template !== 'read_only';
  const state: NewListingState = {
    createdProperties: [],
    createdParkings: [],
    previewCalls: 0,
    previewShouldFail: billing === 'error',
  };

  await installPropertyTeamRbacMocks(page, template, {
    orgHub: true,
    freePlan: billing === 'free',
  });

  // Registered after the team harness, so these win for the onboarding endpoints.
  await page.route('**/functions/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.split('/').pop();
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    switch (endpoint) {
      case 'org-access': {
        const permissions = [
          'org.dashboard:view',
          'org.bookings:view',
          'org.properties:view',
          'org.parkings:view',
          'org.team:view',
          'org.plans:view',
        ];
        if (canCreate) permissions.push('org.properties:create', 'org.parkings:create');
        await json({
          success: true,
          data: {
            accessKind: 'owner',
            permissions,
            memberId: null,
            canListAllProperties: true,
            orgId: NEW_LISTING_ORG_ID,
            orgSlug: TEAM_E2E_ORG_SLUG,
            orgName: 'Sample Stays PH',
            canManageTeam: true,
            canInviteTeam: true,
            canCreateProperties: canCreate,
            canManageProperties: true,
            canCreateParkings: canCreate,
            canManageParkings: true,
            canEditBasicSettings: true,
            canEditSocials: true,
            canEditAiPlatform: true,
            canEditAiAssistant: true,
            canEditSettings: true,
            planLimited: false,
          },
        });
        return;
      }

      case 'list-properties': {
        if (!opts.empty) {
          await route.fallback();
          return;
        }
        await json({ success: true, data: { properties: [] } });
        return;
      }

      case 'check-property-name': {
        await json({
          success: true,
          data: opts.propertyNameTaken
            ? { available: false, message: 'A property with this name already exists.' }
            : { available: true, message: null },
        });
        return;
      }

      case 'check-tower-unit': {
        await json({
          success: true,
          data: { available: true, hasActiveListing: false, message: null, conflict: null },
        });
        return;
      }

      case 'preview-org-plan-change': {
        state.previewCalls += 1;
        if (state.previewShouldFail) {
          await json({ success: false, error: 'Could not load the billing preview' }, 500);
          return;
        }
        await json({
          success: true,
          data: billingPreview(billing === 'error' ? 'covered' : billing),
        });
        return;
      }

      case 'create-property': {
        const body = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
        state.createdProperties.push(body);
        await json({
          success: true,
          data: {
            property: propertyPayload(body),
            billing:
              billing === 'free'
                ? { status: 'free' }
                : billing === 'overdue'
                  ? { status: 'overdue' }
                  : { status: 'covered', trueUpPhp: 266, nextRenewalPhp: 798 },
          },
        });
        return;
      }

      case 'create-parking': {
        const body = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
        state.createdParkings.push(body);
        await json({ success: true, data: { parking: parkingPayload(body) } });
        return;
      }

      default:
        await route.fallback();
    }
  });

  return state;
}

/** Opens the New listing dialog, desktop or phone, with one or several hero actions. */
export async function openNewListingDialog(page: Page, kind: 'property' | 'parking' = 'property') {
  const label = kind === 'property' ? 'Add property' : 'Add parking';
  const direct = page.getByRole('button', { name: label });
  const menu = page.getByLabel(kind === 'property' ? 'Property actions' : 'Parking actions');

  // Hero actions only render after org-access settles; wait for either shape before deciding.
  await expect(direct.first().or(menu).first()).toBeVisible({ timeout: 15_000 });
  if (
    await direct
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    await direct.first().click();
    return;
  }
  await menu.click();
  await page.getByRole('option', { name: label }).click();
}
