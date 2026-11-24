import { expect, test } from '@playwright/test';

import { GUEST_MESSAGES_E2E_PATH, installGuestMessagesMocks } from './shared/guestMessagesHarness';
import { demoPause, dismissConsent, INBOX_E2E_PATH, installInboxMocks } from './shared/inboxTourHarness';

/**
 * Slow-motion walkthrough of the Messages module: host Guest Inbox and the guest
 * Messages hub. @demo — headed, never CI.
 *
 *   bun run test:e2e:messages:tour:video
 *
 * Videos land in `test-results/playwright/<scenario>/video.webm`.
 * Audit notes: docs/workflow/for-testing/messages-module-audit/README.md
 */

const HOST_MESSAGES = `${INBOX_E2E_PATH}?mock=true`;

test.describe('messages tour @demo', () => {
  test.use({ viewport: { width: 1440, height: 960 }, actionTimeout: 8_000 });

  test('01 host inbox: channels, list, filters, and search', async ({ page }) => {
    test.setTimeout(300_000);
    await installInboxMocks(page);
    await page.goto(HOST_MESSAGES);
    await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible({
      timeout: 30_000,
    });
    await dismissConsent(page);
    await demoPause(page, 1.6);

    // Platform tabs, one at a time.
    for (const tab of ['Chat', 'Facebook', 'Instagram', 'All']) {
      await page.getByRole('tab', { name: tab }).click();
      await demoPause(page, 1.1);
    }
    await demoPause(page, 0.6);

    // Thread list scan.
    for (const name of ['Maria Santos', 'James Lim', 'Carlo Mendoza']) {
      await expect(page.getByText(name).first()).toBeVisible();
      await page.getByText(name).first().hover();
      await demoPause(page, 0.7);
    }

    // Status filters.
    for (const filter of ['Unread', 'Pending', 'Replied', 'All']) {
      await page.getByRole('button', { name: filter, exact: true }).first().click();
      await demoPause(page, 0.9);
    }

    // Search, then the empty result.
    const search = page.getByPlaceholder('Search messages');
    await search.fill('maria');
    await demoPause(page, 1.4);
    await search.fill('zzzz');
    await demoPause(page, 1.6);
    await search.fill('');
    await demoPause(page, 0.8);
  });

  test('02 host inbox: conversation, composer, quick replies, insert menu', async ({ page }) => {
    test.setTimeout(300_000);
    await installInboxMocks(page);
    await page.goto(HOST_MESSAGES);
    await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible({
      timeout: 30_000,
    });
    await dismissConsent(page);
    await demoPause(page, 1.2);

    await page.getByText('Maria Santos').click();
    await demoPause(page, 1.8);

    // Per-message actions.
    await page.locator('[data-chat-message-id]').first().hover();
    await demoPause(page, 0.8);
    await page.getByRole('button', { name: 'Message actions' }).first().click();
    await demoPause(page, 1.2);
    await page.keyboard.press('Escape');
    await demoPause(page, 0.5);

    // Quick reply menu.
    await page.getByRole('button', { name: 'Insert quick reply' }).click();
    await demoPause(page, 1.4);
    await page.keyboard.press('Escape');
    await demoPause(page, 0.5);

    // Insert (+) menu, when the thread resolves a property.
    const insert = page.getByRole('button', { name: 'Insert link or info' });
    if ((await insert.count()) > 0) {
      await insert.click();
      await demoPause(page, 1.8);
      await page.keyboard.press('Escape');
      await demoPause(page, 0.5);
    }

    // Compose a reply.
    const composer = page.getByPlaceholder('Write a reply…');
    await composer.click();
    await demoPause(page, 0.4);
    await page.keyboard.type('Hi Maria, yes it is available for those dates.');
    await demoPause(page, 1.6);
  });

  test('03 host manage: channels, quick replies, automation', async ({ page }) => {
    test.setTimeout(300_000);
    await installInboxMocks(page);
    await page.goto(HOST_MESSAGES);
    await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible({
      timeout: 30_000,
    });
    await dismissConsent(page);
    await demoPause(page, 1);

    for (const [button, title] of [
      ['Channels', 'Channels'],
      ['Quick replies', 'Quick replies'],
      ['Automation', 'Automation'],
    ] as const) {
      await page.getByRole('button', { name: button }).first().click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByText(title, { exact: true })).toBeVisible();
      await demoPause(page, 1.8);
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await demoPause(page, 0.8);
    }

    // Quick reply editor and its unsaved-changes guard.
    await page.getByRole('button', { name: 'Quick replies' }).first().click();
    await demoPause(page, 1.2);
    await page.getByRole('button', { name: 'New reply' }).click();
    await demoPause(page, 1.4);
    await page.getByLabel('Title').fill('Sample availability reply');
    await demoPause(page, 1.2);
    await page.keyboard.press('Escape');
    await demoPause(page, 1.6);
    await page.getByRole('button', { name: 'Keep editing' }).click();
    await demoPause(page, 1.4);
    await page.keyboard.press('Escape');
    await demoPause(page, 0.6);
    await page.getByRole('button', { name: 'Discard' }).click();
    await demoPause(page, 1.2);
    await page.keyboard.press('Escape');
    await demoPause(page, 0.8);
  });

  test('04 guest messages: hub and conversation', async ({ page }) => {
    test.setTimeout(300_000);
    await installGuestMessagesMocks(page);
    await page.goto(GUEST_MESSAGES_E2E_PATH);
    await dismissConsent(page);
    await expect(page.getByText('Solea Mactan').first()).toBeVisible({ timeout: 30_000 });
    await demoPause(page, 1.8);

    await page.getByText('Solea Mactan').first().click();
    await demoPause(page, 2);

    // Chat options (search lives behind the sheet on phone, menu on desktop).
    const options = page.getByRole('button', { name: /chat options|more/i }).last();
    if ((await options.count()) > 0) {
      await options.click();
      await demoPause(page, 1.4);
      await page.keyboard.press('Escape');
      await demoPause(page, 0.6);
    }

    const composer = page.getByPlaceholder('Message');
    await composer.click();
    await page.keyboard.type('Thanks, see you on the 1st!');
    await demoPause(page, 1.6);
  });

  test('05 host inbox on a phone', async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await installInboxMocks(page);
    await page.goto(HOST_MESSAGES);
    await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible({
      timeout: 30_000,
    });
    await dismissConsent(page);
    await demoPause(page, 1.6);

    // Hero actions sheet.
    await page.getByRole('button', { name: /Inbox actions/i }).click();
    await demoPause(page, 1.8);
    await page.keyboard.press('Escape');
    await demoPause(page, 0.6);

    // Thread list, filters, platform tabs.
    await page.getByRole('tab', { name: 'Facebook' }).click();
    await demoPause(page, 1.4);
    await page.getByRole('tab', { name: 'All' }).click();
    await demoPause(page, 1);

    // Open the conversation.
    await page.getByText('Maria Santos').first().click();
    await demoPause(page, 2);

    // Composer + quick reply sheet.
    await page.getByRole('button', { name: 'Insert quick reply' }).click();
    await demoPause(page, 1.8);
    await page.keyboard.press('Escape');
    await demoPause(page, 0.6);

    const insert = page.getByRole('button', { name: 'Insert link or info' });
    if ((await insert.count()) > 0) {
      await insert.click();
      await demoPause(page, 1.8);
      await page.keyboard.press('Escape');
      await demoPause(page, 0.6);
    }
  });

  test('06 guest messages on a phone', async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await installGuestMessagesMocks(page);
    await page.goto(GUEST_MESSAGES_E2E_PATH);
    await dismissConsent(page);
    await expect(page.getByText('Solea Mactan').first()).toBeVisible({ timeout: 30_000 });
    await demoPause(page, 1.8);

    await page.getByText('Solea Mactan').first().click();
    await demoPause(page, 2);

    // Scroll to the composer (it sits below the fold today).
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight }));
    await demoPause(page, 1.6);

    const composer = page.getByPlaceholder('Message');
    await composer.click();
    await page.keyboard.type('Thanks, see you soon!');
    await demoPause(page, 1.6);

    await page.getByRole('button', { name: /chat options|more/i }).last().click();
    await demoPause(page, 1.6);
  });
});
