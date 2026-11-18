import { expect, test } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  teamRbacPaths,
} from '../team/shared/propertyTeamRbacHarness';

test.describe('@ci marketing studio smoke', () => {
  test('tabs load in order and Plan opens first', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await page.goto(teamRbacPaths.marketingWorkspace);
    await expect(page.getByRole('heading', { name: 'Marketing' })).toBeVisible({
      timeout: 20_000,
    });
    const tabs = page.getByRole('tab', { name: /^(Plan|AI Studio|Posts|Videos|Calendar)/ });
    await expect(tabs).toHaveText([/^Plan/, /^AI Studio/, 'Posts', 'Videos', 'Calendar']);
    await expect(page.getByRole('tab', { name: /^Plan/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    // Plan is the daily home; AI Studio is one tab away and still opens on its chooser.
    await page.getByRole('tab', { name: /^AI Studio/ }).click();
    await expect(page.getByRole('heading', { name: 'What do you want to make?' })).toBeVisible();
  });
});
