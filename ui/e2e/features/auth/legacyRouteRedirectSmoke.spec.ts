import { expect, test } from '@playwright/test';

import { installGuestFavoritesMocks } from '../account/shared/guestFavoritesHarness';
import {
  installPropertyTeamRbacMocks,
  teamRbacPaths,
} from '../team/shared/propertyTeamRbacHarness';

test.describe('@smoke legacy route redirects', () => {
  test('account wishlist redirects to favorites', async ({ page }) => {
    await installGuestFavoritesMocks(page);
    await page.goto('/account/wishlist');
    await expect(page).toHaveURL(/\/account\/favorites/, { timeout: 15_000 });
  });

  test('account stays redirects to messages', async ({ page }) => {
    await installGuestFavoritesMocks(page);
    await page.goto('/account/stays');
    await expect(page).toHaveURL(/\/account\/messages/, { timeout: 15_000 });
  });

  test('property custom-pages redirects to public-pages', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await page.goto('/org/sample-stays-ph/property/solea-mactan/custom-pages');
    await expect(page).toHaveURL(/\/public-pages/, { timeout: 20_000 });
  });

  test('property staff redirects to notifications', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await page.goto(teamRbacPaths.settings.replace('/settings', '/staff'));
    await expect(page).toHaveURL(/\/notifications/, { timeout: 20_000 });
  });
});
