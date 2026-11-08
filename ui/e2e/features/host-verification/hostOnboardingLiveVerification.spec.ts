import { expect, test } from '@playwright/test';

import {
  completeIdentityCaptureOnPhone,
  createHostVerificationState,
  E2E_IMAGE_FILE,
  installHostVerificationMocks,
} from './shared/hostVerificationHarness';

/**
 * Registration → onboarding → live ID capture → submit.
 *
 * This is the real desktop shape: the host starts the check on the laptop, a QR hands it to
 * the phone, and the laptop advances itself. The Valid ID never enters the browser, so the
 * server must resolve it from the verdict.
 */
test.describe('@ci host onboarding with live identity capture', () => {
  test('phone handoff produces the Valid ID and the verdict reaches submit', async ({ page }) => {
    const state = createHostVerificationState({
      baseStatus: 'none',
      assets: { validIdPath: null, socialProofPath: null },
    });
    await installHostVerificationMocks(page, state, { noOrganization: true });

    const orgsReady = page.waitForResponse(
      (res) => res.url().includes('/functions/v1/list-organizations') && res.ok()
    );
    await page.goto('/onboarding');
    await orgsReady;

    // Step 1 — organization
    await expect(page.getByRole('heading', { name: 'Organization' })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByLabel(/Organization name/i).fill('Kame Homes');
    await page.waitForResponse(
      (res) => res.url().includes('/functions/v1/check-organization-name') && res.ok()
    );
    await page.getByLabel(/^Contact number/i).fill('09876543210');
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 2 — hosting
    await expect(page.getByRole('heading', { name: 'Hosting' })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Property', exact: true }).click();
    await page.locator('#unit-number').fill('2604');
    await page.waitForResponse(
      (res) => res.url().includes('/functions/v1/check-tower-unit') && res.ok()
    );
    await page.locator('#property-name').fill('Kame Home');
    await page.waitForResponse(
      (res) => res.url().includes('/functions/v1/check-property-name') && res.ok()
    );
    await page.locator('#property-rights-rights').click();
    await page.getByRole('option', { name: 'Property Owner' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 3 — verification
    await expect(page.getByRole('heading', { name: 'Verification' })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: "Let's get verified" }).click();
    await expect(page.getByRole('button', { name: /Verify with camera/i })).toBeVisible();

    // Desktop → phone handoff.
    await page.getByRole('button', { name: /Verify with camera/i }).click();
    await page.getByRole('button', { name: /Verify on your phone/i }).click();
    await expect(page.getByText(/Scan with your phone camera/i)).toBeVisible({ timeout: 20_000 });
    expect(state.calls.identityCreate).toBe(1);

    const phone = await page.context().newPage();
    // Page-level routes are not inherited by a new page in the same context.
    await installHostVerificationMocks(phone, state, { noOrganization: true });
    await phone.goto('/verify/token-e2e-1');
    await completeIdentityCaptureOnPhone(phone);

    // The desktop polls, sees `completed`, and closes the modal on its own.
    await expect(page.getByRole('button', { name: /Verify with camera/i })).toBeVisible({
      timeout: 30_000,
    });
    expect(state.calls.identitySubmit).toBe(1);

    // Facebook Page screenshot is the only remaining required document.
    await page.locator('#onboarding-facebook-page').setInputFiles(E2E_IMAGE_FILE);

    const finish = page.getByRole('button', { name: 'Finish setup' });
    await expect(finish).toBeEnabled({ timeout: 20_000 });

    const submitResponse = page.waitForResponse(
      (res) =>
        res.request().method() === 'POST' &&
        res.url().includes('/functions/v1/submit-org-verification') &&
        res.ok()
    );
    await finish.click();
    await submitResponse;

    expect(state.calls.createOrg).toBe(1);
    expect(state.calls.submitOrg).toBe(1);
    expect(state.lastSubmitOrgBody).toMatchObject({
      tier: 'base',
      identityVerificationId: 'ver-e2e-1',
    });
    // The live capture replaced the ID upload; only the screenshot was uploaded.
    expect(state.calls.uploads).toEqual(['social_proof']);

    await phone.close();
  });

  test('camera denied still offers the upload fallback on the phone page', async ({ page }) => {
    const state = createHostVerificationState({ baseStatus: 'none' });
    state.sessionStatus = 'pending';
    await installHostVerificationMocks(page, state, { noOrganization: true });

    await page.goto('/verify/token-e2e-1');
    await page.getByRole('checkbox', { name: /I agree to this check/i }).check();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: /Take a photo of an ID/i }).click();

    // Headless Chromium has no camera device, so the step must offer upload instead of hanging.
    await expect(page.getByText(/Camera access is off|Camera is not available/i)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: /Upload a photo instead/i })).toBeVisible();
  });

  test('an expired handoff link stops at the expiry screen', async ({ page }) => {
    const state = createHostVerificationState({ baseStatus: 'none' });
    state.sessionStatus = 'expired';
    await installHostVerificationMocks(page, state, { noOrganization: true });

    await page.goto('/verify/token-e2e-1');
    await expect(page.getByText('This link expired')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('checkbox', { name: /I agree to this check/i })).toHaveCount(0);
  });

  test('a pipeline failure surfaces an error and keeps the capture usable', async ({ page }) => {
    const state = createHostVerificationState({ baseStatus: 'none' });
    state.sessionSubmitStatus = 422;
    await installHostVerificationMocks(page, state, { noOrganization: true });

    await page.goto('/verify/token-e2e-1');
    await page.getByRole('checkbox', { name: /I agree to this check/i }).check();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: /Take a photo of an ID/i }).click();
    await page.getByRole('button', { name: /Upload a photo instead/i }).click();
    await page
      .locator('input[type="file"][accept*="image/jpeg"]')
      .last()
      .setInputFiles(E2E_IMAGE_FILE);
    await expect(page.locator('img[alt="Captured ID"]')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Continue' }).click();

    const skipBack = page.getByRole('button', { name: 'Skip this side' });
    if (await skipBack.isVisible().catch(() => false)) await skipBack.click();

    const continueButton = page.getByRole('button', { name: 'Continue' });
    await continueButton.waitFor({ state: 'visible', timeout: 20_000 });
    await continueButton.click();

    await expect(page.getByText(/We could not verify this document/i)).toBeVisible({
      timeout: 20_000,
    });
    expect(state.calls.identitySubmit).toBe(1);
  });
});
