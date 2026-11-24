import { expect as baseExpect, test } from '@playwright/test';

import {
  installLiveBrowserMocks,
  installVoiceReceptionistMocks,
  VOICE_CHAT_PATH,
} from './shared/voiceReceptionistHarness';

import type { Page } from '@playwright/test';

// Audio setup plus the lazy panel chunk can be slow on a loaded CI runner.
const expect = baseExpect.configure({ timeout: 20_000 });

const talkButton = (page: Page) =>
  page.getByRole('button', { name: 'Talk to Kame', exact: true });
const starterCard = (page: Page) =>
  page.getByRole('button', { name: /AI voice receptionist/ });

async function openPanel(page: Page) {
  await page.goto(VOICE_CHAT_PATH);
  await talkButton(page).click();
  await expect(page.getByRole('heading', { name: 'Kame, your AI receptionist' })).toBeVisible();
}

async function startCall(page: Page) {
  await page.getByRole('button', { name: 'Start call' }).click();
  await expect(page.getByText('Listening', { exact: true })).toBeVisible();
}

test.describe.configure({ timeout: 90_000 });

test.describe('@ci ai receptionist phase 1 and 2', () => {
  test('offers the receptionist from the header and the empty thread', async ({ page }) => {
    await installVoiceReceptionistMocks(page);
    await page.goto(VOICE_CHAT_PATH);

    await expect(talkButton(page)).toBeVisible();
    await expect(starterCard(page)).toBeVisible();
    await starterCard(page).click();
    await expect(page.getByRole('heading', { name: 'Kame, your AI receptionist' })).toBeVisible();
    await expect(page.getByText(/AI can make mistakes/)).toBeVisible();
    await expect(page.getByText(/Captions are saved with this call/)).toBeVisible();

    await page.getByRole('button', { name: 'Not now' }).click();
    await expect(talkButton(page)).toBeFocused();

    await talkButton(page).click();
    await expect(page.getByRole('heading', { name: 'Kame, your AI receptionist' })).toBeVisible();
  });

  test('the panel takes over the chat header and moves focus into itself', async ({ page }) => {
    await installVoiceReceptionistMocks(page);
    await page.goto(VOICE_CHAT_PATH);
    await expect(page.getByRole('link', { name: 'Back to property' })).toBeVisible();
    await talkButton(page).click();
    await expect(page.getByRole('heading', { name: 'Kame, your AI receptionist' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to property' })).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.classList.contains('voice-panel')))
      .toBe(true);
  });

  test('covers the phone chrome while a call is active', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await installVoiceReceptionistMocks(page, { liveSession: true });
    await installLiveBrowserMocks(page);
    await openPanel(page);
    await startCall(page);

    const panel = page.locator('.voice-panel');
    await expect(panel).toHaveAttribute('aria-modal', 'true');
    await expect
      .poll(() => page.evaluate(() => document.getElementById('root')?.hasAttribute('inert')))
      .toBe(true);
    const box = await panel.boundingBox();
    expect(Math.round(box?.x ?? -1)).toBe(0);
    expect(Math.round(box?.y ?? -1)).toBe(0);
    expect(Math.round(box?.width ?? 0)).toBe(375);
    expect(Math.round(box?.height ?? 0)).toBe(812);
    expect(
      await page.evaluate(
        () => document.elementFromPoint(187, 780)?.closest('.voice-panel') !== null
      )
    ).toBe(true);

    await page.getByRole('button', { name: 'End call' }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(talkButton(page)).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.getElementById('root')?.hasAttribute('inert')))
      .toBe(false);
  });

  test('asks before deleting the transcript', async ({ page }) => {
    const actions: string[] = [];
    await installVoiceReceptionistMocks(page, { liveSession: true });
    await page.route('**/functions/v1/voice-receptionist-session', async (route) => {
      const body = JSON.parse(route.request().postData() ?? '{}') as { action?: string };
      if (body.action) actions.push(body.action);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { updated: true } }),
      });
    });
    await installLiveBrowserMocks(page);
    await openPanel(page);
    await startCall(page);
    await page.getByRole('button', { name: 'End call' }).click();
    await expect(page.getByText('Call ended', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Delete captions' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Keep' }).click();
    await expect(page.getByRole('button', { name: 'Delete captions' })).toBeVisible();
    expect(actions).not.toContain('delete_transcript');

    await page.getByRole('button', { name: 'Delete captions' }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Delete captions' })).toHaveCount(0);
    await expect.poll(() => actions.includes('delete_transcript')).toBe(true);
  });

  test('asks before handing the guest to the host', async ({ page }) => {
    await installVoiceReceptionistMocks(page, { liveSession: true });
    await installLiveBrowserMocks(page);
    await openPanel(page);
    await startCall(page);

    await page.getByRole('button', { name: 'Message host' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Keep talking' }).click();
    await expect(page.getByRole('button', { name: 'End call' })).toBeVisible();

    await page.getByRole('button', { name: 'Message host' }).click();
    await page.getByRole('button', { name: 'End call and message' }).click();
    await expect(page.getByRole('heading', { name: 'Kame, your AI receptionist' })).toHaveCount(0);
  });

  test('names a blocked microphone instead of blaming the connection', async ({ page }) => {
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

    await expect(page.getByRole('alert')).toContainText('Microphone access is blocked');
    await expect(page.getByText('Microphone blocked', { exact: true })).toBeVisible();
    await expect(page.getByText('Connection issue')).toHaveCount(0);
  });

  test('shows time left and warns near the session cap', async ({ page }) => {
    await installVoiceReceptionistMocks(page, { liveSession: true, maxSessionSeconds: 50 });
    await installLiveBrowserMocks(page);
    await openPanel(page);
    await startCall(page);

    await expect(page.getByText('left', { exact: true })).toBeVisible();
    await expect(page.getByText('About a minute left.')).toBeVisible();
  });
});
