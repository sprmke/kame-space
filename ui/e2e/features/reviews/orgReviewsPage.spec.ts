import { expect, test } from '@playwright/test';

import { installPropertyTeamRbacMocks, orgHubPaths } from '../team/shared/propertyTeamRbacHarness';

test.describe('@ci org reviews page', () => {
  test('owner can open the org rollup and filter by property', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', { orgHub: true });
    await page.goto(orgHubPaths.reviews);
    await expect(page.getByRole('heading', { name: 'Reviews', level: 1 })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('tab', { name: /From guests/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /By property/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /All listings/ })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Listing' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Solea Mactan' })).toBeVisible();
  });

  test('legacy By property tab URL lands on From guests', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', { orgHub: true });
    await page.goto(`${orgHubPaths.reviews}?tab=properties`);
    await expect(page.getByRole('heading', { name: 'Reviews', level: 1 })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('tab', { name: /From guests/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /By property/ })).toHaveCount(0);
    await expect(page.getByText('Great stay.').first()).toBeVisible();
  });
});
