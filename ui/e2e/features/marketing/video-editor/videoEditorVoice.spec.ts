import { expect, test, type Route } from '@playwright/test';

import { asset, installMediaMocks, installTemplateMocks, openDraft } from './videoEditorHarness';
import { installPropertyTeamRbacMocks } from '../../team/shared/propertyTeamRbacHarness';

/**
 * Voice recording on a phone. Chromium gets a fake microphone, so the permission prompt and the
 * recorder run for real; only the backend is mocked.
 */
test.use({
  viewport: { width: 375, height: 812 },
  hasTouch: true,
  isMobile: true,
  permissions: ['microphone'],
  launchOptions: {
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  },
});

test.describe('@ci marketing video editor v2 voice on a phone', () => {
  test.setTimeout(120_000);
  test('record a voice, save it and see it on the timeline', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installTemplateMocks(page);
    await installMediaMocks(page, [asset('a1', 'image', 'pool.jpg')]);
    const voice = asset('voice1', 'audio', 'Voice.webm');
    // The same file is "already in the library": the upload finishes without a transfer.
    await page.route('**/functions/v1/marketing-media/reserve**', (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { deduped: true, asset: voice } }),
      })
    );
    await openDraft(page);

    const items = page.locator('[data-timeline-item]');
    const before = await items.count();
    await page
      .getByRole('toolbar', { name: 'Editor tools' })
      .getByRole('button', { name: 'Audio' })
      .tap();
    await page
      .getByRole('toolbar', { name: 'Tool options' })
      .getByRole('button', { name: 'Record voice' })
      .tap();

    const panel = page.getByRole('region', { name: 'Record voice' });
    await panel.getByRole('button', { name: 'Start recording' }).tap();
    await expect(panel.getByRole('timer')).toBeVisible({ timeout: 15_000 });
    // Let it record for a moment: the clock moves past one second.
    await expect(panel.getByRole('timer')).toHaveText(/Recording 0:0[1-9]/);
    await panel.getByRole('button', { name: 'Stop recording' }).tap();
    await expect(items).toHaveCount(before + 1, { timeout: 20_000 });
  });
});

/** A real 16-bit mono WAV, so the browser decodes it for real. A steady tone stands in for speech. */
function toneWav(seconds: number, sampleRate = 16_000): Buffer {
  const samples = Math.round(seconds * sampleRate);
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + samples * 2, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i += 1) {
    buffer.writeInt16LE(
      Math.round(Math.sin((2 * Math.PI * 220 * i) / sampleRate) * 12_000),
      44 + i * 2
    );
  }
  return buffer;
}

test.describe('@ci marketing video editor v2 auto captions on a phone', () => {
  test.setTimeout(150_000);

  test('record a voice, make captions from it, then proofread and delete them', async ({
    page,
  }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installTemplateMocks(page);
    await installMediaMocks(page, [asset('a1', 'image', 'pool.jpg')]);
    const voice = asset('voice1', 'audio', 'Voice.webm');
    await page.route('**/functions/v1/marketing-media/reserve**', (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { deduped: true, asset: voice } }),
      })
    );
    // The voice file the editor will read to build the captions audio.
    await page.route('**/favicon.ico?asset=voice1', (route: Route) =>
      route.fulfill({ status: 200, contentType: 'audio/wav', body: toneWav(3) })
    );
    let sentAudio = 0;
    await page.route('**/functions/v1/marketing-video-captions**', async (route: Route) => {
      sentAudio = route.request().postDataBuffer()?.length ?? 0;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            language: 'english',
            words: [
              { text: 'Welcome', startMs: 200, endMs: 700 },
              { text: 'to', startMs: 700, endMs: 900 },
              { text: 'our', startMs: 900, endMs: 1100 },
              { text: 'place', startMs: 1100, endMs: 1600 },
            ],
          },
        }),
      });
    });
    await openDraft(page);

    // Record a voice (fake microphone).
    const strip = page.getByRole('toolbar', { name: 'Editor tools' });
    await strip.getByRole('button', { name: 'Audio' }).tap();
    await page
      .getByRole('toolbar', { name: 'Tool options' })
      .getByRole('button', { name: 'Record voice' })
      .tap();
    const panel = page.getByRole('region', { name: 'Record voice' });
    await panel.getByRole('button', { name: 'Start recording' }).tap();
    await expect(panel.getByRole('timer')).toBeVisible({ timeout: 15_000 });
    // Let it record for a moment: the clock moves past one second.
    await expect(panel.getByRole('timer')).toHaveText(/Recording 0:0[1-9]/);
    await panel.getByRole('button', { name: 'Stop recording' }).tap();

    // The new voice clip is selected: its tools offer captions.
    const tools = page.getByRole('toolbar', { name: 'Clip tools' });
    await expect(tools.getByRole('button', { name: 'Make captions' })).toBeVisible({
      timeout: 20_000,
    });
    await tools.getByRole('button', { name: 'Make captions' }).tap();

    const dialog = page.getByRole('dialog', { name: 'Auto captions' });
    await expect(dialog.getByRole('radio', { name: /Voice/ })).toBeChecked();
    await dialog.getByRole('button', { name: 'Make captions' }).tap();

    // One line appears on the timeline, from the words the service returned.
    await expect(page.getByRole('button', { name: /Caption, Welcome to our place/ })).toBeVisible({
      timeout: 30_000,
    });
    expect(sentAudio).toBeGreaterThan(1000);

    // Proofread: fix a word, and the line follows.
    await page
      .getByRole('toolbar', { name: 'Clip tools' })
      .getByRole('button', { name: 'Done' })
      .tap();
    await strip.getByRole('button', { name: 'Text' }).tap();
    await page
      .getByRole('toolbar', { name: 'Tool options' })
      .getByRole('button', { name: 'Edit captions' })
      .tap();
    const edit = page.getByRole('dialog', { name: 'Edit captions' });
    const field = edit.getByRole('textbox').first();
    await field.fill('Welcome to our home');
    await edit.getByRole('button', { name: 'Delete all captions' }).tap();
    await expect(page.getByRole('button', { name: /Caption, / })).toHaveCount(0);
  });
});
