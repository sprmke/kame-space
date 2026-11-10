import { expect, test, type Page } from '@playwright/test';

import { mockFeatureAvailability } from '../../shared/featureAvailabilityMocks';
import { mockEdgeFunctions } from '../../shared/interceptEdge';
import {
  installPropertyTeamRbacMocks,
  teamRbacPaths,
} from '../team/shared/propertyTeamRbacHarness';

/**
 * Marketing Trends: the "Trending today" rail on the AI Studio create form, the
 * sheet behind it, and the handoff that fills the form from an angle.
 *
 * Nothing is generated here. The rail and the sheet are read-only until the host
 * presses Generate, so a test that asserts "no generate call" is asserting the
 * product promise, not just an absence of mocks.
 */

const TOPICS = [
  {
    id: 'topic-1',
    runId: 'run-1',
    runDate: '2026-11-10',
    window: 'today',
    rank: 1,
    topicKey: 'pinoy-big-brother-collab-3-0',
    title: 'PBB Collab 3.0',
    summary: 'Fans are following the new housemates this week.',
    category: 'tv_film',
    stayFit: 3,
    score: 2.18,
    momentum: 'new',
    daysTrending: 2,
    firstSeen: '2026-11-08',
    sources: [{ source: 'google_trends', rank: 2, traffic: '500+' }],
    angles: [
      {
        title: 'Watch party staycation',
        hook: 'Big night on screen, better from a proper stay.',
        output: 'post',
        goal: 'vibe',
        format: 'instagram-portrait',
        prompt: 'A cozy living room with the TV on and snacks out. No logos, no real people.',
      },
      {
        title: 'Group night photo',
        hook: 'Room for the whole group.',
        output: 'image',
        goal: 'vibe',
        format: '1:1',
        prompt: 'A warm living room set for a group night in. No text, no logos.',
      },
    ],
    captionIdea: 'Tonight is a staycation kind of night. Who is watching?',
    hashtags: ['#Staycation'],
    brandGuard: ['no_likeness', 'no_logo', 'no_endorsement'],
    pinned: false,
    manual: false,
  },
  {
    id: 'topic-2',
    runId: 'run-1',
    runDate: '2026-11-10',
    window: 'today',
    rank: 2,
    topicKey: 'alexandra-eala',
    title: 'Alexandra Eala',
    summary: 'Another big performance for the Filipino athlete.',
    category: 'sports',
    stayFit: 2,
    score: 1.42,
    momentum: 'rising',
    daysTrending: 1,
    firstSeen: '2026-11-10',
    sources: [{ source: 'wikimedia_ph', rank: 5 }],
    angles: [
      {
        title: 'Game night staycation',
        hook: 'A game night is better with a room to stay in.',
        output: 'post',
        goal: 'vibe',
        format: 'instagram-portrait',
        prompt: 'A sports-fan mood board for a rental. No logos.',
      },
    ],
    captionIdea: 'The season is not over yet.',
    hashtags: ['#SportsPH'],
    brandGuard: [],
    pinned: false,
    manual: false,
  },
];

/** The list payload the read endpoint returns. */
function trendsBody(over: Record<string, unknown> = {}) {
  return {
    success: true,
    data: {
      runDate: '2026-11-10',
      publishedAt: '2026-11-10T05:31:00.000Z',
      stale: false,
      fallback: null,
      windowsAvailable: ['today', 'week'],
      topics: TOPICS,
      ...over,
    },
  };
}

/** Anything that would spend a credit. Must stay empty unless the test presses Generate. */
function watchGenerateCalls(page: Page): string[] {
  const calls: string[] = [];
  page.on('request', (request) => {
    if (/generate-marketing-(media|template|caption)/.test(request.url())) calls.push(request.url());
  });
  return calls;
}

async function openCreateForm(page: Page) {
  await page.goto(`${teamRbacPaths.marketingWorkspace}&tab=generate&item=new&output=post`);
  await expect(page.getByRole('heading', { name: 'Marketing' })).toBeVisible({ timeout: 20_000 });
}

