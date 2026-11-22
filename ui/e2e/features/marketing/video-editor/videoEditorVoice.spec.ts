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
    await page.waitForTimeout(1200);
    await panel.getByRole('button', { name: 'Stop recording' }).tap();
    await expect(items).toHaveCount(before + 1, { timeout: 20_000 });
  });
});
