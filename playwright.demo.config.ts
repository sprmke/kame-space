import { defineConfig, devices } from '@playwright/test';

import base from './playwright.config';

/**
 * Slow, recorded run of the mocked E2E specs across every supported viewport, so a
 * reviewer can watch each change in action. Not part of CI.
 *
 *   bun run test:e2e:demo                      # all viewports, marketing + auth + account
 *   DEMO_SPECS=ui/e2e/features/marketing bun run test:e2e:demo
 *   DEMO_SLOW_MO=600 bun run test:e2e:demo     # slower
 *   DEMO_VIEWPORTS=phone,desktop bun run test:e2e:demo
 *
 * Videos land in `tmp/e2e-demo/` (gitignored), one folder per viewport.
 */

const slowMo = Number(process.env.DEMO_SLOW_MO ?? 350);

/** Phone to large desktop. Names are the project names and the output folders. */
export const DEMO_VIEWPORTS = {
  'phone-small': { width: 360, height: 740, mobile: true },
  phone: { width: 390, height: 844, mobile: true },
  'phone-large': { width: 430, height: 932, mobile: true },
  tablet: { width: 768, height: 1024, mobile: true },
  'tablet-landscape': { width: 1024, height: 768, mobile: false },
  laptop: { width: 1280, height: 800, mobile: false },
  desktop: { width: 1440, height: 900, mobile: false },
  wide: { width: 1920, height: 1080, mobile: false },
} as const;

/** One-off sizes: `DEMO_CUSTOM=probe:1024x900,probe2:1280x768`. */
const custom = Object.fromEntries(
  (process.env.DEMO_CUSTOM ?? '')
    .split(',')
    .filter(Boolean)
    .map((entry) => {
      const [name, size] = entry.split(':');
      const [width, height] = size.split('x').map(Number);
      return [name, { width, height, mobile: width < 1024 }];
    })
);

const wanted = process.env.DEMO_VIEWPORTS?.split(',').map((name) => name.trim());
const specs = (
  process.env.DEMO_SPECS ??
  'ui/e2e/features/marketing,ui/e2e/features/auth,ui/e2e/features/account'
)
  .split(',')
  .map((path) => path.trim());

export default defineConfig({
  ...base,
  testMatch: specs.map((path) => new RegExp(`${path.replace(/[./]/g, '[./]')}/.*\\.spec\\.ts$`)),
  // slowMo multiplies every action; editors cold-render behind mocks.
  timeout: 90_000,
  workers: 1,
  retries: 0,
  fullyParallel: false,
  reporter: [['list']],
  outputDir: 'tmp/e2e-demo',
  use: {
    ...base.use,
    trace: 'off',
    screenshot: 'off',
    launchOptions: { slowMo },
  },
  projects: Object.entries({ ...DEMO_VIEWPORTS, ...custom })
    .filter(([name]) => !wanted || wanted.includes(name))
    .map(([name, { width, height, mobile }]) => ({
      name,
      // These editors are desktop-only layouts: below `lg` they have their own phone specs.
      grepInvert: mobile
        ? /@live|@demo|@flaky|@pwa|studio collage|marketing library|marketing themes|video editor v2 (?!on a phone)/
        : /@live|@demo|@flaky|@pwa/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width, height },
        isMobile: mobile,
        hasTouch: mobile,
        video: { mode: 'on' as const, size: { width, height } },
        launchOptions: { slowMo },
      },
    })),
});
