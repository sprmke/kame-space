import { expect, test } from '@playwright/test';

import { installPropertyTeamRbacMocks, teamRbacPaths } from '../team/shared/propertyTeamRbacHarness';

import { mockEdgeFunctions } from '../../shared/interceptEdge';

/**
 * v3 admin phone shell (@ci): five tabs, no More, Work / You reachable.
 */
test.describe('Admin native shell @ci', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('property phone shows Today Bookings Inbox Work You', async ({ page }) => {
    await mockEdgeFunctions(page);
    await installPropertyTeamRbacMocks(page);

    await page.goto(teamRbacPaths.dashboard);
    await expect(page.getByRole('navigation', { name: 'Admin' })).toBeVisible({ timeout: 30_000 });

    const tabBar = page.getByRole('navigation', { name: 'Admin' });
    await expect(tabBar.getByRole('listitem', { name: 'Today' })).toBeVisible();
    await expect(tabBar.getByRole('listitem', { name: 'Bookings' })).toBeVisible();
    await expect(tabBar.getByRole('listitem', { name: 'Inbox' })).toBeVisible();
    await expect(tabBar.getByRole('listitem', { name: 'Work' })).toBeVisible();
    await expect(tabBar.getByRole('listitem', { name: 'You' })).toBeVisible();
    await expect(tabBar.getByRole('listitem', { name: 'More' })).toHaveCount(0);

    await tabBar.getByRole('listitem', { name: 'Work' }).click();
    await expect(page.getByRole('heading', { name: 'Work' })).toBeVisible({ timeout: 15_000 });

    await tabBar.getByRole('listitem', { name: 'You' }).click();
    await expect(page.getByRole('heading', { name: 'You' })).toBeVisible({ timeout: 15_000 });
  });
});
