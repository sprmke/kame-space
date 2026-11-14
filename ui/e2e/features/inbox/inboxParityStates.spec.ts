import { expect, test } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  TEAM_E2E_ORG_SLUG,
  TEAM_E2E_PROPERTY_SLUG,
} from '../team/shared/propertyTeamRbacHarness';

/**
 * The Meta parity surfaces: what the host sees when Meta truncated a thread, when another app
 * owns the chat, when Business Suite sent a reply, and when a send was rejected.
 *
 * Preview mode (`?mock=true`) seeds the states, so these cover the rendering rules without a
 * live Page.
 */

const INBOX_URL = `/org/${TEAM_E2E_ORG_SLUG}/property/${TEAM_E2E_PROPERTY_SLUG}/inbox?mock=true`;
const ALEX = 'Alex Rivera';

async function openInbox(page: import('@playwright/test').Page) {
  await installPropertyTeamRbacMocks(page, 'full_access');
  await page.goto(INBOX_URL);
  await expect(page.getByRole('heading', { name: 'Guest Inbox' })).toBeVisible({
    timeout: 20_000,
  });
}

test.describe('@ci inbox meta parity states', () => {
  test('status pill is visible and explains how the inbox works', async ({ page }) => {
    await openInbox(page);

    const pill = page.getByRole('button', { name: /Meta sync status:/ });
    await expect(pill).toBeVisible();
    await pill.click();

    await page.getByRole('button', { name: 'How this inbox works' }).click();

    // The limits Meta imposes are the whole point of the sheet. Assert the body copy, not
    // the title: the pill's own button carries the same words, so the title is ambiguous.
    await expect(page.getByText('What it is')).toBeVisible();
    await expect(page.getByText(/only the latest 20/)).toBeVisible();
    await expect(page.getByText(/24 hours after the guest/)).toBeVisible();
  });

  test('a truncated thread shows a gap divider', async ({ page }) => {
    await openInbox(page);
    await page.getByText(ALEX).click();
    await expect(page.getByText('Some messages may be missing here')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('another app owning the chat is explained where the host meets it', async ({ page }) => {
    await openInbox(page);
    await page.getByText(ALEX).click();
    await expect(page.getByText(/Another app is answering this chat/)).toBeVisible({
      timeout: 15_000,
    });
  });

  test('a reply sent from Business Suite is labelled', async ({ page }) => {
    await openInbox(page);
    await page.getByText(ALEX).click();
    await expect(page.getByText('Sent from Meta')).toBeVisible({ timeout: 15_000 });
  });

  test('a rejected send shows Not sent with Retry', async ({ page }) => {
    await openInbox(page);
    await page.getByText(ALEX).click();
    await expect(page.getByText('Not sent')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Retry' }).first()).toBeVisible();
  });

  test('a Meta thread offers no Edit or Unsend', async ({ page }) => {
    await openInbox(page);
    await page.getByText(ALEX).click();

    // The failed outbound message is ours, so it has an actions menu; Edit and Unsend must
    // not be in it, because Meta has no API for either.
    const actions = page.getByRole('button', { name: 'Message actions' }).last();
    await expect(actions).toBeVisible({ timeout: 15_000 });
    await actions.click();

    await expect(page.getByRole('menuitem', { name: 'Reply' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Edit' })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'Unsend' })).toHaveCount(0);
  });
});
