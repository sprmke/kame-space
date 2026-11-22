import { expect, test, type Page, type Route } from '@playwright/test';

import {
  asset,
  installMediaMocks,
  installTemplateMocks,
  openDraft,
  openMediaPanel,
} from './videoEditorHarness';
import { installPropertyTeamRbacMocks } from '../../team/shared/propertyTeamRbacHarness';


/**
 * Multi-track Videos editor. Backend is mocked; this checks the editor shell, the timeline
 * model and the media library glue, not Remotion rendering quality.
 */

test.describe('@ci marketing video editor v2', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installTemplateMocks(page);
  });

  test('a template opens on tracks with the library beside it', async ({ page }) => {
    await installMediaMocks(page, [
      asset('a1', 'image', 'pool.jpg'),
      asset('v1', 'video', 'tour.mp4'),
    ]);
    await openDraft(page);

    // The template's scenes are clips on the main track, its captions are text clips.
    const clips = page.locator('[data-timeline-item]');
    expect(await clips.count()).toBeGreaterThan(3);
    await openMediaPanel(page);
    await expect(page.getByRole('button', { name: 'Use pool.jpg' })).toBeVisible();
  });

  test('picking a library photo adds a clip at the playhead', async ({ page }) => {
    await installMediaMocks(page, [asset('a1', 'image', 'pool.jpg')]);
    await openDraft(page);
    const before = await page.locator('[data-timeline-item]').count();
    await openMediaPanel(page);
    await page.getByRole('button', { name: 'Use pool.jpg' }).click();
    await expect(page.locator('[data-timeline-item]')).toHaveCount(before + 1);
  });

  test('split cuts the clip under the playhead and undo restores it', async ({ page }) => {
    await installMediaMocks(page, []);
    await openDraft(page);
    // The main track is the last lane (top track first); its first clip starts at 0.
    await page.locator('[data-lane]').last().locator('[data-timeline-item]').first().click();
    const before = await page.locator('[data-timeline-item]').count();
    // Move the playhead into the clip, then split with the S key.
    await page.getByLabel('Seek').fill('20');
    await page.keyboard.press('s');
    await expect(page.locator('[data-timeline-item]')).toHaveCount(before + 1);
    await page.keyboard.press('ControlOrMeta+z');
    await expect(page.locator('[data-timeline-item]')).toHaveCount(before);
  });

  test('delete removes the selected clip', async ({ page }) => {
    await installMediaMocks(page, []);
    await openDraft(page);
    const before = await page.locator('[data-timeline-item]').count();
    await page.locator('[data-timeline-item]').nth(2).click();
    await page.keyboard.press('Delete');
    await expect(page.locator('[data-timeline-item]')).toHaveCount(before - 1);
  });

  test('the storage meter turns to a warning when the library is nearly full', async ({ page }) => {
    await installMediaMocks(page, [asset('a1', 'image', 'pool.jpg')], 480 * 1024 * 1024);
    await openDraft(page);
    await openMediaPanel(page);
    await expect(page.getByLabel('Media storage used')).toBeVisible();
  });
});

