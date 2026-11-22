import { expect, test, type Page } from '@playwright/test';

import { asset, installMediaMocks, installTemplateMocks, openDraft } from './videoEditorHarness';
import {
  installPropertyTeamRbacMocks,
  teamRbacPaths,
} from '../../team/shared/propertyTeamRbacHarness';


/**
 * Phone editor behaviour that is easy to get wrong: trim, add-from-timeline, tapping text on the
 * preview, read-only roles and layout that must never overflow. Backend is mocked.
 */

test.describe('@ci marketing video editor v2 phone ux', () => {
  test.setTimeout(120_000);
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  const strip = (page: Page) => page.getByRole('toolbar', { name: 'Editor tools' });
  const clipTools = (page: Page) => page.getByRole('toolbar', { name: 'Clip tools' });

  test.beforeEach(async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installTemplateMocks(page);
    await installMediaMocks(page, [
      asset('a1', 'image', 'pool.jpg'),
      asset('v1', 'video', 'tour.mp4'),
    ]);
  });

  async function addVideo(page: Page) {
    await strip(page).getByRole('button', { name: 'Media' }).tap();
    await page
      .getByRole('toolbar', { name: 'Tool options' })
      .getByRole('button', { name: 'Photos and videos' })
      .tap();
    await page.getByRole('button', { name: 'Use tour.mp4' }).tap();
    await expect(clipTools(page).getByRole('button', { name: 'Trim' })).toBeVisible();
  }

  test('Trim shows the whole video and dragging a handle shortens what is kept', async ({
    page,
  }) => {
    await openDraft(page);
    await addVideo(page);
    await clipTools(page).getByRole('button', { name: 'Trim' }).tap();

    const panel = page.getByRole('region', { name: 'Trim' });
    await expect(panel.getByText('8.0s kept')).toBeVisible();
    const bar = panel.getByRole('group', { name: 'Part of the video to keep' });
    const box = (await bar.boundingBox())!;
    // Drag the right handle from the end of the bar to the middle.
    await page.mouse.move(box.x + box.width - 6, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();

    await expect(panel.getByText(/^[1-5]\.\ds kept$/)).toBeVisible();
    await panel.getByRole('button', { name: 'Close panel' }).tap();
    await expect(panel).toHaveCount(0);
  });

  test('the plus tile and the Add sound pill open the media sheet from the timeline', async ({
    page,
  }) => {
    await openDraft(page);
    await page.getByRole('button', { name: 'Add photos or videos' }).tap();
    await expect(page.getByRole('region', { name: 'Media library' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('region', { name: 'Media library' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Add sound' }).tap();
    await expect(page.getByRole('region', { name: 'Media library' })).toBeVisible();
  });

  test('tapping text on the preview selects it and a second tap edits it', async ({ page }) => {
    await openDraft(page);
    await strip(page).getByRole('button', { name: 'Text' }).tap();
    await page
      .getByRole('toolbar', { name: 'Tool options' })
      .getByRole('button', { name: 'Text styles' })
      .tap();
    await page.getByRole('button', { name: /Headline$/ }).tap();
    // Close the edit panel the add opened, so the next panel is the one the tap opens.
    await page
      .getByRole('region', { name: 'Edit text' })
      .getByRole('button', { name: 'Close panel' })
      .tap();
    await expect(page.getByRole('region', { name: 'Edit text' })).toHaveCount(0);

    const textBox = page.locator('[data-video-layer-box], [data-video-layer]').first();
    await expect(textBox).toBeVisible();
    await textBox.tap();
    await expect(page.getByRole('region', { name: 'Edit text' })).toBeVisible();
  });

  test('a new text is on screen right away, not hidden by its entrance animation', async ({
    page,
  }) => {
    await openDraft(page);
    await strip(page).getByRole('button', { name: 'Text' }).tap();
    await page
      .getByRole('toolbar', { name: 'Tool options' })
      .getByRole('button', { name: 'Add text' })
      .tap();
    // The playhead moved just past the entrance animation, so the text is fully drawn.
    await expect(page.getByLabel('Seek')).not.toHaveValue('0');
    await expect(page.getByRole('textbox', { name: 'Text' })).toHaveValue('Your headline');
  });

  test('nothing scrolls sideways and the tool strip stays inside the screen', async ({ page }) => {
    await openDraft(page);
    const overflow = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      inner: window.innerWidth,
    }));
    expect(overflow.scroll).toBeLessThanOrEqual(overflow.inner);
    const box = (await strip(page).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(overflow.inner + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(812);
  });

  test('every tool target is at least 44 px tall', async ({ page }) => {
    await openDraft(page);
    const heights = await strip(page)
      .getByRole('button')
      .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
    expect(heights.length).toBeGreaterThan(5);
    for (const height of heights) expect(height).toBeGreaterThanOrEqual(44);
  });
});

test.describe('@ci marketing video editor v2 phone extras', () => {
  test.setTimeout(90_000);
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('the Added toast sits below the top bar and Add more brings the sheet back', async ({
    page,
  }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installTemplateMocks(page);
    await installMediaMocks(page, [asset('a1', 'image', 'pool.jpg')]);
    await openDraft(page);
    await page.getByRole('button', { name: 'Add photos or videos' }).tap();
    await page.getByRole('button', { name: 'Use pool.jpg' }).tap();

    const toast = page.locator('[data-sonner-toast]', { hasText: 'Added' });
    await expect(toast).toBeVisible();
    // Below the 52 px top bar, so Export is never covered.
    await expect.poll(async () => (await toast.boundingBox())?.y ?? -99).toBeGreaterThanOrEqual(56);
    await toast.getByRole('button', { name: 'Add more' }).tap();
    await expect(page.getByRole('region', { name: 'Media library' })).toBeVisible();
  });
});

test.describe('@ci marketing video editor v2 landscape phone', () => {
  test.setTimeout(90_000);
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  test('asks to turn the phone upright and can be dismissed', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installTemplateMocks(page);
    await installMediaMocks(page, [asset('a1', 'image', 'pool.jpg')]);
    await page.goto(
      `${teamRbacPaths.marketingWorkspace}&tab=video&item=new&from=preset%3Aquiet-morning&size=instagram-story`
    );
    const hint = page.getByRole('dialog', { name: 'Turn your phone upright' });
    await expect(hint).toBeVisible({ timeout: 45_000 });
    await hint.getByRole('button', { name: 'Keep editing' }).tap();
    await expect(hint).toHaveCount(0);
  });
});

test.describe('@ci marketing video editor v2 desktop ux', () => {
  test.setTimeout(90_000);
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the rail has Audio and Captions, and the timeline toolbar stays on one row', async ({
    page,
  }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installTemplateMocks(page);
    await installMediaMocks(page, [asset('a1', 'image', 'pool.jpg')]);
    await openDraft(page);

    await expect(page.getByRole('tab', { name: 'Audio' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Captions' })).toBeVisible();
    const toolbar = page.getByRole('toolbar', { name: 'Timeline tools' });
    const box = (await toolbar.boundingBox())!;
    expect(box.height).toBeLessThan(56);

    // Audio opens the recorder in the rail; the record button is red.
    await page.getByRole('tab', { name: 'Audio' }).click();
    const record = page.getByRole('button', { name: 'Start recording' });
    await expect(record).toBeVisible();
    const color = await record.evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(color).toMatch(/rgb\(2[0-3]\d, 3\d, 3\d\)|rgb\(220, 38, 38\)/);
  });

  test('the history buttons live in the top bar only', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installTemplateMocks(page);
    await installMediaMocks(page, [asset('a1', 'image', 'pool.jpg')]);
    await openDraft(page);
    await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Redo' })).toHaveCount(1);
  });
});
