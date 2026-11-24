import path from 'node:path';

import { expect, test } from '@playwright/test';

import { fillStable, guestFormPath } from './shared/guestFormHarness';
import {
  demoPause,
  demoScroll,
  installGuestJourneyMocks,
  JOURNEY_BOOKING_ID,
  JOURNEY_PROPERTY_SLUG,
} from './shared/guestJourneyHarness';
import { seedSupabaseAuthSession } from '../../shared/authSeam';

/**
 * Slow-motion walkthrough of the whole guest journey. @demo — headed, never CI.
 *
 *   bun run test:e2e:guest-journey:tour:video
 *
 * One scenario on purpose, so the recording reads as a single guest session:
 * search -> listing -> reservation sheet -> guest form -> trip page -> deposit refund,
 * then the same journey again at phone width.
 *
 * Videos land in `test-results/playwright/<scenario>/video.webm`.
 */

const VALID_ID_FIXTURE = path.join(process.cwd(), 'ui/public/icons/pwa-192.png');

test.describe('guest journey tour @demo', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('01 search to deposit refund, desktop then phone', async ({ page }) => {
    test.setTimeout(420_000);
    // The form now sits behind the guest auth gate; the tour shows the signed-in path.
    page.on('dialog', (dialog) => void dialog.accept());
    await seedSupabaseAuthSession(page, 'guest');
    await installGuestJourneyMocks(page);

    // ---------------------------------------------------------------- discovery
    await page.goto('/search?where=Solea');
    const card = page.locator(`a[href="/properties/${JOURNEY_PROPERTY_SLUG}"]`).first();
    await expect(card).toBeVisible({ timeout: 30_000 });
    await demoPause(page, 1.6);

    await card.hover();
    await demoPause(page, 1);
    await card.click();

    await expect(page.getByRole('heading', { name: 'Solea Mactan', level: 1 })).toBeVisible({
      timeout: 30_000,
    });
    await demoPause(page, 1.4);
    await demoScroll(page, 700, 1);
    await demoScroll(page, 1500, 1);
    await demoScroll(page, 0, 0.6);

    // ---------------------------------------------------------- reservation sheet
    await page.getByRole('button', { name: 'Reserve' }).first().click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible({ timeout: 15_000 });
    await demoPause(page, 1.6);

    const nights = sheet.getByRole('button', { name: /, available$/ });
    await expect(nights.first()).toBeVisible({ timeout: 20_000 });
    await nights.nth(0).click();
    await demoPause(page, 0.8);
    await nights.nth(2).click();
    await demoPause(page, 1.2);

    // Close the date sheet before the guest form opens: the tour continues on the
    // full-page form, and leaving a dirty form behind would trip the unsaved-changes guard.
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden({ timeout: 10_000 });
    await demoPause(page, 0.6);

    // ----------------------------------------------------------------- guest form
    await page.goto(guestFormPath());
    await expect(page.locator('#guest-form-step-heading')).toHaveText('Guest', { timeout: 30_000 });
    await demoPause(page, 1.6);

    await fillStable(page.getByLabel('Full Name'), 'Maria Santos');
    await fillStable(page.getByLabel('Email Address'), 'maria@example.com');
    await fillStable(page.getByLabel('Phone Number'), '09171234567');
    await fillStable(
      page.getByRole('textbox', { name: 'Address *', exact: true }),
      'Cebu City, Cebu'
    );
    await fillStable(page.getByLabel('Nationality'), 'Filipino');
    await fillStable(page.getByPlaceholder('Complete name of Primary Guest'), 'Maria Santos');
    await fillStable(
      page
        .locator('section')
        .filter({ has: page.getByRole('heading', { name: 'Primary Guest *' }) })
        .getByLabel('Age *'),
      '25'
    );
    await page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Primary Guest *' }) })
      .locator('input[type="file"]')
      .setInputFiles(VALID_ID_FIXTURE);
    await demoPause(page, 1.4);

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('#guest-form-step-heading')).toHaveText('Stay', { timeout: 15_000 });
    await demoPause(page, 1.4);

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('#guest-form-step-heading')).toHaveText('Parking', {
      timeout: 15_000,
    });
    await demoPause(page, 1.6);

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('#guest-form-step-heading')).toHaveText('Pets', { timeout: 15_000 });
    await demoPause(page, 1.4);

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('#guest-form-step-heading')).toHaveText('Payment', {
      timeout: 15_000,
    });
    await demoPause(page, 2);

    // The cancellation-policy agreement is required once the property exposes a policy.
    const agree = page.getByRole('checkbox', { name: /I agree to the cancellation policy/i });
    if ((await agree.count()) && !(await agree.isChecked())) {
      await agree.check({ force: true });
      await demoPause(page, 0.8);
    }

    const submit = page.getByRole('button', { name: 'Submit guest form' });
    await expect(submit).toBeEnabled({ timeout: 15_000 });
    await submit.click();

    // --------------------------------------------------------------- trip page
    await expect(page).toHaveURL(new RegExp(`/properties/${JOURNEY_PROPERTY_SLUG}/trip`), {
      timeout: 40_000,
    });
    await demoPause(page, 2.2);
    await demoScroll(page, 700, 1.1);
    await demoScroll(page, 1500, 1.1);
    await demoScroll(page, 0, 0.5);

    // ------------------------------------------------------------ deposit refund
    await page.goto(`/properties/${JOURNEY_PROPERTY_SLUG}/sd-form?bookingId=${JOURNEY_BOOKING_ID}`);
    await expect(page.getByRole('heading', { name: 'Security deposit refund' })).toBeVisible({
      timeout: 30_000,
    });
    await demoPause(page, 2);

    await page.getByRole('button', { name: 'Not now' }).click();
    await expect(page.getByRole('button', { name: 'Claim it!' })).toBeVisible({ timeout: 20_000 });
    await demoPause(page, 1.8);

    await page.getByRole('button', { name: 'Claim it!' }).click();
    await expect(page.getByText(/OFF-10/).first()).toBeVisible({ timeout: 40_000 });
    await demoPause(page, 2.4);

    await page.getByRole('button', { name: /Continue to refund process/i }).click();
    await expect(
      page.getByText("Choose how you'd like to receive your security deposit refund.")
    ).toBeVisible({ timeout: 20_000 });
    await demoPause(page, 2.2);

    await page.getByRole('button', { name: 'Submit security deposit refund' }).click();
    await expect(page.getByText("You're all set!")).toBeVisible({ timeout: 30_000 });
    await demoPause(page, 2.6);

    // ------------------------------------------------------------- phone pass
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/search?where=Solea');
    await expect(
      page.locator(`a[href="/properties/${JOURNEY_PROPERTY_SLUG}"]`).first()
    ).toBeVisible({
      timeout: 30_000,
    });
    await demoPause(page, 2);

    await page.locator(`a[href="/properties/${JOURNEY_PROPERTY_SLUG}"]`).first().click();
    await expect(page.getByRole('heading', { name: 'Solea Mactan', level: 1 })).toBeVisible({
      timeout: 30_000,
    });
    await demoPause(page, 1.8);
    await demoScroll(page, 800, 1.2);

    await page.getByRole('button', { name: 'Reserve' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15_000 });
    await demoPause(page, 1.6);

    const phoneNights = page.getByRole('dialog').getByRole('button', { name: /, available$/ });
    await expect(phoneNights.first()).toBeVisible({ timeout: 20_000 });
    await phoneNights.nth(0).click();
    await demoPause(page, 0.7);
    await phoneNights.nth(2).click();
    await demoPause(page, 1.2);

    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^(Select dates|Continue)/ })
      .last()
      .click();
    await expect(page.getByRole('heading', { name: 'Guest Form' })).toBeVisible({
      timeout: 25_000,
    });
    await demoPause(page, 2.4);

    await page.goto(`/properties/${JOURNEY_PROPERTY_SLUG}/sd-form?bookingId=${JOURNEY_BOOKING_ID}`);
    await expect(page.getByRole('heading', { name: 'Security deposit refund' })).toBeVisible({
      timeout: 30_000,
    });
    await demoPause(page, 2.2);
  });
});
