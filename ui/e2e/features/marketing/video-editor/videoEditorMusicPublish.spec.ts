import { expect, test, type Route } from '@playwright/test';

import { installMusicMocks, mockTrack } from './musicMocks';
import {
  asset,
  installMediaMocks,
  installTemplateMocks,
  openDraft,
  openMediaPanel,
} from './videoEditorHarness';
import { installPropertyTeamRbacMocks } from '../../team/shared/propertyTeamRbacHarness';

/**
 * Publishing a video with an Instagram song: the song is meant for a Reel, so the dialog starts on
 * Instagram + Reel, shows the song, and sends its id and volume with the request. Export renders
 * for real in the browser; only the backend is mocked.
 */

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

test.describe('@ci marketing video editor publish with an Instagram song', () => {
  test.setTimeout(240_000);

  test('the dialog starts on an Instagram Reel and sends the song', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installTemplateMocks(page);
    await installMediaMocks(page, [asset('a1', 'image', 'pool.jpg')]);
    await installMusicMocks(page, {
      instagram: {
        tracks: [mockTrack('ig1', 'instagram', { title: 'Golden Hour', artist: 'JVKE' })],
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
    const published: Array<Record<string, unknown>> = [];
    await page.route('**/functions/v1/publish-to-meta**', async (route: Route) => {
      if (route.request().method() === 'POST') {
        published.push(route.request().postDataJSON() as Record<string, unknown>);
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { publicationId: 'pub-1', metaPostId: 'ig-media-1', status: 'published' },
        }),
      });
    });

    await openDraft(page);
    await openMediaPanel(page);
    await page.getByRole('tab', { name: 'Music' }).click();
    await page
      .getByRole('group', { name: 'Music source' })
      .getByRole('button', { name: 'Instagram' })
      .click();
    await page.getByRole('button', { name: 'Use Golden Hour' }).click();
    await expect(page.getByRole('region', { name: 'Instagram song' }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Publish', exact: true }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByTestId('publish-instagram-song')).toBeVisible({ timeout: 180_000 });
    await expect(dialog.getByText('Instagram adds this song to your Reel')).toBeVisible();
    await expect(dialog.getByRole('radio', { name: 'Reel' })).toBeChecked();
    // A video offers Reel and Story; there is no plain Post.
    await expect(dialog.getByRole('radio', { name: 'Post' })).toHaveCount(0);

    await dialog
      .getByRole('button', { name: /publish/i })
      .last()
      .click();
    await expect.poll(() => published.length, { timeout: 60_000 }).toBe(1);
    expect(published[0]).toMatchObject({
      platform: 'instagram',
      publishType: 'instagram_reel',
      mediaType: 'video',
      connectionId: 'conn-ig',
      instagramAudio: { audioId: 'ig1', audioVolume: 100 },
    });
  });
});
