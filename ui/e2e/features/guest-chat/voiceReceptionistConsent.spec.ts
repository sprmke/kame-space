import { expect as baseExpect, test } from '@playwright/test';

import {
  installLiveBrowserMocks,
  installVoiceReceptionistMocks,
} from './shared/voiceReceptionistHarness';

// The mock voice stream and the lazy panel chunk both lose time on a loaded CI runner.
const expect = baseExpect.configure({ timeout: 20_000 });

test.describe.configure({ timeout: 90_000 });

test.describe('@smoke voice receptionist consent', () => {
  test('requires disclosure acceptance before requesting microphone access', async ({ page }) => {
    await installVoiceReceptionistMocks(page);
    await page.goto('/properties/solea/messages?checkInDate=2026-10-01&checkOutDate=2026-10-03');

    await page.getByRole('button', { name: 'Talk to Kame', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Kame, your AI receptionist' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/Kame answers with Google Gemini/)).toBeVisible();
    await expect(
      page
        .getByRole('heading', { name: 'Kame, your AI receptionist' })
        .locator('..')
        .getByRole('link', { name: 'Privacy' })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start call' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'End call' })).toHaveCount(0);
    const startCallBox = await page.getByRole('button', { name: 'Start call' }).boundingBox();
    expect(Math.round(startCallBox?.height ?? 0)).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => document.documentElement.clientWidth)
    );
    const viewport = page.viewportSize();
    if (viewport && viewport.height > viewport.width) {
      await page.setViewportSize({ width: viewport.height, height: viewport.width });
      await expect(page.getByRole('button', { name: 'Start call' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        await page.evaluate(() => document.documentElement.clientWidth)
      );
    }
  });

  test('recovers from denied microphone access with text handoff', async ({ page }) => {
    await installVoiceReceptionistMocks(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: () =>
            Promise.reject(new DOMException('Permission denied', 'NotAllowedError')),
        },
      });
    });
    await page.goto('/properties/solea/messages?checkInDate=2026-10-01&checkOutDate=2026-10-03');

    await page.getByRole('button', { name: 'Talk to Kame', exact: true }).click();
    await page.getByRole('button', { name: 'Start call' }).click();

    await expect(page.getByRole('alert')).toContainText('Microphone access is blocked');
    await expect(page.getByRole('button', { name: 'Message host' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  });

  test('shows streaming captions and safe server action cards', async ({ page }) => {
    await installVoiceReceptionistMocks(page, { liveSession: true });
    await installLiveBrowserMocks(page);
    await page.goto('/properties/solea/messages?checkInDate=2026-10-01&checkOutDate=2026-10-03');

    await page.getByRole('button', { name: 'Talk to Kame', exact: true }).click();
    await page.getByRole('button', { name: 'Start call' }).click();

    await expect(
      page.getByTestId('voice-caption').filter({ hasText: 'How can I help with your stay?' })
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open property' })).toHaveAttribute(
      'href',
      '/properties/solea'
    );
    await expect(page.getByRole('link', { name: 'Unsafe' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'End call' })).toBeVisible();
    await expect
      .poll(() => page.locator('html').getAttribute('data-mock-voice-connections'), {
        timeout: 30_000,
      })
      .toBe('2');
    await expect(
      page.getByTestId('voice-caption').filter({ hasText: 'How can I help with your stay?' })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Message host' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'End call and message' }).click();
    await expect(page.getByRole('heading', { name: 'Kame, your AI receptionist' })).toHaveCount(0);
  });

  test('falls back to text when the provider is unavailable', async ({ page }) => {
    await installVoiceReceptionistMocks(page, { providerUnavailable: true });
    await installLiveBrowserMocks(page);
    await page.goto('/properties/solea/messages?checkInDate=2026-10-01&checkOutDate=2026-10-03');

    await page.getByRole('button', { name: 'Talk to Kame', exact: true }).click();
    await page.getByRole('button', { name: 'Start call' }).click();

    await expect(page.getByRole('alert')).toContainText('temporarily unavailable');
    await expect(page.getByRole('button', { name: 'Message host' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  });

  test('ends cleanly at the server session limit', async ({ page }) => {
    await installVoiceReceptionistMocks(page, { liveSession: true, maxSessionSeconds: 1 });
    await installLiveBrowserMocks(page);
    await page.goto('/properties/solea/messages?checkInDate=2026-10-01&checkOutDate=2026-10-03');

    await page.getByRole('button', { name: 'Talk to Kame', exact: true }).click();
    await page.getByRole('button', { name: 'Start call' }).click();

    await expect(page.getByText('Call ended')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
  });

  test('ends an inactive call without losing its captions', async ({ page }) => {
    await installVoiceReceptionistMocks(page, { liveSession: true });
    await installLiveBrowserMocks(page);
    await page.goto('/properties/solea/messages?checkInDate=2026-10-01&checkOutDate=2026-10-03');

    await page.getByRole('button', { name: 'Talk to Kame', exact: true }).click();
    await page.getByRole('button', { name: 'Start call' }).click();
    await expect(
      page.getByTestId('voice-caption').filter({ hasText: 'How can I help with your stay?' })
    ).toBeVisible();
    await expect
      .poll(() => page.locator('html').getAttribute('data-mock-voice-connections'), {
        timeout: 30_000,
      })
      .toBe('2');

    await page.clock.install();
    await page.clock.fastForward(31_000);
    await expect(page.getByText(/Still there\?/)).toBeVisible();
    await page.clock.fastForward(15_000);

    await expect(page.getByText('Ended the call due to inactivity.')).toBeVisible();
    await expect(
      page.getByTestId('voice-caption').filter({ hasText: 'How can I help with your stay?' })
    ).toBeVisible();
  });

  test('ends with a text fallback when the connection stays offline', async ({ page, context }) => {
    await installVoiceReceptionistMocks(page, { liveSession: true });
    await installLiveBrowserMocks(page);
    await page.goto('/properties/solea/messages?checkInDate=2026-10-01&checkOutDate=2026-10-03');

    await page.getByRole('button', { name: 'Talk to Kame', exact: true }).click();
    await page.getByRole('button', { name: 'Start call' }).click();
    await expect(
      page.getByTestId('voice-caption').filter({ hasText: 'How can I help with your stay?' })
    ).toBeVisible();

    await page.clock.install();
    await context.setOffline(true);
    await expect(page.getByText('Waiting for your connection…')).toBeVisible();
    await page.clock.fastForward(11_000);

    await expect(page.getByRole('alert')).toContainText('You went offline');
    await expect(page.getByRole('button', { name: 'Message host' })).toBeVisible();
    await context.setOffline(false);
  });
});
