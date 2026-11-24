import { expect, test } from '@playwright/test';

import {
  E2E_GUEST_PROPERTY_SLUG,
  GUEST_MESSAGES_E2E_PATH,
  installGuestMessagesMocks,
} from './shared/guestMessagesHarness';
import { INBOX_E2E_PATH, installInboxMocks } from './shared/inboxTourHarness';

/**
 * Messages module UX contracts.
 *
 * Host side runs on the in-repo mock inbox (`?mock=true`); guest side on a mocked
 * conversation. Both are fixture-driven, so a failure means the UI regressed, not that
 * local data changed.
 *
 * Audit + before/after evidence: docs/workflow/for-testing/messages-module-audit/
 */

const HOST_MESSAGES = `${INBOX_E2E_PATH}?mock=true`;

/** First paint of the lazy inbox chunk can take a few seconds on a cold dev server. */
async function openHostInbox(page: import('@playwright/test').Page) {
  await page.goto(HOST_MESSAGES);
  await expect(page.getByRole('button', { name: /Maria Santos/ }).first()).toBeVisible({
    timeout: 30_000,
  });
}

async function openGuestHub(page: import('@playwright/test').Page) {
  await page.goto(GUEST_MESSAGES_E2E_PATH);
  await expect(page.getByText('Solea Mactan').first()).toBeVisible({ timeout: 30_000 });
}

