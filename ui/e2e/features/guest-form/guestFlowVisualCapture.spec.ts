import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import {
  installGuestJourneyMocks,
  JOURNEY_BOOKING_ID,
  JOURNEY_PROPERTY_SLUG,
} from './shared/guestJourneyHarness';
import { seedSupabaseAuthSession } from '../../shared/authSeam';

/**
 * Before/after capture for the guest-flow UX fixes. @demo - never CI.
 *
 *   AUDIT_PHASE=before bun run audit:guest-flow-shots
 *   AUDIT_PHASE=after  bun run audit:guest-flow-shots
 *
 * Writes `docs/workflow/in-progress/guest-flow-ux-audit/before-after/<phase>/`.
 * Run the "before" pass against a clean HEAD copy so the two sets differ only by the fix.
 *
 * One test per surface on purpose: leaving a dirty guest form fires the unsaved-changes
 * guard, which cancels the next navigation. A fresh page per test keeps every capture
 * independent of the one before it.
 */

const PHASE = (process.env.AUDIT_PHASE ?? 'after').trim();
const OUT_DIR = path.join(
  process.cwd(),
  'docs/workflow/in-progress/guest-flow-ux-audit/before-after',
  PHASE
);

const DESKTOP = { width: 1440, height: 900 } as const;
const PHONE = { width: 375, height: 812 } as const;
const TABLET = { width: 768, height: 1024 } as const;

/** Local seed booking in READY_FOR_CHECKIN: the trip page shows the step bar + checklist. */
const TRIP_BOOKING_ID = '5eed1000-0000-4000-8000-000000000058';

