import { expect, test } from '@playwright/test';

import {
  completeIdentityCaptureOnPhone,
  createHostVerificationState,
  E2E_IMAGE_FILE,
  installHostVerificationMocks,
  type IdentitySummary,
} from '../shared/hostVerificationHarness';
import {
  closeHostAndAdminBrowsers,
  demoPause,
  launchHostAndAdminBrowsers,
  twoWindowTimeoutMs,
} from '../shared/twoWindowHarness';

const liveIdentity: IdentitySummary = {
  id: 'ver-e2e-1',
  verdict: 'partially_verified',
  method: 'philsys_qr',
  document_type: 'philid',
  full_name: 'E2E H.',
  signature_valid: false,
  liveness_grade: 'clientside',
  face_match_verdict: 'likely_match',
  flags: [{ code: 'liveness_unavailable', severity: 'info' }],
  verified_at: '2026-11-07T00:00:00.000Z',
  expires_at: '2027-11-07T00:00:00.000Z',
  created_at: '2026-11-07T00:00:00.000Z',
};

/**
 * Registration → onboarding → live capture → submit, then the super admin reviews the
 * pre-screened verdict and approves. Both windows share one state object, so the approval
 * is visible to the host without a manual data reset.
 */
test.describe('host registration and super-admin review side by side', () => {
  test('host onboards with a live ID, admin approves, host sees the next step', async ({
    page: _page,
  }, testInfo) => {
    test.setTimeout(twoWindowTimeoutMs());
    test.skip(
      testInfo.project.name !== 'chromium-side-by-side',
      'Run this scenario with the chromium-side-by-side project.'
    );

    const state = createHostVerificationState({
      baseStatus: 'none',
      assets: { validIdPath: null, socialProofPath: null },
    });
    state.identity = liveIdentity;

    const browsers = await launchHostAndAdminBrowsers();
    try {
      const { hostPage, adminPage } = browsers;
      await installHostVerificationMocks(hostPage, state, { noOrganization: true });
      await installHostVerificationMocks(adminPage, state, { asSuperAdmin: true });

      // ── Host window: registration and onboarding ────────────────────────────
      await hostPage.goto('/onboarding');
      await expect(hostPage.getByRole('heading', { name: 'Organization' })).toBeVisible({
        timeout: 30_000,
      });
      await hostPage.getByLabel(/Organization name/i).fill('Test Host Org');
      await hostPage.getByLabel(/^Contact number/i).fill('09876543210');
      await hostPage.getByRole('button', { name: 'Continue' }).click();
      await demoPause(hostPage, adminPage);

      await expect(hostPage.getByRole('heading', { name: 'Hosting' })).toBeVisible({
        timeout: 20_000,
      });
      await hostPage.getByRole('button', { name: 'Property', exact: true }).click();
      await hostPage.locator('#unit-number').fill('2604');
      await hostPage.locator('#property-name').fill('Monaco Test Unit');
      await hostPage.locator('#property-rights-rights').click();
      await hostPage.getByRole('option', { name: 'Property Owner' }).click();
      await hostPage.getByRole('button', { name: 'Continue' }).click();
      await demoPause(hostPage, adminPage);

      await expect(hostPage.getByRole('heading', { name: 'Verification' })).toBeVisible({
        timeout: 20_000,
      });
      await hostPage.getByRole('button', { name: "Let's get verified" }).click();
      await demoPause(hostPage);

      // Live capture replaces the gallery upload: the host starts it here, the phone does
      // the capture, and this window advances on its own.
      await hostPage.getByRole('button', { name: /Verify with camera/i }).click();
      await hostPage.getByRole('button', { name: /Verify on your phone/i }).click();
      await expect(hostPage.getByText(/Scan with your phone camera/i)).toBeVisible({
        timeout: 20_000,
      });
      await demoPause(hostPage, adminPage);

      const phonePage = await hostPage.context().newPage();
      await installHostVerificationMocks(phonePage, state, { noOrganization: true });
      await phonePage.goto('/verify/token-e2e-1');
      await completeIdentityCaptureOnPhone(phonePage);
      await demoPause(hostPage, adminPage);

      // The host window polls, sees completion, and closes the modal by itself.
      await expect(hostPage.getByRole('button', { name: /Verify with camera/i })).toBeVisible({
        timeout: 30_000,
      });
      await phonePage.close();

      await hostPage.locator('#onboarding-facebook-page').setInputFiles(E2E_IMAGE_FILE);
      await expect(hostPage.getByRole('button', { name: 'Finish setup' })).toBeEnabled({
        timeout: 20_000,
      });

      await hostPage.getByRole('button', { name: 'Finish setup' }).click();
      await expect
        .poll(() => state.baseStatus, { timeout: 30_000 })
        .toBe('pending');
      await demoPause(hostPage, adminPage);

      // ── Admin window: the pre-screened review ───────────────────────────────
      await adminPage.goto('/admin/approvals');
      const reviewRow = adminPage.locator('[aria-label="Review Test Host Org"]').first();
      await expect(reviewRow).toBeVisible({ timeout: 30_000 });
      await demoPause(adminPage);

      await reviewRow.click();
      await expect(adminPage.getByText('Identity check')).toBeVisible({ timeout: 20_000 });
      await expect(adminPage.getByText('PhilSys QR')).toBeVisible();
      await expect(adminPage.getByText('Device check')).toBeVisible();
      await demoPause(adminPage);

      await adminPage.getByRole('button', { name: 'Approve' }).click();
      await expect.poll(() => state.baseStatus, { timeout: 30_000 }).toBe('approved');
      expect(state.calls.approve).toHaveLength(1);
      await demoPause(adminPage, hostPage);

      // ── Host window: the approval is already reflected ──────────────────────
      await hostPage.goto('/org/test-host-org/activity');
      await expect(hostPage.getByRole('button', { name: /Get Recommended badge/i })).toBeVisible({
        timeout: 30_000,
      });
      await demoPause(hostPage);
    } finally {
      await closeHostAndAdminBrowsers(browsers);
    }
  });
});
