import { expect, test } from '@playwright/test';

import {
  installPlansCheckoutMocks,
  openOrgPlansBilling,
  openUpgradeReview,
  PLAN_GROWTH,
  PLAN_STARTER,
} from '../shared/orgPlanCheckoutHarness';

test.describe('@ci org plan billing flows', () => {
  test.setTimeout(75_000);

  test('a price that moved since the review is refused with the fresh amount', async ({ page }) => {
    const state = await installPlansCheckoutMocks(page, {
      subscriptionPlanId: PLAN_STARTER,
      priceChangesTo: 999,
    });

    await openOrgPlansBilling(page);
    await page.getByRole('tab', { name: 'Plans' }).click();
    await openUpgradeReview(page, 'Pro');
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Continue to payment' }).click();

    // The dialog stays open, says what changed and shows the new amount to confirm.
    await expect(
      dialog.getByRole('alert').filter({ hasText: 'price changed to ₱999' })
    ).toBeVisible();
    await expect(dialog.getByText('Due today').locator('..')).toContainText('₱999');
    expect(state.checkoutCalls).toEqual([PLAN_GROWTH]);
    await expect(page).not.toHaveURL(/checkout=/);
  });

  test('account credit that covers the change applies it with no payment step', async ({
    page,
  }) => {
    const state = await installPlansCheckoutMocks(page, {
      subscriptionPlanId: PLAN_STARTER,
      coveredByCredit: true,
    });

    await openOrgPlansBilling(page);
    await page.getByRole('tab', { name: 'Plans' }).click();
    await openUpgradeReview(page, 'Pro');
    const dialog = page.getByRole('dialog');

    await expect(dialog.getByText('Paid with account credit')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Continue to payment' })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Apply with credit' }).click();

    await expect(page.getByText('Plan updated using your account credit')).toBeVisible();
    await expect(page).not.toHaveURL(/checkout/);
    expect(state.subscriptionPlanId).toBe(PLAN_GROWTH);
  });

  test('billing details save, then leaving with unsaved edits asks first', async ({ page }) => {
    const state = await installPlansCheckoutMocks(page, { subscriptionPlanId: PLAN_STARTER });

    await openOrgPlansBilling(page);
    await page.getByRole('button', { name: 'Add' }).click();
    const save = page.getByRole('button', { name: 'Save details' });
    await expect(save).toBeDisabled();

    await page.getByLabel('Legal name').fill('Sample Stays Holdings Inc.');
    await page.getByLabel('Billing email').fill('billing@samplestays.test');
    await expect(save).toBeEnabled();
    await save.click();

    await expect.poll(() => state.billingDetailsSaves.length).toBe(1);
    expect(state.billingDetailsSaves[0]).toMatchObject({
      legalName: 'Sample Stays Holdings Inc.',
      billingEmail: 'billing@samplestays.test',
    });
    // Successful save collapses the form; reopen to edit again.
    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(save).toBeDisabled();

    // A new edit is unsaved: navigating away prompts, Keep editing stays put.
    await page.getByLabel('Address').fill('12 Mactan Road, Lapu-Lapu City');
    await page.getByRole('link', { name: 'Team' }).click();
    const prompt = page.getByRole('alertdialog');
    await expect(prompt.getByText('Save your changes?')).toBeVisible();
    await prompt.getByRole('button', { name: 'Keep editing' }).click();
    await expect(page.getByLabel('Address')).toHaveValue('12 Mactan Road, Lapu-Lapu City');

    await page.getByRole('link', { name: 'Team' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Discard' }).click();
    await expect(page).toHaveURL(/\/team/);
    expect(state.billingDetailsSaves).toHaveLength(1);
  });

  test('a bad TIN is rejected inline before anything is sent', async ({ page }) => {
    const state = await installPlansCheckoutMocks(page, { subscriptionPlanId: PLAN_STARTER });

    await openOrgPlansBilling(page);
    await page.getByRole('button', { name: 'Add' }).click();
    await page.getByLabel('TIN').fill('12');
    await page.getByRole('button', { name: 'Save details' }).click();

    await expect(page.getByRole('alert').filter({ hasText: /TIN/i })).toBeVisible();
    expect(state.billingDetailsSaves).toHaveLength(0);
  });

  test('members see billing details but cannot edit them', async ({ page }) => {
    await installPlansCheckoutMocks(page, {
      accessKind: 'member',
      subscriptionPlanId: PLAN_STARTER,
      billingDetails: {
        legalName: 'Sample Stays Holdings Inc.',
        address: null,
        tin: null,
        billingEmail: null,
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    });

    await openOrgPlansBilling(page);
    await page.locator('[aria-controls="billing-details-panel"]').click();
    await expect(page.getByLabel('Legal name')).toHaveValue('Sample Stays Holdings Inc.');
    await expect(page.getByLabel('Legal name')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Save details' })).toHaveCount(0);
  });
});