test.describe('@ci marketing trends', () => {
  test('the rail shows today’s topics and opens the sheet', async ({ page }) => {
    const generateCalls = watchGenerateCalls(page);
    await installPropertyTeamRbacMocks(page, 'full_access');
    await mockEdgeFunctions(page, [{ name: 'marketing-trends', method: 'GET', body: trendsBody() }]);
    await openCreateForm(page);

    await expect(page.getByText('Trending today')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /PBB Collab 3\.0/ })).toBeVisible();

    await page.getByRole('button', { name: 'See all' }).click();
    const sheet = page.getByRole('dialog', { name: 'Trends in the Philippines' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'This week' })).toBeVisible();
    await expect(sheet.getByText('Fans are following the new housemates this week.')).toBeVisible();
    await expect(
      sheet.getByText('Mention the trend, do not use their photos or logos.')
    ).toBeVisible();

    // Reading trends never generates.
    expect(generateCalls).toEqual([]);
  });

  test('a category filter narrows the list and an empty result says so', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await mockEdgeFunctions(page, [
      {
        name: 'marketing-trends',
        method: 'GET',
        body: trendsBody({ topics: [TOPICS[0]] }),
      },
    ]);
    await openCreateForm(page);

    await page.getByRole('button', { name: 'See all' }).click();
    const sheet = page.getByRole('dialog', { name: 'Trends in the Philippines' });
    await expect(sheet).toBeVisible();

    // Only categories present in the window are offered.
    await expect(sheet.getByRole('button', { name: 'Music' })).toHaveCount(0);
    await expect(sheet.getByRole('button', { name: 'TV & film' })).toBeVisible();
  });

  test('using an angle fills the form with the trend attached and generates nothing', async ({
    page,
  }) => {
    const generateCalls = watchGenerateCalls(page);
    await installPropertyTeamRbacMocks(page, 'full_access');
    await mockEdgeFunctions(page, [{ name: 'marketing-trends', method: 'GET', body: trendsBody() }]);
    await openCreateForm(page);

    await page.getByRole('button', { name: /PBB Collab 3\.0/ }).click();
    const sheet = page.getByRole('dialog', { name: 'PBB Collab 3.0' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('Big night on screen, better from a proper stay.')).toBeVisible();

    await sheet.getByRole('button', { name: 'Make a post' }).click();

    // The sheet closes, the form carries the trend chip, and the description is filled.
    await expect(sheet).toBeHidden();
    await expect(page.getByText('Trend: PBB Collab 3.0')).toBeVisible();
    await expect(page.getByLabel('What is the post about?')).toHaveValue(
      'A cozy living room with the TV on and snacks out. No logos, no real people.'
    );

    // The chip is removable.
    await page.getByRole('button', { name: 'Remove the trend' }).click();
    await expect(page.getByText('Trend: PBB Collab 3.0')).toHaveCount(0);

    expect(generateCalls).toEqual([]);
  });

  test('copying a caption idea works without the AI plan', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await installPropertyTeamRbacMocks(page, 'read_only');
    await mockEdgeFunctions(page, [{ name: 'marketing-trends', method: 'GET', body: trendsBody() }]);
    await openCreateForm(page);

    await page.getByRole('button', { name: /PBB Collab 3\.0/ }).click();
    const sheet = page.getByRole('dialog', { name: 'PBB Collab 3.0' });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: 'Copy caption idea' }).click();

    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toContain('Tonight is a staycation kind of night');
  });

  test('falls back to seasonal ideas when the list is empty', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await mockEdgeFunctions(page, [
      {
        name: 'marketing-trends',
        method: 'GET',
        body: trendsBody({ fallback: 'evergreen', topics: [], runDate: null }),
      },
    ]);
    await openCreateForm(page);

    await expect(page.getByText('Seasonal ideas')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Trending today')).toHaveCount(0);
  });

  test('hides the rail when the super admin turned trends off', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await mockEdgeFunctions(page, [
      { name: 'marketing-trends', method: 'GET', body: { success: true, data: { disabled: true } } },
    ]);
    await openCreateForm(page);

    await expect(page.getByLabel('What is the post about?')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Trending today')).toHaveCount(0);
    await expect(page.getByText('Seasonal ideas')).toHaveCount(0);
  });

  test('hides the rail when the marketing.trends leaf is off', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await mockFeatureAvailability(page, ['marketing.trends']);
    await mockEdgeFunctions(page, [{ name: 'marketing-trends', method: 'GET', body: trendsBody() }]);
    await openCreateForm(page);

    await expect(page.getByLabel('What is the post about?')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Trending today')).toHaveCount(0);
  });

  test('the sheet is a bottom sheet on a phone and does not overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await installPropertyTeamRbacMocks(page, 'full_access');
    await mockEdgeFunctions(page, [{ name: 'marketing-trends', method: 'GET', body: trendsBody() }]);
    await openCreateForm(page);

    await page.getByRole('button', { name: /PBB Collab 3\.0/ }).click();
    const sheet = page.getByRole('dialog', { name: 'PBB Collab 3.0' });
    await expect(sheet).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);

    // Full width at the bottom, not a centred dialog.
    const box = await sheet.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(340);
  });
});