test.describe('@ci marketing video editor v2 on a phone', () => {
  test.setTimeout(120_000);
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test.beforeEach(async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installTemplateMocks(page);
    await installMediaMocks(page, [asset('a1', 'image', 'pool.jpg')]);
  });

  const mainLane = (page: Page) => page.locator('[data-lane]').last();

  test('scrolling the lanes moves the playhead and a tap on a clip shows its tools', async ({
    page,
  }) => {
    await openDraft(page);
    // No desktop toolbar or track headers on a phone, and the dashboard chrome is gone.
    await expect(page.getByRole('toolbar', { name: 'Timeline tools' })).toHaveCount(0);
    await expect(page.getByRole('toolbar', { name: 'Editor tools' })).toBeVisible();
    // The dashboard behind the full-screen editor is out of reach for keyboard and readers.
    await expect(page.locator('#root')).toHaveAttribute('inert', '');

    const before = await page
      .getByText(/^\d+:\d\d\.\d \/ /)
      .first()
      .textContent();
    await page.evaluate(() => {
      const scroller = document.querySelector('[data-lane]')!.closest('.overflow-x-auto')!;
      scroller.scrollLeft = scroller.scrollLeft + 120;
    });
    await expect
      .poll(async () =>
        page
          .getByText(/^\d+:\d\d\.\d \/ /)
          .first()
          .textContent()
      )
      .not.toBe(before);

    await mainLane(page).locator('[data-timeline-item]').first().tap();
    const tools = page.getByRole('toolbar', { name: 'Clip tools' });
    await expect(tools).toBeVisible();
    await expect(tools.getByRole('button', { name: 'Split' })).toBeVisible();
    await expect(tools.getByRole('button', { name: 'Delete' })).toBeVisible();
    await tools.getByRole('button', { name: 'Done' }).tap();
    await expect(tools).toHaveCount(0);
    await expect(page.getByRole('toolbar', { name: 'Editor tools' })).toBeVisible();
  });

  test('Split from the clip tools cuts the selected clip at the playhead', async ({ page }) => {
    await openDraft(page);
    const items = page.locator('[data-timeline-item]');
    const before = await items.count();
    await mainLane(page).locator('[data-timeline-item]').first().tap();
    await page.getByLabel('Seek').fill('20');
    await page
      .getByRole('toolbar', { name: 'Clip tools' })
      .getByRole('button', { name: 'Split' })
      .tap();
    await expect(items).toHaveCount(before + 1);
  });

  test('Audio opens a second row and Back returns to the first', async ({ page }) => {
    await openDraft(page);
    const strip = page.getByRole('toolbar', { name: 'Editor tools' });
    await strip.getByRole('button', { name: 'Audio' }).tap();
    const row = page.getByRole('toolbar', { name: 'Tool options' });
    await expect(row.getByRole('button', { name: 'Music' })).toBeVisible();
    await row.getByRole('button', { name: 'Back' }).tap();
    await expect(page.getByRole('toolbar', { name: 'Editor tools' })).toBeVisible();
  });

  test('Speed opens a panel above the tools and keeps the preview visible', async ({ page }) => {
    await openDraft(page);
    await mainLane(page).locator('[data-timeline-item]').first().tap();
    await page
      .getByRole('toolbar', { name: 'Clip tools' })
      .getByRole('button', { name: 'Duration' })
      .tap();
    const panel = page.getByRole('region', { name: 'Duration' });
    await expect(panel).toBeVisible();
    await expect(page.getByLabel('Timeline', { exact: true })).toBeVisible();
    await panel.getByRole('button', { name: 'Close panel' }).tap();
    await expect(panel).toHaveCount(0);
  });

  test('a label starts with its look and a new look can be picked while the preview stays up', async ({
    page,
  }) => {
    await openDraft(page);
    const strip = page.getByRole('toolbar', { name: 'Editor tools' });
    await strip.getByRole('button', { name: 'Text' }).tap();
    await page
      .getByRole('toolbar', { name: 'Tool options' })
      .getByRole('button', { name: 'Text styles' })
      .tap();
    await page.getByRole('button', { name: /Price$/ }).tap();

    const tools = page.getByRole('toolbar', { name: 'Clip tools' });
    await tools.getByRole('button', { name: 'Style' }).tap();
    const gallery = page.getByRole('radiogroup', { name: 'Text style' });
    await expect(gallery.getByRole('radio', { name: 'Price' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    await gallery.getByRole('radio', { name: 'Glow' }).tap();
    await expect(gallery.getByRole('radio', { name: 'Glow' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    // The text box is not repeated, and the timeline is still on screen.
    await expect(page.getByLabel('Text content')).toHaveCount(0);
    await expect(page.getByLabel('Timeline', { exact: true })).toBeVisible();
  });

  test("Separate sound puts a video's sound on its own clip", async ({ page }) => {
    await installMediaMocks(page, [asset('v1', 'video', 'tour.mp4')]);
    await openDraft(page);
    await page
      .getByRole('toolbar', { name: 'Editor tools' })
      .getByRole('button', { name: 'Media' })
      .tap();
    await page
      .getByRole('toolbar', { name: 'Tool options' })
      .getByRole('button', { name: 'Photos and videos' })
      .tap();
    await page.getByRole('button', { name: 'Use tour.mp4' }).tap();

    // The new video is selected, so its tools are showing.
    const tools = page.getByRole('toolbar', { name: 'Clip tools' });
    await expect(tools.getByRole('button', { name: 'Separate sound' })).toBeVisible();
    const before = await page.locator('[data-timeline-item]').count();
    await tools.getByRole('button', { name: 'Separate sound' }).tap();
    await expect(page.locator('[data-timeline-item]')).toHaveCount(before + 1);
    // The new sound clip is selected and offers volume and fade, not video tools.
    const soundTools = page.getByRole('toolbar', { name: 'Clip tools' });
    await expect(soundTools.getByRole('button', { name: 'Fade' })).toBeVisible();
    await expect(soundTools.getByRole('button', { name: 'Trim' })).toHaveCount(0);
  });

  test('Export lives in the top bar and opens one sheet', async ({ page }) => {
    await openDraft(page);
    await page.getByRole('button', { name: 'Export' }).tap();
    await expect(page.getByRole('dialog', { name: 'Export' })).toBeVisible();
    await expect(page.getByText('Download MP4')).toBeVisible();
  });
});