/** Mints the same HMAC access token the email links use, straight from the local edge secret. */
function localGuestAccessToken(bookingId: string): string {
  const env = fs.readFileSync(path.join(process.cwd(), 'supabase/.env.local'), 'utf8');
  const secret = env.match(/^GUEST_BOOKING_ACCESS_SECRET=(.*)$/m)?.[1]?.trim();
  if (!secret) throw new Error('GUEST_BOOKING_ACCESS_SECRET missing from supabase/.env.local');
  const exp = Date.now() + 180 * 24 * 60 * 60 * 1000;
  const payload = `v1.${bookingId}.${exp}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/** Two frames after a state change. Captures run with reduced motion, so nothing slides. */
async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })
  );
}

async function shot(page: Page, name: string, fullPage = false) {
  // Never capture the static boot splash: require the React tree to be mounted.
  await page
    .waitForFunction(
      () => {
        const root = document.getElementById('root');
        return document.readyState === 'complete' && !!root && root.childElementCount > 0;
      },
      undefined,
      { timeout: 30_000 }
    )
    .catch(() => undefined);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage });
}

/** Element-scoped capture so a tall form page does not drown the thing being reviewed. */
async function shotEl(locator: ReturnType<Page['locator']>, name: string) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await locator.screenshot({ path: path.join(OUT_DIR, `${name}.png`) });
}

/** Walks the guest form to the payment step using the dev sample seed. */
async function goToPaymentStep(page: Page) {
  await expect(page.locator('#guest-form-step-heading')).toHaveText('Guest', { timeout: 30_000 });
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const heading = (await page.locator('#guest-form-step-heading').textContent())?.trim();
    if (heading === 'Payment') return;
    await page.getByRole('button', { name: 'Continue' }).click();
    await settle(page);
  }
}

test.describe('guest flow before/after capture @demo', () => {
  // The shared consent storage state only covers :4173/:4174, and these passes run on other
  // ports, so seed the cookie choice or the banner covers the bottom of every capture.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('kh-cookie-consent', 'declined');
      } catch {
        /* private mode */
      }
    });
  });
  test('A1 desktop: home copy and sign-in wall', async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(DESKTOP);
    await installGuestJourneyMocks(page);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /From request to refund/i })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('heading', { name: /From request to refund/i }).scrollIntoViewIfNeeded();
    await settle(page);
    await shot(page, 'g1-home-booking-step');

    await page.goto(
      `/properties/${JOURNEY_PROPERTY_SLUG}/form?checkInDate=2027-04-08&checkOutDate=2027-04-10`
    );
    await expect(page.getByRole('heading', { name: 'Log in or sign up' })).toBeVisible({
      timeout: 30_000,
    });
    await settle(page);
    await shot(page, 'g1-signin-modal');
  });

  test('A2 desktop: listing and date sheet', async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(DESKTOP);
    await seedSupabaseAuthSession(page, 'guest');
    await installGuestJourneyMocks(page);

    await page.goto(`/properties/${JOURNEY_PROPERTY_SLUG}`);
    await expect(page.getByRole('heading', { name: 'Solea Mactan', level: 1 })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole('button', { name: 'Reserve' }).first().click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible({ timeout: 15_000 });
    await settle(page);
    await shot(page, 'g6-date-sheet-disabled');

    const nights = sheet.getByRole('button', { name: /, available$/ });
    await expect(nights.first()).toBeVisible({ timeout: 20_000 });
    await nights.nth(0).click();
    await settle(page);
    await nights.nth(2).click();
    await settle(page);
    await sheet
      .getByRole('button', { name: /^(Select dates|Continue)/ })
      .last()
      .click();
    await expect(page.getByRole('heading', { name: 'Guest Form' })).toBeVisible({
      timeout: 25_000,
    });
    await settle(page);
    await shot(page, 'g4-booking-sheet-header');
  });

  test('B desktop: payment breakdown and submit gate', async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(DESKTOP);
    await seedSupabaseAuthSession(page, 'guest');
    await installGuestJourneyMocks(page);

    await page.goto(
      `/properties/${JOURNEY_PROPERTY_SLUG}/form?checkInDate=2027-04-08&checkOutDate=2027-04-10`
    );
    await goToPaymentStep(page);
    await expect(page.locator('#guest-form-step-heading')).toHaveText('Payment', {
      timeout: 20_000,
    });
    await settle(page);
    const breakdown = page.getByRole('group', { name: 'Payment breakdown' });
    await breakdown.scrollIntoViewIfNeeded();
    await settle(page);
    await shotEl(breakdown, 'g3-payment-breakdown');

    await page
      .getByRole('checkbox', { name: /I agree to the cancellation policy/i })
      .scrollIntoViewIfNeeded();
    await settle(page);
    await shot(page, 'g6b-submit-gated');
  });

  test('C desktop: refund title, voucher copy, refund amount', async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize(DESKTOP);
    await installGuestJourneyMocks(page);

    await page.goto(`/properties/${JOURNEY_PROPERTY_SLUG}/sd-form?bookingId=${JOURNEY_BOOKING_ID}`);
    await expect(page.getByRole('button', { name: 'Not now' })).toBeVisible({ timeout: 30_000 });
    await settle(page);
    await shot(page, 'g8-refund-title');

    await page.getByRole('button', { name: 'Not now' }).click();
    await expect(page.getByRole('button', { name: 'Claim it!' })).toBeVisible({ timeout: 20_000 });
    await settle(page);
    await shot(page, 'g9-voucher-intro');

    await page.getByRole('button', { name: 'Claim it!' }).click();
    await expect(page.getByText(/OFF-10/).first()).toBeVisible({ timeout: 40_000 });
    await settle(page);
    await page.getByRole('button', { name: /Continue to refund process/i }).click();
    await expect(page.getByText('Cash pickup')).toBeVisible({ timeout: 20_000 });
    await settle(page);
    await shot(page, 'g2-refund-amount', true);
  });

  test('D mobile: search chips and host row (live local seed)', async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize(PHONE);

    // Live local seed on purpose: the two-category chip row and the real host name only
    // exist with real data. Both phases read the same local Supabase, so the pair is fair.
    await page.goto('/search?where=Monaco');
    await expect(page.getByRole('link', { name: /Monaco 2604/i }).first()).toBeVisible({
      timeout: 30_000,
    });
    await settle(page);
    await shot(page, 'g14-search-chips');

    await page.goto('/properties/kame-home');
    await expect(page.getByRole('heading', { name: 'Monaco 2604', level: 1 })).toBeVisible({
      timeout: 30_000,
    });
    await page
      .getByText(/Hosted by/i)
      .first()
      .scrollIntoViewIfNeeded();
    await settle(page);
    await shot(page, 'g15-host-row');
  });

  test('E mobile: review stars', async ({ page }) => {
    test.setTimeout(150_000);
    // Taller than a phone so the rating rows are in frame without relying on inner scroll.
    await page.setViewportSize({ width: 375, height: 1500 });
    await installGuestJourneyMocks(page);

    await page.goto(`/properties/${JOURNEY_PROPERTY_SLUG}/sd-form?bookingId=${JOURNEY_BOOKING_ID}`);
    await expect(page.getByText('Cleanliness')).toBeVisible({ timeout: 30_000 });
    // The stepper scrolls inside the guest shell, so ask the element itself (block: center).
    await page
      .getByText('Cleanliness')
      .evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await settle(page);
    await shot(page, 'g13-review-stars');
  });

  test('F mobile: draft restore toast', async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize(PHONE);
    await seedSupabaseAuthSession(page, 'guest');
    await installGuestJourneyMocks(page);

    await page.goto(
      `/properties/${JOURNEY_PROPERTY_SLUG}/form?checkInDate=2027-04-08&checkOutDate=2027-04-10`
    );
    await expect(page.locator('#guest-form-step-heading')).toHaveText('Guest', { timeout: 30_000 });
    await page.getByLabel('Full Name').fill('Maria Santos');
    // Wait for the debounced autosave to land in IndexedDB (gfm-drafts / drafts) instead of a timer.
    await expect
      .poll(
        async () =>
          page.evaluate(
            () =>
              new Promise<number>((resolve) => {
                const open = indexedDB.open('gfm-drafts');
                open.onerror = () => resolve(0);
                open.onsuccess = () => {
                  const db = open.result;
                  if (!db.objectStoreNames.contains('drafts')) {
                    resolve(0);
                    return;
                  }
                  const request = db
                    .transaction('drafts', 'readonly')
                    .objectStore('drafts')
                    .getAllKeys();
                  request.onsuccess = () =>
                    resolve(
                      request.result.filter((key) => String(key).startsWith('values:')).length
                    );
                  request.onerror = () => resolve(0);
                };
              })
          ),
        { timeout: 20_000 }
      )
      .toBeGreaterThan(0);
    await page.reload();
    // The mocked stack refetches payment info + session on reload; let it settle or React
    // swaps the card back to a skeleton mid-capture.
    await page.waitForLoadState('networkidle');
    // Wait for the form itself to paint, then the restore prompt, then take the frame.
    await expect(page.getByLabel('Full Name')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Continue where you left off?')).toBeVisible({ timeout: 20_000 });
    await settle(page);
    await shot(page, 'g16-draft-toast');
  });

  test('G mobile: refund amount', async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize(PHONE);
    await installGuestJourneyMocks(page);

    await page.goto(`/properties/${JOURNEY_PROPERTY_SLUG}/sd-form?bookingId=${JOURNEY_BOOKING_ID}`);
    await expect(page.getByRole('button', { name: 'Not now' })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Not now' }).click();
    await page.getByRole('button', { name: 'Claim it!' }).click();
    await expect(page.getByText(/OFF-10/).first()).toBeVisible({ timeout: 40_000 });
    await settle(page);
    await page.getByRole('button', { name: /Continue to refund process/i }).click();
    await expect(page.getByText('Cash pickup')).toBeVisible({ timeout: 20_000 });
    await settle(page);
    await shot(page, 'g2-refund-amount-mobile', true);
  });

  test('H desktop: trip progress and checklist (live local seed)', async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize(DESKTOP);

    await page.goto(
      `/properties/kame-home/trip?bookingId=${TRIP_BOOKING_ID}&access=${localGuestAccessToken(TRIP_BOOKING_ID)}`
    );
    await expect(page.getByRole('heading', { name: /Monaco 2604/ })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByText(/What happens next/i).scrollIntoViewIfNeeded();
    await settle(page);
    await shot(page, 'g10-trip-progress');
  });

  /* ------------------------------------------------------------------ G5 + G7 */

  test('I calendar legend (G5) at phone, tablet and desktop', async ({ page }) => {
    test.setTimeout(240_000);

    // Live local seed: the legend only renders when the month actually has booked nights.
    for (const [name, size] of [
      ['phone', PHONE],
      ['tablet', TABLET],
      ['desktop', DESKTOP],
    ] as const) {
      await page.setViewportSize(size);
      await page.goto('/properties/kame-home/calendar');
      await expect(page.getByRole('heading', { name: /Check Availability/i })).toBeVisible({
        timeout: 30_000,
      });
      // The dev server reloads once after pre-bundling deps; absorb it so the frame is the app.
      await page.waitForLoadState('networkidle');
      await page.reload();
      await expect(page.getByRole('heading', { name: /Check Availability/i })).toBeVisible({
        timeout: 30_000,
      });
      // Walk forward until a month that actually has booked nights (the legend is conditional).
      const bookedCell = page.locator('button[aria-label*="booked"]').first();
      for (let month = 0; month < 14; month += 1) {
        if ((await bookedCell.count()) > 0) break;
        await page.getByRole('button', { name: 'Next month' }).click();
        await settle(page);
      }
      await expect(bookedCell).toBeVisible({ timeout: 20_000 });
      await settle(page);
      await shot(page, `g5-calendar-legend-${name}`);
    }
  });

  test('J expired link recovery (G7) at desktop and phone', async ({ page }) => {
    test.setTimeout(180_000);
    await seedSupabaseAuthSession(page, 'guest');
    await installGuestJourneyMocks(page);
    await page.route('**/functions/v1/get-sd-form**', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Access token required' }),
      })
    );

    for (const [name, size] of [
      ['desktop', DESKTOP],
      ['phone', PHONE],
    ] as const) {
      await page.setViewportSize(size);
      await page.goto(
        `/properties/${JOURNEY_PROPERTY_SLUG}/sd-form?bookingId=${JOURNEY_BOOKING_ID}`
      );
      await expect(page.getByRole('heading', { name: /expired|available/i })).toBeVisible({
        timeout: 25_000,
      });
      await settle(page);
      await shot(page, `g7-expired-link-${name}`);
    }
  });

  /* ------------------------------------------------- cross-resolution sweep */

  test('K responsive sweep: the changed screens at 375, 768 and 1440', async ({ page }) => {
    test.setTimeout(600_000);
    await seedSupabaseAuthSession(page, 'guest');
    await installGuestJourneyMocks(page);

    for (const { label, size } of [
      { label: 'phone', size: PHONE },
      { label: 'tablet', size: TABLET },
      { label: 'desktop', size: DESKTOP },
    ]) {
      // 1. Listing booking sheet header (no dirty form yet, so navigation stays free).
      await page.setViewportSize(size);
      await page.goto(`/properties/${JOURNEY_PROPERTY_SLUG}`);
      await expect(page.getByRole('heading', { name: 'Solea Mactan', level: 1 })).toBeVisible({
        timeout: 30_000,
      });
      await page.getByRole('button', { name: 'Reserve' }).first().click();
      const sheet = page.getByRole('dialog');
      await expect(sheet).toBeVisible({ timeout: 15_000 });
      const nights = sheet.getByRole('button', { name: /, available$/ });
      await expect(nights.first()).toBeVisible({ timeout: 20_000 });
      await nights.nth(0).click();
      await nights.nth(2).click();
      await sheet
        .getByRole('button', { name: /^(Select dates|Continue)/ })
        .last()
        .click();
      await expect(page.getByRole('heading', { name: 'Guest Form' })).toBeVisible({
        timeout: 25_000,
      });
      await settle(page);
      await shot(page, `sweep-booking-sheet-${label}`);

      // 2. Refund step: amount block above the options.
      await page.setViewportSize(size);
      await page.goto(
        `/properties/${JOURNEY_PROPERTY_SLUG}/sd-form?bookingId=${JOURNEY_BOOKING_ID}`
      );
      await expect(page.getByRole('button', { name: 'Not now' })).toBeVisible({
        timeout: 30_000,
      });
      await page.getByRole('button', { name: 'Not now' }).click();
      await page.getByRole('button', { name: 'Claim it!' }).click();
      await expect(page.getByText(/OFF-10/).first()).toBeVisible({ timeout: 40_000 });
      await page.getByRole('button', { name: /Continue to refund process/i }).click();
      await expect(page.getByText('Cash pickup')).toBeVisible({ timeout: 20_000 });
      await settle(page);
      await shot(page, `sweep-refund-${label}`, true);

      // 3. Payment step last: the form is dirty from here on, so nothing navigates after it.
      await page.setViewportSize(size);
      await page.goto(
        `/properties/${JOURNEY_PROPERTY_SLUG}/form?checkInDate=2027-04-08&checkOutDate=2027-04-10`
      );
      await goToPaymentStep(page);
      await expect(page.locator('#guest-form-step-heading')).toHaveText('Payment', {
        timeout: 20_000,
      });
      const breakdown = page.getByRole('group', { name: 'Payment breakdown' });
      await breakdown.scrollIntoViewIfNeeded();
      await settle(page);
      await shotEl(breakdown, `sweep-payment-${label}`);
    }
  });
});
