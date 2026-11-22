import { expect, test } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  TEAM_E2E_ORG_SLUG,
  TEAM_E2E_PROPERTY_SLUG,
} from '../team/shared/propertyTeamRbacHarness';

const INBOX = `/org/${TEAM_E2E_ORG_SLUG}/property/${TEAM_E2E_PROPERTY_SLUG}/messages`;

test.describe('@ci inbox deep links', () => {
  test('?conversationId opens that thread (the bookings list chat icon target)', async ({
    page,
  }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await page.goto(`${INBOX}?mock=true&conversationId=mock-fb-dm-unread&platform=facebook`);
    await expect(page.getByText('Org Meta')).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/conversationId=mock-fb-dm-unread/);
  });

  test('?messageId scrolls that chat pill into view then clears the param', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await page.goto(
      `${INBOX}?mock=true&conversationId=mock-fb-dm-unread&platform=facebook&messageId=m1`
    );
    const pill = page.locator('[data-chat-message-id="m1"]');
    await expect(pill).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const el = document.querySelector('[data-chat-message-id="m1"]');
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          return rect.top >= 0 && rect.bottom <= window.innerHeight;
        });
      })
      .toBe(true);
    await expect(page).not.toHaveURL(/messageId=/);
    await expect(page).toHaveURL(/conversationId=mock-fb-dm-unread/);
  });

  test('?search starts with the guest name typed in and filters the list', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await page.goto(`${INBOX}?mock=true&search=Maria`);
    const box = page.getByPlaceholder('Search messages');
    await expect(box).toHaveValue('Maria', { timeout: 20_000 });
    await expect(page.getByText('Maria Santos').first()).toBeVisible();
    await expect(page.getByText('James Lim')).toHaveCount(0);
  });

  test('an unknown ?platform is ignored instead of hiding every thread', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await page.goto(`${INBOX}?mock=true&platform=airbnb`);
    await expect(page.getByText('Maria Santos').first()).toBeVisible({ timeout: 20_000 });
  });
});
