import { expect, test, type Page, type Route } from '@playwright/test';
import path from 'node:path';

import { installMusicMocks, mockTrack } from './musicMocks';
import {
  asset,
  installMediaMocks,
  installTemplateMocks,
  openDraft,
  openMediaPanel,
} from './videoEditorHarness';
import { installPropertyTeamRbacMocks } from '../../team/shared/propertyTeamRbacHarness';

const CONNECTIONS = [
  {
    id: 'conn-fb',
    platform: 'facebook',
    displayName: 'Solea Page',
    status: 'connected',
    isPreview: false,
  },
  {
    id: 'conn-ig',
    platform: 'instagram',
    displayName: 'solea.mactan',
    status: 'connected',
    isPreview: false,
  },
];

/**
 * Slow visual walkthrough of the trending music picker. Not CI.
 *
 *   PLAYWRIGHT_RECORD_VIDEO=1 PLAYWRIGHT_SLOW_MO=700 PLAYWRIGHT_DEMO_PAUSE_MS=900 \
 *     bunx playwright test ui/e2e/features/marketing/video-editor/videoEditorMusicDemo.spec.ts \
 *     --project=chromium --headed
 *
 * Stills land in test-results/music-picker-demo/. Video is under test-results/playwright/.
 */

const OUT = path.resolve('test-results/music-picker-demo');

function pauseMs(): number {
  const raw = process.env.PLAYWRIGHT_DEMO_PAUSE_MS;
  const n = raw ? Number.parseInt(raw, 10) : 700;
  return Number.isFinite(n) && n > 0 ? n : 700;
}

async function beat(page: Page) {
  await page.waitForTimeout(pauseMs());
}

async function shot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(OUT, `${name}.png`),
    fullPage: false,
  });
}

async function openMusicTab(page: Page) {
  await openMediaPanel(page);
  await page.getByRole('tab', { name: 'Music' }).click();
  await expect(page.getByRole('group', { name: 'Music groups' })).toBeVisible();
}

