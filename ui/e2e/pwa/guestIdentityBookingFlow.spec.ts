import path from 'node:path';

import { expect, test } from '@playwright/test';

import {
  guestFormPath,
  installGuestFormMocks,
  type GuestIdentityMockState,
} from '../features/guest-form/shared/guestFormHarness';
import { seedSupabaseAuthSession } from '../shared/authSeam';

const ID_PHOTO = path.join(process.cwd(), 'ui/public/icons/pwa-192.png');

/**
 * The full guest booking journey with a live ID check, run against a **production build** so
 * the method chooser renders (dev builds auto-fill a sample ID).
 *
 * Desktop starts the check, a second tab plays the guest's phone, and the booking form picks
 * the verification up and submits. Made to be watched:
 *
 *   PLAYWRIGHT_SLOW_MO=700 PLAYWRIGHT_DEMO_PAUSE_MS=1200 \
 *     bunx playwright test ui/e2e/pwa/guestIdentityBookingFlow.spec.ts --project=pwa
 */
test.describe('@pwa guest booking with a live ID check', () => {
  test('desktop starts the check, phone completes it, booking submits', async ({ page }) => {
    test.setTimeout(180_000);
    const identity: GuestIdentityMockState = {
      status: 'pending',
      verdict: 'partially_verified',
      verificationId: 'guest-ver-e2e',
    };

    await seedSupabaseAuthSession(page, 'guest');
    await installGuestFormMocks(page, { identity });

    await page.goto(guestFormPath('source=airbnb'));
    await expect(page.locator('#guest-form-step-heading')).toHaveText('Guest', {
      timeout: 40_000,
    });
    await demoPause();

    // ── Step 1: guest details ────────────────────────────────────────────────
    await page.getByLabel('Airbnb Name').fill('Maria Santos');
    await page.getByLabel('Email Address').fill('maria@example.com');
    await page.getByLabel('Phone Number').fill('09171234567');
    await page.getByRole('textbox', { name: 'Address *', exact: true }).fill('Cebu City, Cebu');
    await page.getByLabel('Nationality').fill('Filipino');
    await page.getByPlaceholder('Complete name of Primary Guest').fill('Maria Santos');

    const primaryGuest = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Primary Guest *' }) });
    await primaryGuest.getByLabel('Age *').fill('25');
    await demoPause();

    // ── Pick the camera path and hand it to the phone ────────────────────────
    await primaryGuest.getByRole('button', { name: /Verify with camera/i }).click();
    await page.getByRole('button', { name: /Verify on your phone/i }).click();
    await expect(page.getByText(/Scan with your phone camera/i)).toBeVisible({
      timeout: 30_000,
    });
    await demoPause();

    // ── Phone window ─────────────────────────────────────────────────────────
    const phone = await page.context().newPage();
    await installGuestFormMocks(phone, { identity });
    // Block the MediaPipe download so the face step degrades instantly instead of fetching
    // a 13 MB model mid-demo.
    await phone.route('https://cdn.jsdelivr.net/**', (route) => route.abort());
    await phone.route('https://storage.googleapis.com/mediapipe-models/**', (route) =>
      route.abort()
    );

    await phone.bringToFront();
    await phone.goto('/verify/guest-identity-token');
    await expect(phone.getByText('Check your identity')).toBeVisible({ timeout: 30_000 });
    await demoPause();

    await phone.getByRole('checkbox', { name: /I agree to this check/i }).check();
    await phone.getByRole('button', { name: 'Continue' }).click();
    await phone.getByRole('button', { name: /Take a photo of an ID/i }).click();
    await phone.getByRole('button', { name: /Upload a photo instead/i }).click();
    await phone.locator('input[type="file"][accept*="image/jpeg"]').last().setInputFiles(ID_PHOTO);
    await expect(phone.locator('img[alt="Captured ID"]')).toBeVisible({ timeout: 20_000 });
    await demoPause();
    await phone.getByRole('button', { name: 'Continue' }).click();

    const skipBack = phone.getByRole('button', { name: 'Skip this side' });
    if (await skipBack.isVisible().catch(() => false)) await skipBack.click();
    const phoneContinue = phone.getByRole('button', { name: 'Continue' });
    await phoneContinue.waitFor({ state: 'visible', timeout: 20_000 });
    await phoneContinue.click();
    await expect(phone.getByText('Done')).toBeVisible({ timeout: 20_000 });
    await demoPause();
    await phone.close();
    await page.bringToFront();

    // ── Desktop advances on its own and attaches the verification ────────────
    await expect(page.getByText(/Maria S\. verified/i)).toBeVisible({ timeout: 40_000 });
    await demoPause();

    // ── Finish the booking ───────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('#guest-form-step-heading')).toHaveText('Stay', {
      timeout: 20_000,
    });
    await demoPause();

    const submit = page.getByRole('button', { name: 'Submit guest form' });
    await expect(submit).toBeEnabled({ timeout: 20_000 });
    await submit.click();

    await expect(page.getByText('Booking Confirmed!')).toBeVisible({ timeout: 40_000 });
    await demoPause();
  });
});

/** Demo pacing only, never synchronisation. No page polling, so the lane guard stays happy. */
async function demoPause() {
  const raw = process.env.PLAYWRIGHT_DEMO_PAUSE_MS;
  const ms = raw ? Number.parseInt(raw, 10) : 0;
  if (!Number.isFinite(ms) || ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}
