import { expect, test } from '@playwright/test';

import {
  installGuestJourneyMocks,
  JOURNEY_BOOKING_ID,
  JOURNEY_PROPERTY_SLUG,
} from './shared/guestJourneyHarness';
import { seedSupabaseAuthSession } from '../../shared/authSeam';

/**
 * Guest journey, end to end: search -> listing -> reservation sheet -> guest form shell,
 * then the post-stay deposit refund (review skip -> voucher -> refund details -> done).
 *
 * The form submit leg lives in `guestFormSubmit.spec.ts`; this spec owns discovery and the
 * refund stepper, which had no coverage before the 2026-11 guest-flow audit.
 */

test.describe('@smoke @critical guest journey', () => {
  test.describe('discovery and reservation', () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test('guest searches, opens a listing and reaches the guest form', async ({ page }) => {
      test.setTimeout(90_000);
      await seedSupabaseAuthSession(page, 'guest');
      await installGuestJourneyMocks(page);

      await page.goto('/search?where=Solea');
      const card = page.locator(`a[href="/properties/${JOURNEY_PROPERTY_SLUG}"]`).first();
      await expect(card).toBeVisible({ timeout: 25_000 });
      await card.click();

      await expect(page.getByRole('heading', { name: 'Solea Mactan', level: 1 })).toBeVisible({
        timeout: 25_000,
      });

      await page.getByRole('button', { name: 'Reserve' }).first().click();
      const sheet = page.getByRole('dialog');
      await expect(sheet).toBeVisible({ timeout: 15_000 });

      // Availability comes from `get-booked-dates`, mocked empty, so future nights are free.
      const nights = sheet.getByRole('button', { name: /, available$/ });
      await expect(nights.first()).toBeVisible({ timeout: 20_000 });
      await nights.nth(0).click();
      await nights.nth(2).click();
      await expect(sheet.getByText(/\d+ nights? selected/)).toBeVisible();

      const proceed = sheet.getByRole('button', { name: /^(Select dates|Continue)/ }).last();
      await expect(proceed).toBeEnabled();
      await proceed.click();

      // The sheet hands off to the guest form; its first step must be usable in place.
      await expect(page.getByRole('heading', { name: 'Guest Form' })).toBeVisible({
        timeout: 25_000,
      });
      await expect(page.getByLabel('Full Name')).toBeVisible();
    });

    /**
     * Locks the current entry rule: `GuestForm` calls `requireGuestAuth` before it is usable.
     * The home page copy was aligned to this on 2026-11-24 ("Sign in once so your trip and
     * messages stay in one place"). If the gate is ever removed, this test is the reminder to
     * change that copy back.
     */
    test('anonymous guest is asked to sign in before the guest form', async ({ page }) => {
      test.setTimeout(60_000);
      await installGuestJourneyMocks(page);

      await page.goto(
        `/properties/${JOURNEY_PROPERTY_SLUG}/form?checkInDate=2027-04-08&checkOutDate=2027-04-10`
      );

      await expect(page.getByRole('heading', { name: 'Log in or sign up' })).toBeVisible({
        timeout: 25_000,
      });
    });

    test('submit stays disabled until the cancellation policy is accepted', async ({ page }) => {
      test.setTimeout(120_000);
      await seedSupabaseAuthSession(page, 'guest');
      await installGuestJourneyMocks(page);

      await page.goto(
        `/properties/${JOURNEY_PROPERTY_SLUG}/form?checkInDate=2027-04-08&checkOutDate=2027-04-10`
      );
      await expect(page.locator('#guest-form-step-heading')).toHaveText('Guest', {
        timeout: 30_000,
      });

      // Dev builds seed the form with sample data, so the steps advance without typing.
      // Wait on the heading changing rather than a timer.
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const heading = (await page.locator('#guest-form-step-heading').textContent())?.trim();
        if (heading === 'Payment') break;
        await page.getByRole('button', { name: 'Continue' }).click();
        await expect
          .poll(
            async () => (await page.locator('#guest-form-step-heading').textContent())?.trim(),
            {
              timeout: 15_000,
            }
          )
          .not.toBe(heading);
      }
      await expect(page.locator('#guest-form-step-heading')).toHaveText('Payment', {
        timeout: 20_000,
      });

      const submit = page.getByRole('button', { name: 'Submit guest form' });
      await expect(submit).toBeDisabled();

      await page
        .getByRole('checkbox', { name: /I agree to the cancellation policy/i })
        .check({ force: true });

      await expect(submit).toBeEnabled({ timeout: 10_000 });
    });
  });

  test.describe('deposit refund', () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test('guest skips the review, wins a voucher and submits refund details', async ({ page }) => {
      test.setTimeout(90_000);
      await installGuestJourneyMocks(page);

      await page.goto(
        `/properties/${JOURNEY_PROPERTY_SLUG}/sd-form?bookingId=${JOURNEY_BOOKING_ID}`
      );

      await expect(page.getByRole('heading', { name: 'Security deposit refund' })).toBeVisible({
        timeout: 25_000,
      });
      await expect(page.getByText('Maria Santos')).toBeVisible();

      // Step 1 is optional. "Not now" must still lead to the voucher, per the route guide.
      await page.getByRole('button', { name: 'Not now' }).click();

      const claim = page.getByRole('button', { name: 'Claim it!' });
      await expect(claim).toBeVisible({ timeout: 20_000 });
      await claim.click();

      await expect(page.getByText(/OFF-10/).first()).toBeVisible({ timeout: 25_000 });

      await page.getByRole('button', { name: /Continue to refund process/i }).click();

      await expect(
        page.getByText("Choose how you'd like to receive your security deposit refund.")
      ).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(/GCash - 09171234567/)).toBeVisible();

      // The guest must see what they are getting back, not just where it goes.
      const amount = page.getByRole('region', { name: 'Refund amount' });
      await expect(amount).toBeVisible();
      await expect(amount.getByText('₱2,750.00')).toBeVisible();
      await expect(amount.getByText('Security deposit')).toBeVisible();
      await expect(amount.getByText('Deductions')).toBeVisible();

      await page.getByRole('button', { name: 'Submit security deposit refund' }).click();

      await expect(page.getByText("You're all set!")).toBeVisible({ timeout: 25_000 });
      await expect(page.getByRole('link', { name: 'View your booking' })).toBeVisible();
    });
  });

  test.describe('recovery and availability', () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test('an expired refund link explains itself and offers the host', async ({ page }) => {
      test.setTimeout(60_000);
      await installGuestJourneyMocks(page);
      await page.route('**/functions/v1/get-sd-form**', (route) =>
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, message: 'Access token required' }),
        })
      );

      await page.goto(
        `/properties/${JOURNEY_PROPERTY_SLUG}/sd-form?bookingId=${JOURNEY_BOOKING_ID}`
      );

      await expect(page.getByRole('heading', { name: 'This link has expired' })).toBeVisible({
        timeout: 25_000,
      });
      // The server string must never reach the guest.
      await expect(page.getByText('Access token required')).toHaveCount(0);
      await expect(page.getByRole('link', { name: /Message the host/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /Back to home/i })).toBeVisible();
    });

    test('the calendar explains available vs booked nights', async ({ page }) => {
      test.setTimeout(60_000);
      // A booked night inside the visible month, so the legend has something to explain.
      const manilaToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(
        new Date()
      );
      const addDays = (ymd: string, days: number) => {
        const noonManila = new Date(`${ymd}T12:00:00+08:00`);
        noonManila.setUTCDate(noonManila.getUTCDate() + days);
        return noonManila.toISOString().slice(0, 10);
      };
      await installGuestJourneyMocks(page);
      await page.route('**/functions/v1/get-booked-dates**', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                // A long block so whichever month the calendar opens on has booked nights.
                checkInDate: addDays(manilaToday, 1),
                checkOutDate: addDays(manilaToday, 90),
              },
            ],
          }),
        })
      );

      await page.goto(`/properties/${JOURNEY_PROPERTY_SLUG}/calendar`);
      const legend = page.getByRole('list', { name: 'Calendar legend' });
      if (!(await legend.isVisible().catch(() => false))) {
        // Range landed in the next month: step forward once.
        await page.getByRole('button', { name: 'Next month' }).click();
      }
      await expect(legend).toBeVisible({ timeout: 20_000 });
      await expect(legend.getByText('Available')).toBeVisible();
      await expect(legend.getByText('Booked')).toBeVisible();
    });
  });
});
