import { expect, test } from '@playwright/test';

import {
  installPlansDowngradeMocks,
  openOrgPlansPage,
  openPlanChange,
  PLAN_GROWTH,
  PLAN_PRO,
  PLAN_STARTER,
} from '../shared/orgPlanDowngradeHarness';

/** Both plans end Sep 1, 2026 in the harness. */
const END = 'Sep 1, 2026';

test.describe('@ci org plan scheduled downgrade and cancel', () => {
  test('a lower plan is scheduled for the period end and can be kept', async ({ page }) => {
    const state = await installPlansDowngradeMocks(page, { subscriptionPlanId: PLAN_GROWTH });
    await openOrgPlansPage(page);

    await openPlanChange(page, 'Starter', 'Switch at renewal');
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Downgrade to Starter' })).toBeVisible();
    await expect(dialog).toContainText(`Takes effect on ${END}`);
    await expect(dialog).toContainText('You keep Pro until then');
    await expect(dialog).toContainText(`Turns off on ${END}`);
    // Nothing is charged and nothing turns off today.
    await expect(dialog.getByRole('button', { name: 'Continue to payment' })).toHaveCount(0);

    await dialog.getByRole('button', { name: `Switch on ${END}` }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(state.changeCalls).toEqual([{ action: 'schedule_downgrade', planId: PLAN_STARTER }]);

    // The summary says the change is coming and the current plan stays.
    await page.getByRole('tab', { name: 'Billing' }).click();
    await expect(page.getByText(`Changes to Starter on ${END}`)).toBeVisible();
    await expect(page.getByText(`You keep Pro until ${END}.`)).toBeVisible();
    // The Starter card shows when it starts and is no longer clickable.
    await page.getByRole('tab', { name: 'Plans' }).click();
    await expect(page.getByText('Starts Sep 1').first()).toBeVisible();

    // Changing your mind is one click.
    await page.getByRole('button', { name: 'Keep Pro' }).click();
    await expect(page.getByText(`Changes to Starter on ${END}`)).toHaveCount(0);
    expect(state.changeCalls.at(-1)).toEqual({ action: 'clear_intent' });
  });

  test('canceling waits for the period end, shows what turns off, and can be resumed', async ({
    page,
  }) => {
    const state = await installPlansDowngradeMocks(page, { subscriptionPlanId: PLAN_PRO });
    await openOrgPlansPage(page);

    await openPlanChange(page, 'Free', 'Cancel plan');
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: /^Cancel / })).toBeVisible();
    await expect(dialog).toContainText(`Your plan ends on ${END}`);
    await expect(dialog).toContainText(`Turns off on ${END}`);
    await dialog.getByLabel('It costs too much').click();
    await dialog.getByRole('button', { name: `Cancel on ${END}` }).click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(state.changeCalls).toEqual([
      { action: 'cancel_at_period_end', reason: 'too_expensive' },
    ]);

    await page.getByRole('tab', { name: 'Billing' }).click();
    await expect(page.getByText(`Ends ${END}`).first()).toBeVisible();
    await expect(page.getByText(/Moves to Free on Sep 1, 2026/)).toBeVisible();
    await page.getByRole('button', { name: 'Resume plan' }).click();
    await expect(page.getByText(`Ends ${END}`)).toHaveCount(0);
  });

  test('an overdue plan cannot schedule a downgrade but can end now', async ({ page }) => {
    const state = await installPlansDowngradeMocks(page, {
      subscriptionPlanId: PLAN_GROWTH,
      subscriptionStatus: 'past_due',
    });
    await openOrgPlansPage(page, 'billing');
    await expect(page.getByText(/Pay by Sep 6, 2026/)).toBeVisible();

    await page.getByRole('tab', { name: 'Plans' }).click();
    await openPlanChange(page, 'Starter', 'Switch at renewal');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Pay the overdue balance before changing your plan.');
    await expect(dialog.getByRole('button', { name: /^Switch on/ })).toHaveCount(0);
    // The footer button and the corner X share the name; either closes the dialog.
    await dialog.getByRole('button', { name: 'Close' }).first().click();

    await openPlanChange(page, 'Free', 'Cancel plan');
    await expect(
      page.getByRole('dialog').getByRole('heading', { name: /^End .* now$/ })
    ).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'End plan now' }).click();
    expect(state.changeCalls).toEqual([{ action: 'cancel_now', reason: null }]);
  });

  test('a suspended plan explains the pause and when it ends', async ({ page }) => {
    await installPlansDowngradeMocks(page, {
      subscriptionPlanId: PLAN_GROWTH,
      subscriptionStatus: 'suspended',
    });
    await openOrgPlansPage(page, 'billing');
    await expect(page.getByText('Suspended').first()).toBeVisible();
    await expect(page.getByText(/the plan ends and the organization stays on Free/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pay now' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Switch to Free' })).toBeVisible();
  });

  test('members see the billing state but no actions', async ({ page }) => {
    await installPlansDowngradeMocks(page, {
      accessKind: 'member',
      subscriptionPlanId: PLAN_GROWTH,
      subscriptionStatus: 'past_due',
    });
    await openOrgPlansPage(page, 'billing');
    await expect(page.getByText('Only the organization owner can change billing.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pay now' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cancel plan' })).toHaveCount(0);
  });
});
