import { expect, test, type Page } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  teamRbacPaths,
} from '../team/shared/propertyTeamRbacHarness';

/**
 * Marketing Planner journeys. The edge function is mocked at the envelope level, so these
 * exercise the real tab, gate, item sheet and copy paths without a backend.
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
  items: [PLAN_ITEM],
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

/**
 * The RBAC harness owns the `**\/functions/v1/**` route. Registering a second catch-all would
 * shadow it (`continue()` skips later handlers), so this one falls back for every other
 * function and only answers `marketing-planner`.
 */
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

test.describe('@ci marketing planner', () => {
  test('Plan is the default tab and shows the dated agenda', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await mockPlanner(page);
    await page.goto(teamRbacPaths.marketingWorkspace);

    await expect(page.getByRole('tab', { name: /^Plan/ })).toHaveAttribute(
      'aria-selected',
      'true',
      { timeout: 20_000 }
    );
    await expect(page.getByRole('button', { name: 'Today' })).toBeVisible();
    await expect(page.getByText('Two nights are still open this weekend.').first()).toBeVisible();
    await expect(page.getByText('Open this weekend', { exact: true })).toBeVisible();
    await expect(page.getByText('12 page visits from this link')).toBeVisible();
  });

  test('range chips switch the window', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await mockPlanner(page);
    await page.goto(teamRbacPaths.marketingWorkspace);

    await page.getByRole('button', { name: 'Week' }).click();
    await expect(page).toHaveURL(/range=7d/);
  });

  test('opening an item shows the claim list and the draft fields', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await mockPlanner(page);
    await page.goto(teamRbacPaths.marketingWorkspace);

    await page.getByRole('button', { name: 'Create' }).first().click();
    await expect(page.getByText('what this says')).toBeVisible();
    await expect(page.getByText('Open: 2026-11-13, 2026-11-14')).toBeVisible();
    await expect(page.getByText('From 3200 a night')).toBeVisible();
    await expect(page.getByLabel('First line')).toHaveValue('Two nights left this weekend');
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('switching to AI Studio keeps the planner reachable', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await mockPlanner(page);
    await page.goto(teamRbacPaths.marketingWorkspace);

    await page.getByRole('tab', { name: /^AI Studio/ }).click();
    await expect(page.getByRole('heading', { name: 'What do you want to make?' })).toBeVisible();
    await page.getByRole('tab', { name: /^Plan/ }).click();
    await expect(page.getByText('Open this weekend', { exact: true })).toBeVisible();
  });
});
