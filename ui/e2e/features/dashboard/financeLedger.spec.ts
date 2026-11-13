import { expect, test } from '@playwright/test';

import { installPropertyTeamRbacMocks } from '../team/shared/propertyTeamRbacHarness';

/*
 * Finance ledger with rows, not just the empty shell.
 *
 * The ledger is the money list hosts read every day: it has to show an operating transaction
 * and a stay side by side, and a read-only member must not be offered the write actions.
 */

const FINANCE_PATH = '/org/sample-stays-ph/property/solea-mactan/finance';

test.describe('@ci finance ledger', () => {
  test('shows the seeded transaction and stay in the unified ledger', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', { financeSeeded: true });
    await page.goto(FINANCE_PATH);

    await expect(page.getByRole('heading', { name: 'Finance', exact: true })).toBeVisible({
      timeout: 20_000,
    });

    // Operating transaction, by its label and amount.
    await expect(page.getByText('Electricity bill')).toBeVisible({ timeout: 20_000 });

    // Stay row, by the guest name the ledger uses as its primary label.
    await expect(page.getByText('Maria Santos').first()).toBeVisible({ timeout: 20_000 });
  });

  test('a member without finance:view is redirected away from the ledger', async ({ page }) => {
    // Read Only and Operations both lack `finance:view`; only Full Access holds it. The page
    // must not render money data for them, so the router sends them to an allowed section.
    await installPropertyTeamRbacMocks(page, 'read_only', { financeSeeded: true });
    await page.goto(FINANCE_PATH);

    await expect(page).not.toHaveURL(/\/finance(\?|$)/, { timeout: 20_000 });
    await expect(page.getByText('Electricity bill')).toHaveCount(0);
    await expect(page.getByText('Maria Santos')).toHaveCount(0);
  });
});
