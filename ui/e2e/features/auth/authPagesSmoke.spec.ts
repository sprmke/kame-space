import { expect, test } from '@playwright/test';

test.describe('@smoke auth pages', () => {
  test('for-hosts login page renders', async ({ page }) => {
    await page.goto('/for-hosts/login');
    await expect(page.getByRole('button', { name: /Continue with Google|Sign in/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('for-guests login page renders', async ({ page }) => {
    await page.goto('/for-guests/login');
    await expect(page.getByRole('button', { name: /Continue with Google|Sign in/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('guest sign-in offers the host sign-in page, not a separate signup', async ({ page }) => {
    await page.goto('/for-guests/login');
    await expect(page.getByRole('heading', { name: 'Log in or sign up' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('link', { name: 'Sign in as host' })).toHaveAttribute(
      'href',
      '/for-hosts/login'
    );
    await expect(page.getByText('Create one now')).toHaveCount(0);
  });

  test('host sign-in offers the guest sign-in page', async ({ page }) => {
    await page.goto('/for-hosts/login');
    await expect(page.getByRole('link', { name: 'Sign in as guest' })).toHaveAttribute(
      'href',
      '/for-guests/login'
    );
  });
});
