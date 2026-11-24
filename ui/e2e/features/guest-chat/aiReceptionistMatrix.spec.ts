import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { expect as baseExpect, test } from '@playwright/test';

import {
  installLiveBrowserMocks,
  installVoiceReceptionistMocks,
  VOICE_CHAT_PATH,
} from './shared/voiceReceptionistHarness';
import { installAiControlsMocks } from '../admin/shared/aiControlsHarness';

import type { Page } from '@playwright/test';

/**
 * Captures the post-change UI at 375, 768, 1024 and 1440. Mirrors the before spec in the
 * `lungfish-ai-receptionist-before` worktree. Lane: @demo (never CI).
 */

const expect = baseExpect.configure({ timeout: 20_000 });

const WIDTHS = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 960 },
] as const;

const DIR = path.resolve(
  process.cwd(),
  process.env.AI_RECEPTIONIST_MATRIX_DIR ?? 'test-results/ai-receptionist-matrix/after'
);
mkdirSync(DIR, { recursive: true });

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(DIR, `${name}.png`), animations: 'disabled' });
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
  await expect(page.getByText('Listening', { exact: true })).toBeVisible();
}

test.describe.configure({ timeout: 120_000 });

test.describe('@demo new receptionist matrix', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('kh-cookie-consent', 'declined');
      } catch {
        // private mode
      }
    });
  });

  test('entry', async ({ page }) => {
    await installVoiceReceptionistMocks(page);
    for (const size of WIDTHS) {
      await page.setViewportSize(size);
      await page.goto(VOICE_CHAT_PATH);
      await expect(talkButton(page)).toBeVisible();
      await expect(page.getByRole('button', { name: /AI voice receptionist/ })).toBeVisible();
      await shot(page, `after-entry-${size.width}`);
    }
  });

  test('disclosure', async ({ page }) => {
    await installVoiceReceptionistMocks(page);
    for (const size of WIDTHS) {
      await page.setViewportSize(size);
      await openPanel(page);
      await shot(page, `after-disclosure-${size.width}`);
    }
  });

  test('in call near the cap and the handoff dialog', async ({ page }) => {
    await installVoiceReceptionistMocks(page, { liveSession: true, maxSessionSeconds: 50 });
    await installLiveBrowserMocks(page);
    for (const size of WIDTHS) {
      await page.setViewportSize(size);
      await openPanel(page);
      await startCall(page);
      await expect(page.getByText('About a minute left.')).toBeVisible();
      await shot(page, `after-in-call-${size.width}`);
      await page.getByRole('button', { name: 'Message host' }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await shot(page, `after-handoff-${size.width}`);
      await page.getByRole('button', { name: 'Keep talking' }).click();
      await page.getByRole('button', { name: 'End call' }).click();
      await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
    }
  });

  test('ended state with the delete confirmation', async ({ page }) => {
    await installVoiceReceptionistMocks(page, { liveSession: true });
    await installLiveBrowserMocks(page);
    for (const size of WIDTHS) {
      await page.setViewportSize(size);
      await openPanel(page);
      await startCall(page);
      await page.getByRole('button', { name: 'End call' }).click();
      await expect(page.getByText('Call ended', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Delete captions' }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await shot(page, `after-ended-${size.width}`);
    }
  });

  test('mic blocked', async ({ page }) => {
    await installVoiceReceptionistMocks(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: () => Promise.reject(new DOMException('Denied', 'NotAllowedError')),
        },
      });
    });
    for (const size of WIDTHS) {
      await page.setViewportSize(size);
      await openPanel(page);
      await page.getByRole('button', { name: 'Start call' }).click();
      await expect(page.getByText('Microphone blocked', { exact: true })).toBeVisible();
      await shot(page, `after-mic-blocked-${size.width}`);
    }
  });

  test('super admin controls and the number grid', async ({ page }) => {
    const patches: Array<Record<string, unknown>> = [];
    await installAiControlsMocks(page, patches);
    for (const size of WIDTHS) {
      await page.setViewportSize(size);
      await page.goto('/admin/ai?tab=controls');
      await expect(page.getByText('Platform AI', { exact: true })).toBeVisible();
      await shot(page, `after-controls-top-${size.width}`);

      const daily = page.locator('#ai-daily-calls');
      await daily.scrollIntoViewIfNeeded();
      await daily.fill('0');
      await page.keyboard.press('Tab');
      await expect(page.getByText('Enter 1 or more.')).toBeVisible();
      await shot(page, `after-numbers-${size.width}`);
    }
  });
});
