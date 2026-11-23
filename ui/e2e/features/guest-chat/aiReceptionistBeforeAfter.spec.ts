import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import {
  installLiveBrowserMocks,
  installVoiceReceptionistMocks,
  VOICE_CHAT_PATH,
} from './shared/voiceReceptionistHarness';
import { installAiControlsMocks } from '../admin/shared/aiControlsHarness';

import type { Page } from '@playwright/test';

/**
 * Captures the "after" state for every UI change in phase 1 and 2. The "before" files are the
 * committed originals under `docs/workflow/for-testing/assets/ai-receptionist-audit/`; the
 * gallery pairs them side by side.
 *
 * Lane: @demo (headed, never CI).
 */

const SHOT_DIR = path.resolve(
  process.cwd(),
  process.env.AI_RECEPTIONIST_BEFORE_AFTER ?? 'test-results/ai-receptionist-after'
);
mkdirSync(SHOT_DIR, { recursive: true });

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), animations: 'disabled' });
}

const talkButton = (page: Page) =>
  page.getByRole('button', { name: 'Talk to Kame', exact: true });

async function openPanel(page: Page) {
  await page.goto(VOICE_CHAT_PATH);
  await talkButton(page).click();
  await expect(page.getByRole('heading', { name: 'Kame, your AI receptionist' })).toBeVisible();
}

async function startCall(page: Page) {
  await page.getByRole('button', { name: 'Start call' }).click();
  await expect(page.getByText('Listening', { exact: true })).toBeVisible({ timeout: 20_000 });
}

test.describe.configure({ timeout: 120_000 });

test.describe('@demo ai receptionist after states', () => {
  test('A1 discovery', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await installVoiceReceptionistMocks(page);
    await page.goto(VOICE_CHAT_PATH);
    await expect(talkButton(page)).toBeVisible();
    await expect(page.getByRole('button', { name: /AI voice receptionist/ })).toBeVisible();
    await shot(page, 'after-a1-discovery-1440');
  });

  test('A2 immersive call on phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await installVoiceReceptionistMocks(page, { liveSession: true });
    await installLiveBrowserMocks(page);
    await openPanel(page);
    await startCall(page);
    await shot(page, 'after-a2-immersive-375');
  });

  test('A3 delete confirmation', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await installVoiceReceptionistMocks(page, { liveSession: true });
    await installLiveBrowserMocks(page);
    await openPanel(page);
    await startCall(page);
    await page.getByRole('button', { name: 'End call' }).click();
    await expect(page.getByText('Call ended', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Delete captions' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await shot(page, 'after-a3-delete-confirm-1440');
  });

  test('A4 microphone label', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await installVoiceReceptionistMocks(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: () => Promise.reject(new DOMException('Denied', 'NotAllowedError')),
        },
      });
    });
    await openPanel(page);
    await page.getByRole('button', { name: 'Start call' }).click();
    await expect(page.getByText('Microphone blocked', { exact: true })).toBeVisible();
    await shot(page, 'after-a4-mic-blocked-1440');
  });

  test('A5 timer and cap warning', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await installVoiceReceptionistMocks(page, { liveSession: true, maxSessionSeconds: 50 });
    await installLiveBrowserMocks(page);
    await openPanel(page);
    await startCall(page);
    await expect(page.getByText('About a minute left.')).toBeVisible();
    await shot(page, 'after-a5-timer-1440');
  });

  test('A6 disclosure copy', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await installVoiceReceptionistMocks(page);
    await openPanel(page);
    await shot(page, 'after-a6-disclosure-1440');
  });

  test('B1 invalid number field', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const patches: Array<Record<string, unknown>> = [];
    await installAiControlsMocks(page, patches);
    const daily = page.locator('#ai-daily-calls');
    await daily.scrollIntoViewIfNeeded();
    await daily.fill('0');
    await page.keyboard.press('Tab');
    await expect(page.getByText('Enter 1 or more.')).toBeVisible();
    await shot(page, 'after-b1-invalid-1440');
  });

  test('B2 phone tabs', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const patches: Array<Record<string, unknown>> = [];
    await installAiControlsMocks(page, patches);
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, 'after-b2-tabs-375');
  });

  test('B4 handoff confirmation', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await installVoiceReceptionistMocks(page, { liveSession: true });
    await installLiveBrowserMocks(page);
    await openPanel(page);
    await startCall(page);
    await page.getByRole('button', { name: 'Message host' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await shot(page, 'after-b4-handoff-confirm-1440');
  });

  test('B5 desktop composition', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await installVoiceReceptionistMocks(page, { liveSession: true });
    await installLiveBrowserMocks(page);
    await openPanel(page);
    await startCall(page);
    await shot(page, 'after-b5-composition-1440');
  });
});