test.describe('@ci host messages module', () => {
  test.use({ viewport: { width: 1440, height: 960 } });

  test('thread list, filters, and composer render', async ({ page }) => {
    await installInboxMocks(page);
    await openHostInbox(page);

    await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Instagram' })).toBeVisible();
    await expect(page.getByPlaceholder('Search messages')).toBeVisible();
    await expect(page.getByRole('button', { name: /Maria Santos/ }).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test('opening a thread shows its messages and an accessible reply composer', async ({ page }) => {
    await installInboxMocks(page);
    await openHostInbox(page);
    await page
      .getByRole('button', { name: /Carlo Mendoza/ })
      .first()
      .click();

    await expect(page.getByPlaceholder('Write a reply…')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Send$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Insert quick reply' })).toBeVisible();
  });

  test('quick replies show the body preview', async ({ page }) => {
    await installInboxMocks(page);
    await openHostInbox(page);
    await page
      .getByRole('button', { name: /Carlo Mendoza/ })
      .first()
      .click();
    await page.getByRole('button', { name: 'Insert quick reply' }).click();

    const item = page.getByRole('menuitem', { name: /Availability/ });
    await expect(item).toBeVisible();
    await expect(item).toContainText(/Thanks for reaching out/i);
  });

  test('Manage opens the Channels panel with the Meta row', async ({ page }) => {
    await installInboxMocks(page);
    await openHostInbox(page);
    await page.getByRole('button', { name: 'Channels' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Facebook Messenger + Instagram DMs')).toBeVisible();
  });

  test('message actions open on hover for a guest bubble', async ({ page }) => {
    await installInboxMocks(page);
    await openHostInbox(page);
    await page
      .getByRole('button', { name: /Maria Santos/ })
      .first()
      .click();
    await page.locator('[data-chat-message-id]').first().hover();
    await page.getByRole('button', { name: 'Message actions' }).first().click();

    await expect(page.getByRole('menuitem', { name: 'Reply' })).toBeVisible();
  });

  test('a typed reply survives switching threads', async ({ page }) => {
    await installInboxMocks(page);
    await openHostInbox(page);

    await page
      .getByRole('button', { name: /Carlo Mendoza/ })
      .first()
      .click();
    const composer = page.getByPlaceholder('Write a reply…');
    await composer.fill('Draft for Carlo');
    await page
      .getByRole('button', { name: /Maria Santos/ })
      .first()
      .click();
    await expect(composer).toHaveValue('');
    await page
      .getByRole('button', { name: /Carlo Mendoza/ })
      .first()
      .click();

    await expect(composer).toHaveValue('Draft for Carlo');
  });

  test('deleting a shared quick reply asks first', async ({ page }) => {
    await installInboxMocks(page);
    await openHostInbox(page);
    const manage = page.getByRole('button', { name: 'Quick replies' });
    await expect(manage).toBeVisible({ timeout: 20_000 });
    await manage.click();
    await page.getByRole('button', { name: /^Delete Availability check$/ }).click();

    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText('every property');
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Availability check', { exact: true }).first()).toBeVisible();
  });
});

test.describe('@ci host messages module — phone', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('every platform tab fits the row', async ({ page }) => {
    await installInboxMocks(page);
    await openHostInbox(page);

    const tablist = page.getByRole('tablist', { name: 'Platform' });
    const overflow = await tablist.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const instagram = await page.getByRole('tab', { name: 'Instagram' }).boundingBox();
    const viewport = page.viewportSize()!;
    expect(instagram).not.toBeNull();
    expect(instagram!.x + instagram!.width).toBeLessThanOrEqual(viewport.width);
  });

  test('a search with no matches explains that no conversation matched', async ({ page }) => {
    await installInboxMocks(page);
    await openHostInbox(page);
    await page.getByPlaceholder('Search messages').fill('zzzzzz');

    await expect(page.getByText('No conversations match your search.')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('an open thread hides the channel tabs and the Quick Access button', async ({ page }) => {
    await installInboxMocks(page);
    await openHostInbox(page);
    await page
      .getByRole('button', { name: /Carlo Mendoza/ })
      .first()
      .click();
    await expect(page.getByPlaceholder('Write a reply…')).toBeVisible({ timeout: 20_000 });

    await expect(page.getByRole('tab', { name: 'Instagram' })).toBeHidden();
    await expect(page.getByRole('button', { name: /Quick access/i })).toHaveCount(0);

    await page.getByRole('button', { name: 'Back to list' }).click();
    await expect(page.getByRole('tab', { name: 'Instagram' })).toBeVisible();
  });

  test('insert opens a bottom sheet', async ({ page }) => {
    await installInboxMocks(page);
    await openHostInbox(page);
    await page
      .getByRole('button', { name: /Carlo Mendoza/ })
      .first()
      .click();
    await page.getByRole('button', { name: 'Insert link or info' }).click();

    const sheet = page.getByRole('dialog').filter({ hasText: 'Insert' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Property', exact: true })).toBeVisible();
  });

  test('message actions open a bottom sheet', async ({ page }) => {
    await installInboxMocks(page);
    await openHostInbox(page);
    await page
      .getByRole('button', { name: /Carlo Mendoza/ })
      .first()
      .click();
    await page.locator('[data-chat-message-id]').first().hover();
    await page.getByRole('button', { name: 'Message actions' }).first().click();

    const sheet = page.getByRole('dialog').filter({ hasText: 'Message' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('option', { name: 'Reply' })).toBeVisible();
  });
});

test.describe('@ci guest messages module', () => {
  test.use({ viewport: { width: 1440, height: 960 } });

  test('hub lists threads and opens the conversation', async ({ page }) => {
    await installGuestMessagesMocks(page);
    await openGuestHub(page);
    await page.getByText('Solea Mactan').first().click();
    await expect(page.getByPlaceholder('Message')).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText('Yes, early check-in is free if the unit is ready.').last()
    ).toBeVisible();
  });

  test('the browser tab is titled Messages', async ({ page }) => {
    await installGuestMessagesMocks(page);
    await openGuestHub(page);
    await expect(page).toHaveTitle(/Messages/);
  });

  test('the page exposes a Messages heading', async ({ page }) => {
    await installGuestMessagesMocks(page);
    await openGuestHub(page);
    await expect(page.getByRole('heading', { name: 'Messages' })).toHaveCount(1);
  });

  test('unread threads are announced, not just dotted', async ({ page }) => {
    await installGuestMessagesMocks(page);
    await openGuestHub(page);
    await expect(page.getByText('1 unread')).toBeVisible();
  });

  test('empty state offers a way back to listings', async ({ page }) => {
    await installGuestMessagesMocks(page, { empty: true });
    await page.goto(GUEST_MESSAGES_E2E_PATH);

    await expect(page.getByText('No messages yet')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('link', { name: 'Browse properties' })).toBeVisible();
  });
});

test.describe('@ci guest messages module — phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the composer is visible without scrolling the page', async ({ page }) => {
    await installGuestMessagesMocks(page);
    await page.goto(GUEST_MESSAGES_E2E_PATH);
    await expect(page.getByText('Solea Mactan').first()).toBeVisible({ timeout: 30_000 });
    const consent = page.getByRole('button', { name: 'Essential only' });
    if (await consent.count()) await consent.first().click();
    await page.getByText('Solea Mactan').first().click();

    const field = page.getByPlaceholder('Message');
    await expect(field).toBeVisible({ timeout: 15_000 });
    const box = await field.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);

    const dockTop = await page.evaluate(() => {
      const dock = document.querySelector('[data-bottom-tab-bar]');
      return dock ? dock.getBoundingClientRect().top : window.innerHeight;
    });
    expect(box!.y + box!.height).toBeLessThanOrEqual(dockTop - 8);
  });
});

test.describe('@ci guest property chat', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  const CHAT_PATH = `/properties/${E2E_GUEST_PROPERTY_SLUG}/messages?checkInDate=2026-12-01&checkOutDate=2026-12-03`;

  test('a failed start shows a friendly retry card, not the transport error', async ({ page }) => {
    await installGuestMessagesMocks(page, { startError: true });
    await page.goto(CHAT_PATH);

    await expect(page.getByText("We couldn't open this chat")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Failed to upsert conversation')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  test('a successful start opens the conversation', async ({ page }) => {
    await installGuestMessagesMocks(page);
    await page.goto(CHAT_PATH);

    await expect(page.getByPlaceholder('Message')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Sample Stays PH').first()).toBeVisible();
  });
});
