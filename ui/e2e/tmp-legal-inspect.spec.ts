import { test } from '@playwright/test';

test('inspect login legal notice', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/for-hosts/login');
  await page.getByRole('heading', { name: /Log in or sign up/i }).waitFor();
  await page.waitForTimeout(1000);
  const text = await page.evaluate(() => document.body.innerText);
  console.log('HAS_NOTICE', text.includes('By continuing'));
  console.log('HAS_TERMS_LINK', (await page.getByRole('link', { name: 'Terms' }).count()) > 0);
  const idx = text.indexOf('Booking a stay');
  console.log('SNIPPET', JSON.stringify(text.slice(idx, idx + 260)));
});
