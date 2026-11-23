import { expect, test, type Page } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  teamRbacPaths,
} from '../team/shared/propertyTeamRbacHarness';

/**
 * Marketing Planner journeys. The edge function is mocked at the envelope level, so these
 * exercise the Plan button, modal, gate, item sheet and copy paths without a backend.
 */

const PLAN_ITEM = {
  id: '11111111-1111-4111-8111-111111111111',
  short_code: 'abcd2345',
  opportunity_type: 'weekend_open',
  opportunity_key: 'weekend_open:2026-11-13',
  title: 'Open this weekend',
  pillar: 'offers',
  channel_kind: 'facebook_page',
  manual_targets: [],
  format: 'post',
  scheduled_for: '2026-11-11T09:00:00+08:00',
  post_by: '2026-11-11T23:59:59+08:00',
  target_from: '2026-11-13',
  target_to: '2026-11-15',
  claims: { openNights: ['2026-11-13', '2026-11-14'], rateFrom: 3200 },
  brief: {
    hook: 'Two nights left this weekend',
    message: 'Nov 13 and Nov 14 are still open.',
    cta: 'Book the weekend',
    why: 'Both nights that weekend are open.',
  },
  status: 'planned',
  status_reason: null,
  tracked_url: '/properties/demo-stay?utm_source=facebook_page&utm_campaign=ks-abcd2345',
  posted_url: null,
  results: { trackedVisits: 12 },
};

const MANUAL_ITEM = {
  ...PLAN_ITEM,
  id: '33333333-3333-4333-8333-333333333333',
  opportunity_key: 'gap_nights:2026-11-17',
  title: 'One night open',
  channel_kind: 'facebook_group',
  manual_targets: ['Tagaytay Rentals'],
  format: 'story',
  results: { trackedVisits: 0 },
};

const PLAN_PAYLOAD = {
  range: '7d',
  from: '2026-11-09',
  to: '2026-11-15',
  plan: {
    id: '22222222-2222-4222-8222-222222222222',
    horizon_start: '2026-11-09',
    horizon_end: '2026-12-09',
    mode: 'rules',
    trigger: 'host',
    playbook_version: '2026-11-09.1',
    summary: 'Two nights are still open this weekend.',
    created_at: '2026-11-09T08:00:00+08:00',
    superseded_at: null,
  },
  items: [PLAN_ITEM, MANUAL_ITEM],
  upcoming: [],
  summary: 'Two nights are still open this weekend.',
};

const SETTINGS_PAYLOAD = {
  settings: {
    property_id: 'property-e2e',
    goals: ['fill_open_nights'],
    cadence_preset: 'steady',
    channels: [],
    language: 'en',
    onboarded_at: '2026-11-01T00:00:00+08:00',
  },
};

/** The analytics consent bar sits above the page and swallows clicks until answered. */
async function dismissCookieConsent(page: Page) {
  const essentialOnly = page.getByRole('button', { name: 'Essential only' });
  if (await essentialOnly.isVisible().catch(() => false)) {
    await essentialOnly.click();
  }
}

async function mockPlanner(page: Page) {
  await page.route('**/functions/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.includes('/functions/v1/marketing-planner')) {
      await route.fallback();
      return;
    }
    const payload = url.searchParams.get('view') === 'settings' ? SETTINGS_PAYLOAD : PLAN_PAYLOAD;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: payload }),
    });
  });
}

async function openPlanner(page: Page) {
  await page.getByRole('button', { name: /^Plan/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 20_000 });
}

