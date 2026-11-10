import { expect, test } from '@playwright/test';

test('inline legal notice on host login opens the sheet at 375', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/for-hosts/login');
  await page.getByRole('heading', { name: /Log in or sign up/i }).waitFor();
  await page.waitForTimeout(500);

  const notice = page.getByText(/By continuing, you agree to the/i);
  await notice.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/legal-login-notice-375.png' });

  const terms = notice.getByRole('link', { name: 'Terms' });
  await terms.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Terms of Service' })).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/legal-login-sheet-375.png' });
});
