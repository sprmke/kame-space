import { expect, test } from '@playwright/test';

test.describe('@smoke auth legacy redirects', () => {
  test('/sign-in redirects to for-hosts login', async ({ page }) => {
    await page.goto('/sign-in?redirect=%2Forg%2Fsample-stays-ph%2Fdashboard');
    await expect(page).toHaveURL(/\/for-hosts\/login/, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Continue with Google|Sign in/i })).toBeVisible();
  });

  test('host /register redirects to the host login page', async ({ page }) => {
    await page.goto('/for-hosts/register');
    await expect(page).toHaveURL(/\/for-hosts\/login$/, { timeout: 15_000 });
  });

  test('host /register keeps the redirect target', async ({ page }) => {
    await page.goto('/for-hosts/register?redirect=%2Fonboarding');
    await expect(page).toHaveURL(/\/for-hosts\/login\?redirect=%2Fonboarding$/, {
      timeout: 15_000,
    });
  });

  test('guest /register redirects to the guest login page', async ({ page }) => {
    await page.goto('/for-guests/register');
    await expect(page).toHaveURL(/\/for-guests\/login$/, { timeout: 15_000 });
  });
});
