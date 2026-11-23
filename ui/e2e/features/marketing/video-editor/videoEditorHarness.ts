import { expect, type Page, type Route } from '@playwright/test';

import { teamRbacPaths } from '../../team/shared/propertyTeamRbacHarness';

/** Shared mocks and helpers for the Videos editor specs. The backend is mocked. */

const LIMITS = {
  storageMb: 500,
  maxFiles: 100,
  maxImageMb: 10,
  maxVideoMb: 100,
  maxVideoSec: 60,
  maxAudioMb: 15,
  dailyUploads: 50,
};

export function asset(id: string, kind: 'image' | 'video' | 'audio', name: string) {
  return {
    id,
    kind,
    source: 'upload',
    fileName: name,
    mimeType: kind === 'image' ? 'image/jpeg' : kind === 'video' ? 'video/mp4' : 'audio/mpeg',
    url: `http://127.0.0.1:4173/favicon.ico?asset=${id}`,
    posterUrl: null,
    sizeBytes: 1_000_000,
    width: 1080,
    height: 1920,
    durationMs: kind === 'image' ? null : 8000,
    peaks: null,
    createdAt: '2026-10-30T00:00:00Z',
  };
}

export async function installMediaMocks(
  page: Page,
  items: ReturnType<typeof asset>[],
  usedBytes = 1_000_000
) {
  await page.route('**/functions/v1/marketing-media**', async (route: Route) => {
    const url = new URL(route.request().url());
    const isUsage = url.pathname.endsWith('/usage');
    const data = isUsage
      ? { usedBytes, files: items.length, uploadsToday: 0, limits: LIMITS }
      : { items, nextCursor: null };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data }),
    });
  });
  // Default music lookup is best effort in the editor; keep it quiet.
  await page.route('**/functions/v1/marketing-music**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { tracks: [] } }),
    })
  );
}

export async function installTemplateMocks(page: Page) {
  await page.route('**/functions/v1/marketing-templates**', async (route: Route) => {
    const url = new URL(route.request().url());
    const view = url.searchParams.get('view');
    const data =
      view === 'library'
        ? { items: [], nextCursor: null }
        : view === 'usage'
          ? { usage: [] }
          : route.request().method() === 'POST'
            ? {
                id: '9e8d7c6b-5a4f-4e3d-8c2b-1a0f9e8d7c6b',
                name: 'Quiet morning',
                kind: 'design',
                contentType: 'video',
                platform: 'instagram',
                aspectPreset: 'instagram-story',
                themeKey: 'property-colors',
                designJson: {},
                groupMembers: [],
                createdAt: '2026-10-30T00:00:00Z',
                updatedAt: '2026-10-30T00:00:00Z',
              }
            : { templates: [] };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data }),
    });
  });
}

/** The library panel starts closed on laptop-width screens. */
export async function openMediaPanel(page: Page) {
  const tab = page.getByRole('tab', { name: 'Media' });
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click();
  await expect(page.getByRole('region', { name: 'Media library' })).toBeVisible();
}

export async function openDraft(page: Page) {
  await page.goto(
    `${teamRbacPaths.marketingWorkspace}&tab=video&item=new&from=preset%3Aquiet-morning&size=instagram-story`
  );
  await expect(page.getByRole('button', { name: 'Back to Videos' })).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByLabel('Timeline', { exact: true })).toBeVisible({ timeout: 30_000 });
}