test.describe('@demo marketing video music picker walkthrough', () => {
  test.setTimeout(240_000);

  test.beforeEach(async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installTemplateMocks(page);
    await installMediaMocks(page, [asset('a1', 'image', 'pool.jpg')]);
  });

  test('desktop: sections, genres, saved tip, Instagram song, publish', async ({ page }) => {
    await installMusicMocks(page, {
      groups: {
        trending: [
          mockTrack('1', 'jamendo', { title: 'Sunset Pool', artist: 'Coastal Keys' }),
          mockTrack('a', 'audius', { title: 'City Soft', artist: 'Loft Wave' }),
        ],
        chill: [mockTrack('c1', 'jamendo', { title: 'Soft Lobby', artist: 'Calm Stay' })],
        'beach-day': [
          mockTrack('b1', 'audius', { title: 'Shoreline', artist: 'Island House' }),
        ],
      },
      instagram: {
        tracks: [
          mockTrack('ig1', 'instagram', {
            title: 'Golden Hour',
            artist: 'JVKE',
            imageUrl: null,
          }),
        ],
      },
    });
    await page.route('**/functions/v1/meta-inbox-status**', (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            connections: CONNECTIONS,
            metaConfigured: true,
            metaSyncInProgress: false,
            metaSyncError: null,
            metaHasMore: false,
          },
        }),
      })
    );
    await page.route('**/functions/v1/publish-to-meta**', (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { publicationId: 'pub-1', metaPostId: 'ig-media-1', status: 'published' },
        }),
      })
    );
    await openDraft(page);
    await beat(page);
    await shot(page, '01-desktop-editor');

    await openMusicTab(page);
    await expect(page.getByText('Sunset Pool')).toBeVisible();
    await beat(page);
    await shot(page, '02-desktop-trending');

    const chips = page.getByRole('group', { name: 'Music groups' });
    await chips.getByRole('button', { name: 'Genres' }).click();
    await expect(chips.getByRole('button', { name: 'Chill' })).toBeVisible();
    await beat(page);
    await shot(page, '03-desktop-genres');

    await chips.getByRole('button', { name: 'For stays' }).click();
    await expect(page.getByText('Shoreline')).toBeVisible();
    await beat(page);
    await shot(page, '04-desktop-for-stays');

    await page.getByRole('button', { name: 'Save Shoreline' }).click();
    await chips.getByRole('button', { name: /^Saved/ }).click();
    await expect(page.getByText('Saved on this device only')).toBeVisible();
    await beat(page);
    await shot(page, '05-desktop-saved');

    await chips.getByRole('button', { name: 'Trending' }).click();
    await page.getByRole('button', { name: 'Add Sunset Pool' }).click();
    await expect(page.getByText('Song added to the video')).toBeVisible();
    await shot(page, '06-desktop-added-toast');
    await beat(page);

    await openMusicTab(page);
    await page
      .getByRole('group', { name: 'Music source' })
      .getByRole('button', { name: 'Instagram' })
      .click();
    await expect(
      page.getByText('Instagram adds this song on a Reel. It is not in a download.')
    ).toBeVisible();
    await beat(page);
    await shot(page, '07-desktop-instagram-tab');

    await page.getByRole('button', { name: 'Use Golden Hour' }).click();
    await expect(page.getByRole('region', { name: 'Instagram song' }).first()).toBeVisible();
    await beat(page);
    await shot(page, '08-desktop-instagram-song-bar');

    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByTestId('publish-instagram-song')).toBeVisible({ timeout: 180_000 });
    await beat(page);
    await shot(page, '09-desktop-publish-reel');
  });

  test('phone: Audio tool opens music sheet with new sections', async ({ page, browser }) => {
    // Desktop Chromium has no touch; open a phone-sized context with hasTouch.
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      hasTouch: true,
      isMobile: true,
      locale: 'en-PH',
      timezoneId: 'Asia/Manila',
      recordVideo: process.env.PLAYWRIGHT_RECORD_VIDEO === '1' ? { dir: OUT } : undefined,
    });
    const phone = await context.newPage();
    await installPropertyTeamRbacMocks(phone, 'full_access');
    await installTemplateMocks(phone);
    await installMediaMocks(phone, [asset('a1', 'image', 'pool.jpg')]);
    await installMusicMocks(phone, {
      groups: {
        trending: [mockTrack('1', 'jamendo', { title: 'Sunset Pool', artist: 'Coastal Keys' })],
        chill: [mockTrack('c1', 'jamendo', { title: 'Soft Lobby', artist: 'Calm Stay' })],
      },
      instagram: {
        tracks: [mockTrack('ig1', 'instagram', { title: 'Golden Hour', artist: 'JVKE' })],
      },
    });
    await openDraft(phone);
    await beat(phone);

    await phone
      .getByRole('toolbar', { name: 'Editor tools' })
      .getByRole('button', { name: 'Audio' })
      .tap();
    await phone
      .getByRole('toolbar', { name: 'Tool options' })
      .getByRole('button', { name: 'Music' })
      .tap();
    await expect(phone.getByText('Sunset Pool')).toBeVisible();
    await beat(phone);
    await shot(phone, '10-phone-trending-sheet');

    await phone
      .getByRole('group', { name: 'Music groups' })
      .getByRole('button', { name: 'Genres' })
      .tap();
    await expect(phone.getByRole('button', { name: 'Chill' })).toBeVisible();
    await beat(phone);
    await shot(phone, '11-phone-genres');

    await phone
      .getByRole('group', { name: 'Music source' })
      .getByRole('button', { name: 'Instagram' })
      .tap();
    await expect(phone.getByText('Golden Hour')).toBeVisible();
    await beat(phone);
    await shot(phone, '12-phone-instagram');

    await phone.getByRole('button', { name: 'Use Golden Hour' }).tap();
    await expect(phone.getByRole('region', { name: 'Instagram song' })).toBeVisible();
    await beat(phone);
    await shot(phone, '13-phone-song-on-timeline');
    await context.close();
  });

  test('tablet 768: phone shell music tool', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await installMusicMocks(page, {
      groups: {
        trending: [
          mockTrack('1', 'jamendo', { title: 'Sunset Pool' }),
          mockTrack('a', 'audius', { title: 'City Soft' }),
        ],
      },
    });
    await openDraft(page);
    await page
      .getByRole('toolbar', { name: 'Editor tools' })
      .getByRole('button', { name: 'Audio' })
      .click();
    await page
      .getByRole('toolbar', { name: 'Tool options' })
      .getByRole('button', { name: 'Music' })
      .click();
    await expect(page.getByText('City Soft')).toBeVisible();
    await beat(page);
    await shot(page, '14-tablet-768-music');
  });
});
