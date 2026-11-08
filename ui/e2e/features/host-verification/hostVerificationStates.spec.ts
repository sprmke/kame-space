import { expect, test } from '@playwright/test';

import {
  createHostVerificationState,
  E2E_IMAGE_FILE,
  installHostVerificationMocks,
} from './shared/hostVerificationHarness';

/**
 * Get Verified: every persisted state of the host verification record.
 *
 * The sidebar CTA only renders when the org has a verification record at all, so the
 * all-`none` case is onboarding-only by design and is covered there.
 */
test.describe('@ci host Get Verified states', () => {
  test('pending review renders read-only with no submit', async ({ page }) => {
    const state = createHostVerificationState({ baseStatus: 'pending' });
    await installHostVerificationMocks(page, state);

    await page.goto('/org/test-host-org/activity');
    const cta = page.getByRole('button', { name: /Verification in review/i });
    await expect(cta).toBeVisible({ timeout: 30_000 });
    // `evaluate` avoids the sidebar re-render racing the actionability check.
    await cta.evaluate((element) => (element as HTMLElement).click());

    // The modal opens on the Recommended step when Tier 2 is untouched; switch to Tier 1.
    await page
      .getByRole('navigation', { name: 'Verification tiers' })
      .getByRole('button', { name: /^Verified/ })
      .click();
    await expect(page.getByText(/Review usually takes a few hours up to 3 days/i)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: /Submit for review/i })).toHaveCount(0);
  });

  test('changes requested forces the modal and allows a resubmit', async ({ page }) => {
    const state = createHostVerificationState({
      baseStatus: 'rejected',
      baseRejectionKind: 'changes',
      baseRejectionReason: 'The ID photo is blurry. Please upload a clearer copy.',
      baseChangesRequestedDocs: ['validId'],
      assets: { validIdPath: null, socialProofPath: 'org/org-host-001/social_proof/facebook.png' },
    });
    await installHostVerificationMocks(page, state);

    await page.goto('/org/test-host-org/activity');

    // Changes requested force the modal open; there is no CTA to click.
    await expect(page.getByRole('dialog', { name: 'Changes requested' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText('What to update')).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText(/The ID photo is blurry\. Please upload a clearer copy\./i)
    ).toBeVisible();

    // Only the requested document is asked for.
    await page.locator('#onboarding-valid-id').setInputFiles(E2E_IMAGE_FILE);
    const resubmit = page.getByRole('button', { name: 'Resubmit' });
    await expect(resubmit).toBeEnabled({ timeout: 20_000 });

    // Picking a file can race the dialog's dismiss handling; keep editing if it prompts.
    const guard = page.getByRole('alertdialog', { name: /Save your changes\?/i });
    await guard.waitFor({ state: 'visible', timeout: 2_000 }).catch(() => undefined);
    if (await guard.isVisible().catch(() => false)) {
      await page.getByRole('button', { name: 'Keep editing' }).click();
      await expect(guard).toHaveCount(0);
    }

    const submitResponse = page.waitForResponse(
      (res) =>
        res.request().method() === 'POST' &&
        res.url().includes('/functions/v1/submit-org-verification') &&
        res.ok()
    );
    await resubmit.click();
    await submitResponse;

    expect(state.calls.submitOrg).toBe(1);
    expect(state.lastSubmitOrgBody).toMatchObject({ tier: 'base' });
    expect(state.calls.uploads).toContain('valid_id');
  });

  test('a declined verification locks the dashboard behind the rejection screen', async ({
    page,
  }) => {
    const state = createHostVerificationState({
      baseStatus: 'rejected',
      baseRejectionKind: 'rejected',
      baseRejectionReason: 'The document does not match the host name.',
    });
    await installHostVerificationMocks(page, state);

    await page.goto('/org/test-host-org/activity');

    // A hard reject redirects the whole org shell, so there is no sidebar CTA to click.
    await expect(page.getByRole('heading', { name: 'Verification declined' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/does not match the host name/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Submit for review/i })).toHaveCount(0);
  });

  test('tier 2 requires a selfie and warns before losing it', async ({ page }) => {
    const state = createHostVerificationState({
      baseStatus: 'approved',
      enhancedStatus: 'none',
      assets: {
        validIdPath: 'org/org-host-001/valid_id/valid-id.jpg',
        socialProofPath: 'org/org-host-001/social_proof/facebook.png',
      },
    });
    await installHostVerificationMocks(page, state);

    await page.goto('/org/test-host-org/activity');
    const cta = page.getByRole('button', { name: /Get Recommended badge/i });
    await expect(cta).toBeVisible({ timeout: 30_000 });
    await cta.evaluate((element) => (element as HTMLElement).click());

    await expect(page.getByRole('dialog', { name: 'Get Recommended' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/The selfie with your ID is required/i)).toBeVisible();

    const submit = page.getByRole('button', { name: /Submit for review/i });
    await expect(submit).toBeDisabled();

    await page.locator('#enhanced-selfie').setInputFiles(E2E_IMAGE_FILE);
    await expect(submit).toBeEnabled({ timeout: 20_000 });

    // Closing with an unsubmitted file must prompt, not silently discard.
    await page.keyboard.press('Escape');
    await expect(page.getByText(/Save your changes\?|Discard your changes\?/i)).toBeVisible({
      timeout: 10_000,
    });
    // The prompt itself is the contract: editing a slot and closing must not silently
    // discard. (Radix keeps the alert open until the host chooses.)
    await expect(page.getByRole('alertdialog', { name: /Save your changes\?/i })).toBeVisible();
    await expect(page.getByText(/You have unsaved changes/i)).toBeVisible();
  });
});
