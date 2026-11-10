import { expect, test } from '@playwright/test';

import { mockEdgeFunctions } from '../../shared/interceptEdge';
import { seedSupabaseAuthSession } from '../../shared/authSeam';

test.describe('@ci guest account landing', () => {
  test('/account opens on Trips', async ({ page }) => {
    await seedSupabaseAuthSession(page, 'guest');
    await mockEdgeFunctions(page, [
      { name: 'guest-trips', body: { success: true, trips: [] } },
      { name: 'get-public-property', body: { success: true, data: null } },
    ]);

    await page.goto('/account');
    // The account index is a redirect, so the landing is the trips list.
    await expect(page).toHaveURL(/\/account\/trips/, { timeout: 20_000 });
  });

  test('/account/stays still resolves, to Messages', async ({ page }) => {
    await seedSupabaseAuthSession(page, 'guest');
    await mockEdgeFunctions(page, [
      { name: 'guest-messages', body: { success: true, threads: [] } },
      { name: 'guest-trips', body: { success: true, trips: [] } },
    ]);

    await page.goto('/account/stays');
    await expect(page).toHaveURL(/\/account\/messages/, { timeout: 20_000 });
  });
});
