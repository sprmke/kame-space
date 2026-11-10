import { expect, test } from '@playwright/test';

const SIZES = [
  { name: '375', width: 375, height: 812 },
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 900 },
  { name: '1440', width: 1440, height: 1000 },
];

for (const size of SIZES) {
  test(`legal audit ${size.name}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto('/');

    const region = page.getByRole('region', { name: 'Cookie preferences' });
    await region.waitFor();
    const cookieBox = await region.boundingBox();
    const tabBarBox = await page
      .locator('nav[aria-label="Main"]')
      .boundingBox()
      .catch(() => null);

    const cookieMetrics = await page.evaluate(() => ({
      docOverflow: document.documentElement.scrollWidth - window.innerWidth,
    }));

    const bannerWithinViewport =
      cookieBox != null &&
      cookieBox.x >= 0 &&
      cookieBox.x + cookieBox.width <= size.width + 1 &&
      cookieBox.y + cookieBox.height <= size.height + 1;
    const bannerAboveTabBar =
      tabBarBox == null || (cookieBox != null && cookieBox.y + cookieBox.height <= tabBarBox.y);

    console.log(
      `LEGAL ${size.name} cookie`,
      JSON.stringify({ cookieBox, tabBarBox, bannerWithinViewport, bannerAboveTabBar, ...cookieMetrics })
    );

    expect(cookieMetrics.docOverflow).toBeLessThanOrEqual(1);
    expect(bannerWithinViewport).toBe(true);
    expect(bannerAboveTabBar).toBe(true);

    await page.screenshot({ path: `test-results/legal-${size.name}-cookie.png` });

    await region.getByRole('link', { name: 'Cookie Policy' }).click();
    await page.getByRole('heading', { name: 'Cookie Policy' }).waitFor();
    await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Open full page/ })).toBeVisible();
    await page.waitForTimeout(250);

    const sheetMetrics = await page.evaluate(() => {
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
      const scroller = dialog?.querySelector<HTMLElement>('.overflow-y-auto');
      const rect = dialog?.getBoundingClientRect();
      return {
        docOverflow: document.documentElement.scrollWidth - window.innerWidth,
        dialog: rect
          ? { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) }
          : null,
        scrollerOverflow: scroller ? scroller.scrollWidth - scroller.clientWidth : null,
      };
    });
    console.log(`LEGAL ${size.name} sheet`, JSON.stringify(sheetMetrics));
    expect(sheetMetrics.docOverflow).toBeLessThanOrEqual(1);
    expect(sheetMetrics.scrollerOverflow ?? 0).toBeLessThanOrEqual(1);

    await page.screenshot({ path: `test-results/legal-${size.name}-sheet.png` });
  });
}

test('installed PWA hides the cookie banner but keeps preferences', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', { get: () => true, configurable: true });
    window.localStorage.setItem('gfm:install:memory', JSON.stringify({ firstLaunchSeen: true }));
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForTimeout(1200);

  await expect(page.getByRole('region', { name: 'Cookie preferences' })).toHaveCount(0);

  await page.goto('/cookies');
  await expect(page.getByRole('heading', { name: 'Cookie Policy' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Allow analytics' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Necessary only' })).toBeVisible();
  await page.screenshot({ path: 'test-results/legal-standalone-cookies.png' });
});

test('inline legal notice on host login opens the sheet at 375', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/for-hosts/login');
  const terms = page.getByRole('link', { name: 'Terms' }).last();
  await terms.waitFor();
  await page.screenshot({ path: 'test-results/legal-login-notice-375.png' });
  await terms.click();
  await expect(page.getByRole('heading', { name: 'Terms of Service' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
  await page.screenshot({ path: 'test-results/legal-login-sheet-375.png' });
});
