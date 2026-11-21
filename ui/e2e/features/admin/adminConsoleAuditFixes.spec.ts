import { expect, test } from '@playwright/test';

import { seedSupabaseAuthSession } from '../../shared/authSeam';
import { mockEdgeFunctions } from '../../shared/interceptEdge';
import {
  expectNoPageHorizontalOverflow,
  expectNoUnnamedInteractiveControls,
} from '../../shared/layoutAssertions';

const superAdminOrganizations = {
  success: true,
  data: { organizations: [], isSuperAdmin: true },
};

const auditEvent = {
  id: 'audit-001',
  actorEmail: 'super@example.com',
  action: 'pricing_plan_updated',
  targetType: 'organization',
  targetId: 'org-001',
  summary: 'Changed the org plan to Business',
  metadata: { seed: true, index: 0 },
  createdAt: '2026-11-20T19:21:40+00',
};

async function mockAudit(page: Parameters<typeof mockEdgeFunctions>[0]) {
  await mockEdgeFunctions(page, [
    { name: 'list-organizations', body: superAdminOrganizations },
    {
      name: 'list-super-admin-audit',
      handler: async (route) => {
        const facets = new URL(route.request().url()).searchParams.get('facets') === 'true';
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: facets
              ? { actions: ['pricing_plan_updated'], targetTypes: ['organization'] }
              : { events: [auditEvent], total: 1, page: 1, limit: 25 },
          }),
        });
      },
    },
  ]);
}

test.describe('@smoke super admin console fixes', () => {
  test('command palette lists console pages and navigates to Audit log', async ({ page }) => {
    await seedSupabaseAuthSession(page, 'host');
    await mockAudit(page);
    await page.goto('/admin/unknown-route');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible({
      timeout: 20_000,
    });

    await page.keyboard.press('Meta+k');
    await page.keyboard.type('audit');
    const option = page.getByRole('option', { name: /Audit log/i }).first();
    await expect(option).toBeVisible();
    await option.click();

    await expect(page.getByRole('heading', { name: 'Audit log' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page).toHaveURL(/\/admin\/audit$/);
  });

  test('unknown /admin route stays inside the console shell', async ({ page }) => {
    await seedSupabaseAuthSession(page, 'host');
    await mockEdgeFunctions(page, [{ name: 'list-organizations', body: superAdminOrganizations }]);
    await page.goto('/admin/does-not-exist');

    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible({
      timeout: 20_000,
    });
    // Desktop keeps the sidebar; the phone and tablet shells expose the same
    // destinations through the bottom bar instead.
    const isCompact = (page.viewportSize()?.width ?? 1280) < 1024;
    const shellNav = page.locator(
      `nav[aria-label="${isCompact ? 'Admin' : 'Main menu'}"]`
    );
    await expect(shellNav).toBeVisible();
    await expectNoPageHorizontalOverflow(page);
    await expectNoUnnamedInteractiveControls(page);
  });

  test('failed capability call offers Retry instead of Access restricted', async ({ page }) => {
    await seedSupabaseAuthSession(page, 'host');
    await mockEdgeFunctions(page, [
      {
        name: 'list-organizations',
        status: 500,
        body: { success: false, error: 'boom' },
      },
    ]);
    await page.goto('/admin');

    await expect(page.getByRole('heading', { name: 'Could not check access' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
    await expect(page.getByText('Access restricted')).toHaveCount(0);
  });

  test('approval dates render the short-offset timestamp', async ({ page }) => {
    await seedSupabaseAuthSession(page, 'host');
    await mockEdgeFunctions(page, [
      { name: 'list-organizations', body: superAdminOrganizations },
      {
        name: 'list-super-admin-approvals',
        handler: async (route) => {
          const isSummary = new URL(route.request().url()).searchParams.get('summary') === 'true';
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: isSummary
                ? {
                    summary: {
                      total: 1,
                      pending: 1,
                      orgVerifications: 1,
                      listingVerifications: 0,
                      reviews: 0,
                    },
                  }
                : {
                    approvals: [
                      {
                        type: 'org_verification',
                        organizationId: 'org-001',
                        organizationName: 'Offset Timestamp Co',
                        organizationSlug: 'offset-timestamp-co',
                        hostModes: ['property'],
                        ownerName: 'Offset Owner',
                        ownerEmail: 'offset@example.com',
                        baseStatus: 'pending',
                        baseSubmittedAt: '2026-11-16T19:21:40+00',
                        baseRejectionReason: null,
                        baseRejectionKind: null,
                        enhancedStatus: 'none',
                        enhancedSubmittedAt: null,
                        createdAt: '2026-11-16T19:21:40+00',
                        unitConflicts: [],
                        hasActiveUnitConflict: false,
                        propertyConsiderationStatus: 'none',
                        parkingConsiderationStatus: 'none',
                        hasPendingConsideration: false,
                        propertyAccessLocked: false,
                        parkingAccessLocked: false,
                      },
                    ],
                    total: 1,
                  },
            }),
          });
        },
      },
    ]);

    await page.goto('/admin/approvals');
    await expect(page.getByText('Offset Timestamp Co')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Invalid Date')).toHaveCount(0);
    await expect(page.getByText('Nov 17, 2026').first()).toBeVisible();
  });

  test('audit log exposes filters and expands metadata', async ({ page }) => {
    await seedSupabaseAuthSession(page, 'host');
    await mockAudit(page);
    await page.goto('/admin/audit');

    await expect(page.getByRole('heading', { name: 'Audit log' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('combobox', { name: 'Filter by action' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Filter by target type' })).toBeVisible();

    await page.getByRole('button', { name: 'Details' }).first().click();
    await expect(page.getByText('Metadata')).toBeVisible();
    await expect(page.getByText('"seed": true')).toBeVisible();
  });

  test('property filters fit a 390px phone', async ({ page }) => {
    await seedSupabaseAuthSession(page, 'host');
    await mockEdgeFunctions(page, [
      { name: 'list-organizations', body: superAdminOrganizations },
      {
        name: 'list-platform-properties',
        body: {
          success: true,
          data: { properties: [], total: 0, page: 1, limit: 25 },
        },
      },
      {
        name: 'list-developments',
        body: { success: true, data: { developments: [], total: 0 } },
      },
    ]);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin/properties');
    await expect(page.getByRole('heading', { name: 'Properties' })).toBeVisible({
      timeout: 20_000,
    });

    await expect(page.getByRole('combobox', { name: 'Filter by status' })).toBeVisible();
    const boxes = await page.locator('main [role="combobox"]').evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().right)
    );
    expect(boxes.length).toBeGreaterThan(0);
    for (const right of boxes) expect(right).toBeLessThanOrEqual(390 + 1);
    await expectNoPageHorizontalOverflow(page);
  });
});
