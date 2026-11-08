import { chromium, type Browser, type Page } from '@playwright/test';

/**
 * Two real browser windows side by side, matching the parking demo harness so the host and
 * the super admin can be watched at the same time. Opt-in slow motion:
 *
 *   PLAYWRIGHT_SLOW_MO=700 PLAYWRIGHT_DEMO_PAUSE_MS=1500 \
 *     bunx playwright test --project=chromium-side-by-side hostRegistrationReviewTwoWindows
 */

function readPositiveIntEnv(name: string): number {
  const raw = process.env[name];
  if (!raw) return 0;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export async function demoPause(...pages: Page[]) {
  const pauseMs = readPositiveIntEnv('PLAYWRIGHT_DEMO_PAUSE_MS');
  if (!pauseMs) return;
  await Promise.all(pages.map((page) => page.waitForTimeout(pauseMs)));
}

export type TwoWindowBrowsers = {
  hostBrowser: Browser;
  adminBrowser: Browser;
  hostPage: Page;
  adminPage: Page;
};

export async function launchHostAndAdminBrowsers(): Promise<TwoWindowBrowsers> {
  const slowMo = readPositiveIntEnv('PLAYWRIGHT_SLOW_MO');
  // `lg` starts at 1024. Below it the admin shell swaps the sidebar for the mobile bottom
  // bar, where the verification card does not render — so the demo windows stay above it.
  const width = 1040;
  const hostBrowser = await chromium.launch({
    headless: false,
    slowMo,
    args: [`--window-position=0,40`, `--window-size=${width},980`],
  });
  const adminBrowser = await chromium.launch({
    headless: false,
    slowMo,
    args: [`--window-position=${width + 20},40`, `--window-size=${width},980`],
  });

  const hostContext = await hostBrowser.newContext({ viewport: { width, height: 940 } });
  const adminContext = await adminBrowser.newContext({ viewport: { width, height: 940 } });

  return {
    hostBrowser,
    adminBrowser,
    hostPage: await hostContext.newPage(),
    adminPage: await adminContext.newPage(),
  };
}

export async function closeHostAndAdminBrowsers(browsers: TwoWindowBrowsers) {
  await browsers.hostBrowser.close();
  await browsers.adminBrowser.close();
}

export function twoWindowTimeoutMs(): number {
  const slowMo = readPositiveIntEnv('PLAYWRIGHT_SLOW_MO');
  const demoPauseMs = readPositiveIntEnv('PLAYWRIGHT_DEMO_PAUSE_MS');
  return slowMo || demoPauseMs ? 300_000 : 180_000;
}
