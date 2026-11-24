import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { GUEST_MESSAGES_E2E_PATH, installGuestMessagesMocks } from './shared/guestMessagesHarness';
import { INBOX_E2E_PATH, installInboxMocks, settleForCapture } from './shared/inboxTourHarness';

/**
 * Messages module visual capture tool (not a CI gate).
 *
 * Captures the host Guest Inbox and the guest Messages hub across the widths the
 * module has to hold up at, so a UI change can be compared before/after without
 * clicking through the app by hand.
 *
 *   PLAYWRIGHT_CAPTURE_SCREENS=1 MESSAGES_CAPTURE_LABEL=before \
 *     bun run playwright test ui/e2e/features/inbox/messagesVisualCapture.spec.ts --project=chromium
 *
 * Output: `ui/e2e/artifacts/messages-ux/<label>/<width>/<scenario>.png`
 */

const captureEnabled = process.env.PLAYWRIGHT_CAPTURE_SCREENS === '1';
const label = process.env.MESSAGES_CAPTURE_LABEL ?? 'before';
const outRoot = join('ui', 'e2e', 'artifacts', 'messages-ux', label);

const WIDTHS = [
  { name: '320', width: 320, height: 780 },
  { name: '375', width: 375, height: 812 },
  { name: '390', width: 390, height: 844 },
  { name: '414', width: 414, height: 896 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 900 },
  { name: '1440', width: 1440, height: 960 },
  { name: '1920', width: 1920, height: 1080 },
] as const;

const HOST_MESSAGES = `${INBOX_E2E_PATH}?mock=true`;

/** Freeze motion so repeat runs are pixel-stable. */
async function stabilize(page: Page) {
  await page.addInitScript(() => {
    const style = document.createElement('style');
    style.textContent = `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `;
    const attach = () => document.head?.appendChild(style);
    if (document.head) attach();
    else document.addEventListener('DOMContentLoaded', attach, { once: true });
  });
}

async function dismissConsent(page: Page) {
  for (const name of ['Essential only', 'Necessary only', 'Accept all']) {
    const button = page.getByRole('button', { name });
    if (await button.isVisible().catch(() => false)) {
      await button.first().click();
      return;
    }
  }
}

async function shot(page: Page, width: string, scenario: string) {
  const dir = join(outRoot, width);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${scenario}.png`), fullPage: false });
}

test.describe('messages visual capture @demo', () => {
  test.skip(!captureEnabled, 'Set PLAYWRIGHT_CAPTURE_SCREENS=1 to capture');
  test.use({ actionTimeout: 15_000 });
  test.setTimeout(600_000);

  test('host inbox across widths', async ({ page }) => {
    await stabilize(page);
    await installInboxMocks(page);

    for (const { name, width, height } of WIDTHS) {
      await page.setViewportSize({ width, height });
      await page.goto(HOST_MESSAGES, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible({
        timeout: 30_000,
      });
      await dismissConsent(page);
      await expect(page.getByRole('button', { name: /Maria Santos/ }).first()).toBeVisible({
        timeout: 20_000,
      });
      await shot(page, name, 'host-list');

      // Search with no matches.
      await page.getByPlaceholder('Search messages').fill('zzzzzz');
      await settleForCapture(page, 400);
      await shot(page, name, 'host-search-empty');
      await page.getByPlaceholder('Search messages').fill('');
      await settleForCapture(page, 200);

      // Open a website chat thread (composer enabled).
      await page
        .getByRole('button', { name: /Carlo Mendoza/ })
        .first()
        .click();
      await expect(page.getByPlaceholder('Write a reply…')).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('[data-chat-message-id]').first()).toBeVisible({
        timeout: 20_000,
      });
      await shot(page, name, 'host-thread');

      // Quick replies picker.
      await page.getByRole('button', { name: 'Insert quick reply' }).click();
      await settleForCapture(page, 500);
      await shot(page, name, 'host-quick-replies');
      await page.keyboard.press('Escape');
      await settleForCapture(page, 300);
    }
  });

  test('host manage panels on desktop', async ({ page }) => {
    await stabilize(page);
    await installInboxMocks(page);
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(HOST_MESSAGES, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible({ timeout: 30_000 });
    await dismissConsent(page);
    await expect(page.getByRole('button', { name: /Maria Santos/ }).first()).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('button', { name: 'Quick replies' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await settleForCapture(page, 500);
    await shot(page, '1440', 'host-manage-quick-replies');
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Channels' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await settleForCapture(page, 500);
    await shot(page, '1440', 'host-manage-channels');
  });

  test('guest messages across widths', async ({ page }) => {
    await stabilize(page);
    await installGuestMessagesMocks(page);

    for (const { name, width, height } of WIDTHS) {
      await page.setViewportSize({ width, height });
      await page.goto(GUEST_MESSAGES_E2E_PATH, { waitUntil: 'domcontentloaded' });
      await expect(page.getByText('Solea Mactan').first()).toBeVisible({ timeout: 30_000 });
      await dismissConsent(page);
      await shot(page, name, 'guest-list');

      await page.getByText('Solea Mactan').first().click();
      await expect(page.getByPlaceholder('Message')).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('[data-chat-message-id]').first()).toBeVisible({
        timeout: 20_000,
      });
      await settleForCapture(page, 400);
      await shot(page, name, 'guest-thread');
    }
  });
});