test.describe('@ci marketing planner', () => {
  test('studio keeps four creative tabs and opens Plan from the page action', async ({
    page,
  }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await mockPlanner(page);
    await page.goto(teamRbacPaths.marketingWorkspace);
    await dismissCookieConsent(page);

    await expect(page.getByRole('tab', { name: /^AI Studio/ })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('tab', { name: /^Plan/ })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: /^Posts/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Videos/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Calendar/ })).toBeVisible();

    await openPlanner(page);
    await expect(page).toHaveURL(/plan=1/);
    const planDialog = page.getByRole('dialog', { name: 'What to post' });
    await expect(planDialog.getByRole('heading', { name: 'What to post' })).toBeVisible();
    await expect(planDialog.getByText('What to post next, and why')).toBeVisible();
    await expect(planDialog.getByText('Two nights are still open this weekend.')).toBeVisible();
    await expect(planDialog.getByText('Open this weekend', { exact: true })).toBeVisible();
    await expect(planDialog.getByText('Both nights that weekend are open.').first()).toBeVisible();
    await expect(planDialog.getByText('12 visits from this link')).toBeVisible();
    await expect(planDialog.getByRole('button', { name: 'Make this' }).first()).toBeVisible();
  });

  test('legacy ?tab=plan deep link opens the planner modal', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await mockPlanner(page);
    await page.goto(`${teamRbacPaths.marketingWorkspace}&tab=plan&range=today`);
    await dismissCookieConsent(page);

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/plan=1/);
    await expect(page).not.toHaveURL(/tab=plan/);
  });

  test('range chips switch the window', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await mockPlanner(page);
    await page.goto(`${teamRbacPaths.marketingWorkspace}&plan=1`);
    await dismissCookieConsent(page);

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('tab', { name: 'Week', exact: true }).click();
    await expect(page).toHaveURL(/range=7d/);
  });

  test('opening an item shows the claim list and edit behind Edit copy', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await mockPlanner(page);
    await page.goto(`${teamRbacPaths.marketingWorkspace}&plan=1`);
    await dismissCookieConsent(page);

    await expect(page.getByRole('dialog', { name: 'What to post' })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: 'Open this weekend options' }).click();
    await page.getByRole('option', { name: 'Edit details' }).click();
    const itemSheet = page.getByRole('dialog').filter({ hasText: 'Why this post' });
    await expect(itemSheet.getByText('Why this post')).toBeVisible();
    await expect(itemSheet.getByText('Open: 2026-11-13, 2026-11-14', { exact: true })).toBeVisible();
    await expect(itemSheet.getByText('From 3200 a night')).toBeVisible();
    await itemSheet.getByRole('button', { name: 'Edit copy' }).click();
    await expect(itemSheet.getByLabel('First line')).toHaveValue('Two nights left this weekend');
    await expect(itemSheet.getByRole('button', { name: 'Save' })).toBeDisabled();
    await itemSheet.getByRole('button', { name: 'Cancel' }).click();
  });

  test('prepare week opens from plan options overflow', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await mockPlanner(page);
    await page.goto(`${teamRbacPaths.marketingWorkspace}&plan=1`);
    await dismissCookieConsent(page);

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Plan options' }).click();
    await page.getByRole('option', { name: 'Prepare week' }).click();
    const dialog = page.getByRole('dialog').filter({ hasText: /items need a design/ });
    await expect(dialog.getByText(/items need a design, video or calendar/)).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Start' })).toBeEnabled();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
  });

  test('setup opens from plan options overflow', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await mockPlanner(page);
    await page.goto(`${teamRbacPaths.marketingWorkspace}&plan=1`);
    await dismissCookieConsent(page);

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Plan options' }).click();
    await page.getByRole('option', { name: 'Goals & channels' }).click();
    await expect(page.getByText('What matters most right now?')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('share it yourself opens with the caption and the host places', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await mockPlanner(page);
    await page.goto(`${teamRbacPaths.marketingWorkspace}&plan=1`);
    await dismissCookieConsent(page);

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'One night open options' }).click();
    await page.getByRole('option', { name: 'I posted it' }).click();
    const shareSheet = page.getByRole('dialog', { name: 'Share it yourself' });
    await expect(shareSheet).toBeVisible();
    await expect(shareSheet.getByText('Tagaytay Rentals')).toBeVisible();
    await expect(shareSheet.getByRole('button', { name: 'Copy caption' })).toBeVisible();
    await expect(shareSheet.getByRole('button', { name: 'I posted it' })).toBeVisible();
  });

  test('closing the planner returns to the creative tabs', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await mockPlanner(page);
    await page.goto(`${teamRbacPaths.marketingWorkspace}&plan=1`);
    await dismissCookieConsent(page);

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page).not.toHaveURL(/plan=1/);
    await expect(page.getByRole('tab', { name: /^AI Studio/ })).toBeVisible();
  });

  test('captures planner screenshots at 375 and 1024', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await mockPlanner(page);

    for (const { width, height, label } of [
      { width: 1024, height: 768, label: '1024' },
      { width: 375, height: 812, label: '375' },
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto(teamRbacPaths.marketingWorkspace);
      await dismissCookieConsent(page);
      await expect(page.getByRole('tab', { name: /^AI Studio/ })).toBeVisible({
        timeout: 20_000,
      });
      await page.screenshot({ path: `test-results/marketing-planner-studio-${label}.png` });

      await openPlanner(page);
      const planDialog = page.getByRole('dialog', { name: 'What to post' });
      await expect(planDialog).toBeVisible();
      await expect(
        planDialog.getByRole('button', { name: /^(Build plan|Rebuild plan)$/ })
      ).toBeVisible();
      await expect(planDialog.getByText('Open this weekend', { exact: true })).toBeVisible();
      await expect(planDialog.getByText('Two nights are still open this weekend.')).toBeVisible();
      await page.screenshot({ path: `test-results/marketing-planner-modal-${label}.png` });
      // Header Close is always mounted (sheet chrome hides only the default drawer X).
      await planDialog.getByRole('button', { name: 'Close' }).click();
      await expect(planDialog).toBeHidden();
    }
  });
});
