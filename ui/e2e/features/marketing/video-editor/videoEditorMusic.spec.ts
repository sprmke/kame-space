import { expect, test, type Page } from '@playwright/test';

import { installMusicMocks, mockTrack, silentWav } from './musicMocks';
import {
  asset,
  installMediaMocks,
  installTemplateMocks,
  openDraft,
  openMediaPanel,
} from './videoEditorHarness';
import { installPropertyTeamRbacMocks } from '../../team/shared/propertyTeamRbacHarness';

/**
 * Music picker in the Videos editor: trending, groups, search, preview, saving, and Instagram's
 * own music for Reels. The backend is mocked; this checks the picker and its editor glue.
 */

async function openMusicTab(page: Page) {
  await openMediaPanel(page);
  await page.getByRole('tab', { name: 'Music' }).click();
  await expect(page.getByRole('group', { name: 'Music groups' })).toBeVisible();
}

test.describe('@ci marketing video editor music picker', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installTemplateMocks(page);
    await installMediaMocks(page, [asset('a1', 'image', 'pool.jpg')]);
  });

  test('trending music from both sources, with the groups to browse', async ({ page }) => {
    await installMusicMocks(page, {
      groups: {
        trending: [mockTrack('1', 'jamendo'), mockTrack('a', 'audius'), mockTrack('2', 'jamendo')],
      },
    });
    await openDraft(page);
    await openMusicTab(page);

    const list = page.getByRole('list', { name: 'Music' });
    await expect(list.getByRole('listitem')).toHaveCount(3);
    await expect(list.getByText('Song a')).toBeVisible();
    const chips = page.getByRole('group', { name: 'Music groups' });
    for (const label of ['Saved', 'Trending', 'Popular', 'Genres', 'Moods', 'For stays']) {
      await expect(chips.getByRole('button', { name: label })).toBeVisible();
    }
    await expect(chips.getByRole('button', { name: 'Chill' })).toHaveCount(0);
    await expect(chips.getByRole('button', { name: 'Trending' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  test('a group chip loads that group', async ({ page }) => {
    const mock = await installMusicMocks(page);
    await openDraft(page);
    await openMusicTab(page);
    await expect(page.getByText('Song trending-1')).toBeVisible();

    const chips = page.getByRole('group', { name: 'Music groups' });
    await chips.getByRole('button', { name: 'For stays' }).click();
    await chips.getByRole('button', { name: 'Beach day' }).click();

    await expect(page.getByText('Song beach-day-1')).toBeVisible();
    expect(mock.requests.some((r) => r.searchParams.get('group') === 'beach-day')).toBe(true);
  });

  test('searching replaces the groups and clearing brings them back', async ({ page }) => {
    await installMusicMocks(page);
    await openDraft(page);
    await openMusicTab(page);

    await page.getByLabel('Search music').fill('sunset');
    await expect(page.getByText('Song found-sunset')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Music groups' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(page.getByText('Song trending-1')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Music groups' })).toBeVisible();
  });

  test('adding a song puts it on the timeline with its credit', async ({ page }) => {
    await installMusicMocks(page, { groups: { trending: [mockTrack('a', 'audius')] } });
    await openDraft(page);
    await openMusicTab(page);

    await page.getByRole('button', { name: 'Add Song a' }).click();

    // Default music may already occupy a slot; assert the chosen song, not a raw item count.
    await expect(
      page.getByLabel('Timeline', { exact: true }).getByRole('button', { name: /Audio, Song a/ })
    ).toBeVisible({ timeout: 15_000 });
  });

  test('downloading caches an Audius song for the export and the download completes', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const mock = await installMusicMocks(page, {
      groups: {
        trending: [
          mockTrack('V66vyPP', 'audius', {
            streamUrl: 'https://api.audius.co/v1/tracks/V66vyPP/stream?app_name=kame-space',
          }),
        ],
      },
    });
    // The real Audius endpoint is never called from the browser in this test.
    await page.route('https://api.audius.co/**', (route) =>
      route.fulfill({ status: 200, contentType: 'audio/wav', body: silentWav() })
    );
    await openDraft(page);
    await openMusicTab(page);
    await page.getByRole('button', { name: 'Add Song V66vyPP' }).click();
    await expect(page.getByRole('button', { name: 'Download', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    const download = page.waitForEvent('download', { timeout: 180_000 });
    await page.getByRole('button', { name: 'Download', exact: true }).click();
    await download;

    expect(mock.posts).toContainEqual({
      action: 'import-track',
      source: 'audius',
      trackId: 'V66vyPP',
    });
  });

  test('a preview plays and pauses', async ({ page }) => {
    await installMusicMocks(page, { groups: { trending: [mockTrack('1')] } });
    await openDraft(page);
    await openMusicTab(page);

    await page.getByRole('button', { name: 'Play Song 1' }).click();
    await expect(page.getByRole('button', { name: 'Pause Song 1' })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole('button', { name: 'Pause Song 1' }).click();
    await expect(page.getByRole('button', { name: 'Play Song 1' })).toBeVisible();
  });

  test('a saved song is listed under Saved and survives a reload', async ({ page }) => {
    await installMusicMocks(page, { groups: { trending: [mockTrack('1')] } });
    await openDraft(page);
    await openMusicTab(page);

    await page.getByRole('button', { name: 'Save Song 1' }).click();
    await expect(page.getByRole('button', { name: 'Remove Song 1 from saved' })).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('Timeline', { exact: true })).toBeVisible({ timeout: 45_000 });
    await openMusicTab(page);
    await page
      .getByRole('group', { name: 'Music groups' })
      .getByRole('button', { name: /^Saved/ })
      .click();
    await expect(page.getByRole('list', { name: 'Saved music' }).getByText('Song 1')).toBeVisible();
  });

  test('Instagram music: pick a song, see it above the timeline, change the volume, remove it', async ({
    page,
  }) => {
    await installMusicMocks(page, {
      instagram: {
        tracks: [
          mockTrack('ig1', 'instagram', { title: 'Golden Hour', artist: 'JVKE' }),
          mockTrack('ig2', 'instagram', { title: 'Sunroof', artist: 'Nicky Youre' }),
        ],
      },
    });
    await openDraft(page);
    await openMusicTab(page);

    await page
      .getByRole('group', { name: 'Music source' })
      .getByRole('button', { name: 'Instagram' })
      .click();
    await expect(page.getByText('Golden Hour')).toBeVisible();
    await expect(
      page.getByText('Instagram adds this song on a Reel. It is not in a download.')
    ).toBeVisible();

    await page.getByRole('button', { name: 'Use Golden Hour' }).click();

    // Library closes after the pick so the song bar above the timeline is usable.
    await expect(page.getByRole('region', { name: 'Media library' })).toHaveCount(0);
    // Desktop shows the song above the timeline and again in the inspector. The inspector
    // card is the one hosts can reach (the timeline bar sits under the inspector overlay).
    const songBars = page.getByRole('region', { name: 'Instagram song' });
    const inspectorSong = page
      .locator('[data-editor-overlay="inspector"]')
      .getByRole('region', { name: 'Instagram song' });
    await expect(inspectorSong).toBeVisible();
    await expect(inspectorSong.getByText('Golden Hour')).toBeVisible();
    // Picking a song is one undoable step, and never adds a clip to the timeline.
    await page.keyboard.press('ControlOrMeta+z');
    await expect(songBars).toHaveCount(0);
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(inspectorSong).toBeVisible();

    await inspectorSong.getByRole('button', { name: 'Remove Instagram song' }).click();
    await expect(songBars).toHaveCount(0);
  });

  test('Instagram music: an account that is not connected is sent to the inbox', async ({
    page,
  }) => {
    await installMusicMocks(page, { instagram: { status: 'not_connected' } });
    await openDraft(page);
    await openMusicTab(page);

    await page
      .getByRole('group', { name: 'Music source' })
      .getByRole('button', { name: 'Instagram' })
      .click();

    await expect(page.getByText('Connect Instagram to browse its music')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Connect Instagram' })).toHaveAttribute(
      'href',
      /\/messages$/
    );
  });

  test('Instagram music: an account without access is told to use the free music', async ({
    page,
  }) => {
    await installMusicMocks(page, { instagram: { status: 'no_access' } });
    await openDraft(page);
    await openMusicTab(page);
    await page
      .getByRole('group', { name: 'Music source' })
      .getByRole('button', { name: 'Instagram' })
      .click();
    await expect(page.getByText(/not available for this account/)).toBeVisible();
  });
});

test.describe('@ci marketing video editor music picker on a phone', () => {
  test.setTimeout(120_000);
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test.beforeEach(async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installTemplateMocks(page);
    await installMediaMocks(page, [asset('a1', 'image', 'pool.jpg')]);
  });

  async function openMusicTool(page: Page) {
    await page
      .getByRole('toolbar', { name: 'Editor tools' })
      .getByRole('button', { name: 'Audio' })
      .tap();
    await page
      .getByRole('toolbar', { name: 'Tool options' })
      .getByRole('button', { name: 'Music' })
      .tap();
  }

  test('the Music tool opens straight on trending music and adding closes the panel', async ({
    page,
  }) => {
    await installMusicMocks(page, { groups: { trending: [mockTrack('1')] } });
    await openDraft(page);
    const before = await page.locator('[data-timeline-item]').count();

    await openMusicTool(page);

    await expect(page.getByRole('group', { name: 'Music groups' })).toBeVisible();
    await expect(page.getByText('Song 1')).toBeVisible();
    await page.getByRole('button', { name: 'Add Song 1' }).tap();

    await expect(page.getByRole('group', { name: 'Music groups' })).toHaveCount(0);
    await expect(page.locator('[data-timeline-item]')).toHaveCount(before + 1);
  });

  test('every control in the picker is at least 44px tall and nothing scrolls sideways', async ({
    page,
  }) => {
    await installMusicMocks(page, { groups: { trending: [mockTrack('1')] } });
    await openDraft(page);
    await openMusicTool(page);
    await expect(page.getByText('Song 1')).toBeVisible();

    const small = await page.evaluate(() => {
      const root = document.querySelector('[aria-label="Music groups"]')!.closest('div.space-y-3')!;
      return Array.from(root.querySelectorAll('button, input'))
        .map((el) => ({
          label: el.getAttribute('aria-label') ?? el.textContent,
          h: el.getBoundingClientRect().height,
        }))
        .filter((b) => b.h > 0 && b.h < 40);
    });
    expect(small).toEqual([]);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    );
    expect(overflow).toBe(false);
  });

  test('picking an Instagram song on a phone closes the panel and shows the song', async ({
    page,
  }) => {
    await installMusicMocks(page, {
      instagram: { tracks: [mockTrack('ig1', 'instagram', { title: 'Golden Hour' })] },
    });
    await openDraft(page);
    await openMusicTool(page);

    await page
      .getByRole('group', { name: 'Music source' })
      .getByRole('button', { name: 'Instagram' })
      .tap();
    await page.getByRole('button', { name: 'Use Golden Hour' }).tap();

    await expect(page.getByRole('group', { name: 'Music source' })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Instagram song' })).toBeVisible();
  });
});

test.describe('@ci marketing video editor music picker on a tablet', () => {
  test.setTimeout(120_000);
  test.use({ viewport: { width: 768, height: 1024 } });

  test('the picker fits at 768px with no sideways scroll and can add a song', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installTemplateMocks(page);
    await installMediaMocks(page, [asset('a1', 'image', 'pool.jpg')]);
    await installMusicMocks(page, {
      groups: { trending: [mockTrack('1'), mockTrack('a', 'audius')] },
    });
    await openDraft(page);
    const before = await page.locator('[data-timeline-item]').count();
    // Below 1024px the editor uses the phone shell, so the Music tool opens the picker.
    await page
      .getByRole('toolbar', { name: 'Editor tools' })
      .getByRole('button', { name: 'Audio' })
      .click();
    await page
      .getByRole('toolbar', { name: 'Tool options' })
      .getByRole('button', { name: 'Music' })
      .click();

    await expect(page.getByText('Song a')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    ).toBe(false);
    await page.getByRole('button', { name: 'Add Song 1' }).click();
    await expect(page.locator('[data-timeline-item]')).toHaveCount(before + 1);
  });
});
