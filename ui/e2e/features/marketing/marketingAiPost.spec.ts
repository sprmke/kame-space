import { expect, test, type Page, type Route } from '@playwright/test';

import { mockPublicPropertyBody } from '../../shared/mockFixtures';
import {
  installPropertyTeamRbacMocks,
  teamRbacPaths,
} from '../team/shared/propertyTeamRbacHarness';

/**
 * AI Studio → Post. The director is mocked; the poster compiler, offscreen renderer
 * and Design hand-off run for real.
 */

const PHOTO_URL = 'https://e2e-photos.test/living-room.png';
const POSTER_ID = '5b2f6c4e-1d3a-4f8b-9c7e-2a6d8e0f1b3c';
// 2x2 warm-toned PNG: enough for cover-crop math and a real canvas render.
const PHOTO_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP4v4vhPwMDAwMDEwMDAwAYCAIBxJv1NwAAAABJRU5ErkJggg==',
  'base64'
);

const VARIANTS = [
  {
    archetype: 'magazine-cover',
    fontPairing: 'magazine-cover',
    copy: { headline: 'Slow', accent: 'mornings', tagline: 'Sip slow. Breathe deep.' },
    photoIndexes: [0],
    label: 'Slow mornings',
  },
  {
    archetype: 'sky-headline',
    fontPairing: 'tropical-script',
    copy: { eyebrow: 'Discover a slice of', accent: 'Mactan', headline: 'Beach days, city nights' },
    photoIndexes: [0],
    label: 'Beach days',
  },
  {
    archetype: 'wave-duo',
    fontPairing: 'cozy-cafe',
    copy: { headline: 'Solea', accent: 'Mactan Staycation', chips: ['Coffee', 'View', 'You time'] },
    photoIndexes: [0],
    label: 'Solea staycation',
  },
  {
    archetype: 'minimal-title',
    fontPairing: 'editorial-calm',
    copy: { headline: 'Solea Mactan', eyebrow: 'Stay a while' },
    photoIndexes: [0],
    label: 'Stay a while',
  },
];

async function installPosterMocks(
  page: Page,
  director: (route: Route) => Promise<void>,
  saved: Array<Record<string, unknown>> = []
) {
  await page.route(PHOTO_URL, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      headers: { 'access-control-allow-origin': '*' },
      body: PHOTO_PNG,
    })
  );
  await page.route('**/functions/v1/get-public-property**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...mockPublicPropertyBody,
        data: { ...mockPublicPropertyBody.data, images: [PHOTO_URL] },
      }),
    })
  );
  await page.route('**/functions/v1/generate-marketing-template**', director);
  await page.route('**/functions/v1/marketing-templates**', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      const record = {
        id: POSTER_ID,
        name: body.name,
        contentType: 'design',
        kind: body.kind ?? null,
        platform: body.platform ?? null,
        aspectPreset: body.aspectPreset ?? null,
        designJson: body.designJson,
        updatedAt: new Date().toISOString(),
      };
      saved.push(record);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: record }),
      });
      return;
    }
    const url = new URL(route.request().url());
    const id = url.searchParams.get('id');
    const view = url.searchParams.get('view');
    const data = id
      ? (saved.find((record) => record.id === id) ?? null)
      : view === 'library'
        ? { items: [], nextCursor: null }
        : view === 'usage'
          ? { usage: [] }
          : { templates: saved };
    await route.fulfill({
      status: data ? 200 : 404,
      contentType: 'application/json',
      body: JSON.stringify(data ? { success: true, data } : { success: false, error: 'Not found' }),
    });
  });
}

function directorResponse(requests: Array<Record<string, unknown>>) {
  return async (route: Route) => {
    requests.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { contentType: 'poster', variants: VARIANTS, photoUrls: [PHOTO_URL] },
      }),
    });
  };
}

/** Step 1 (what to make) → step 2 (the form) for a property with nothing made yet. */
async function startPost(page: Page) {
  await page.goto(teamRbacPaths.marketingWorkspace);
  await expect(page.getByRole('heading', { name: 'Marketing' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'What do you want to make?' })).toBeVisible();
  await page.getByRole('button', { name: /^Post/ }).first().click();
  await expect(page.locator('#ai-studio-composer')).toBeVisible();
}

const SESSION_ID = '7d1f0a52-4b6c-4e0a-9a53-0c1d2e3f4a5b';

/** In-memory stand-in for `marketing-ai-sessions`: saves versions, returns the conversation. */
async function installSessionMocks(page: Page, saves: Array<Record<string, unknown>> = []) {
  const versions: Array<Record<string, unknown>> = [];
  const session = {
    id: SESSION_ID,
    output: 'post',
    title: 'Weekend post',
    themeKey: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  };
  await page.route('**/functions/v1/marketing-ai-sessions**', async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      const body = route.request().postDataJSON() as {
        versions: Array<Record<string, unknown>>;
        prompt?: string | null;
        parentVersionId?: string | null;
        output?: string;
      };
      if (body.output === 'reel') session.output = 'reel';
      saves.push(body as unknown as Record<string, unknown>);
      const turnId = `turn-${saves.length}`;
      const rows = body.versions.map((version, index) => ({
        id: `00000000-0000-4000-8000-${String(versions.length + index + 1).padStart(12, '0')}`,
        sessionId: SESSION_ID,
        turnId,
        prompt: body.prompt ?? null,
        goal: version.goal,
        format: version.format,
        spec: version.spec,
        photoUrls: version.photoUrls,
        previewUrl: version.previewDataUrl,
        parentVersionId: body.parentVersionId ?? null,
        createdAt: new Date(Date.now() + versions.length * 1000 + index).toISOString(),
      }));
      versions.push(...rows);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { session, versions: rows } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { session, jobs: [], postVersions: versions },
      }),
    });
  });
}

const generate = (page: Page) => page.getByRole('button', { name: 'Generate 4 posts' });

test.describe('@ci @flaky marketing AI Post', () => {
  test.setTimeout(90_000);

  // fixme: Marketing Studio entry moved to the New post gallery on 2026-10-30 (ledger PR-133).
  test.fixme('a first post sends the poster request and opens four versions', async ({ page }) => {
    const requests: Array<Record<string, unknown>> = [];
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installPosterMocks(page, directorResponse(requests));
    await startPost(page);

    await page.getByRole('button', { name: 'Promo' }).click();
    await page.locator('#ai-studio-prompt').fill('Weekday stays, book direct');
    await generate(page).click();

    // The conversation opens with the batch: best layout first, the rest alongside.
    await expect(page.getByRole('region', { name: 'Preview' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('button', { name: /^Version \d/ })).toHaveCount(4);
    await expect(page.getByText('Version 1 of 4')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Describe a change' })).toBeVisible();

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      contentType: 'poster',
      goal: 'promo',
      prompt: 'Weekday stays, book direct',
      photoUrls: [PHOTO_URL],
    });
    expect((requests[0]!.facts as Record<string, unknown>).checkIn).toBe('2:00 PM');
  });

  // fixme: Marketing Studio entry moved to the New post gallery on 2026-10-30 (ledger PR-133).
  test.fixme('when the director fails, hosts still get posts from quick layouts', async ({
    page,
  }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installPosterMocks(page, (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'busy' }),
      })
    );
    await startPost(page);
    await generate(page).click();

    await expect(page.getByText('AI styling was busy, so these are quick layouts.')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('button', { name: 'Retry with AI' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Version \d/ })).toHaveCount(4, {
      timeout: 60_000,
    });
  });

  test('the form offers a style, a photo row and a free draft before Generate', async ({
    page,
  }) => {
    const requests: Array<Record<string, unknown>> = [];
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installPosterMocks(page, directorResponse(requests));
    await startPost(page);

    await expect(page.getByText('Style', { exact: true })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Lifestyle/ })).toBeVisible();
    const photo = page.getByRole('button', { name: 'Use this photo' }).first();
    await expect(photo).toBeVisible({ timeout: 20_000 });
    await photo.click();
    await page.getByRole('radio', { name: /Clean/ }).click();

    // A free draft replaces the examples pane; it never calls the director.
    await expect(page.getByAltText('Draft of your post')).toBeVisible({ timeout: 30_000 });
    expect(requests).toHaveLength(0);

    await generate(page).click();
    await expect.poll(() => requests.length).toBe(1);
    expect(requests[0]).toMatchObject({ photoUrls: [PHOTO_URL] });
  });

  test('Also make a Story saves a second 9:16 version after the batch', async ({ page }) => {
    const saves: Array<Record<string, unknown>> = [];
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installPosterMocks(page, directorResponse([]));
    await installSessionMocks(page, saves);
    await startPost(page);
    await page.getByLabel('Also make a Story').check();
    await generate(page).click();

    await expect(page.getByRole('list', { name: 'New versions' })).toBeVisible({ timeout: 60_000 });
    await expect.poll(() => saves.length).toBe(2);
    const story = saves[1]!.versions as Array<{ format: string }>;
    expect(story).toHaveLength(1);
    expect(story[0]!.format).toBe('instagram-story');
  });

  test('a new set opens as a grid; opening one shows quick edit that saves a free version', async ({
    page,
  }) => {
    const requests: Array<Record<string, unknown>> = [];
    const saves: Array<Record<string, unknown>> = [];
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installPosterMocks(page, directorResponse(requests));
    await installSessionMocks(page, saves);
    await startPost(page);
    await generate(page).click();

    // The batch lands as a grid to compare, not one post at a time.
    const grid = page.getByRole('list', { name: 'New versions' });
    await expect(grid).toBeVisible({ timeout: 60_000 });
    await expect(grid.getByRole('button', { name: /^Open version/ })).toHaveCount(4);
    await grid.getByRole('button', { name: 'Open version 1' }).click();
    await expect(grid).toHaveCount(0);

    // Quick edit: retype the headline and apply. No new director call, no credits.
    await page.getByRole('button', { name: 'Quick edit' }).click();
    const headline = page.getByLabel('Headline');
    await headline.fill('Cozy nights in');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect.poll(() => saves.length).toBe(2);
    expect(requests).toHaveLength(1);
    const edited = (saves[1]!.versions as Array<{ spec: { copy: { headline: string } } }>)[0]!;
    expect(edited.spec.copy.headline).toBe('Cozy nights in');
  });

  test('Make a carousel saves one set of 4:5 slides with different goals', async ({ page }) => {
    const saves: Array<Record<string, unknown>> = [];
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installPosterMocks(page, directorResponse([]));
    await installSessionMocks(page, saves);
    await startPost(page);
    await generate(page).click();
    const grid = page.getByRole('list', { name: 'New versions' });
    await expect(grid).toBeVisible({ timeout: 60_000 });
    await grid.getByRole('button', { name: 'Open version 1' }).click();

    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Make a carousel' }).click();
    await expect.poll(() => saves.length, { timeout: 60_000 }).toBe(2);
    const slides = saves[1]!.versions as Array<{ goal: string; format: string }>;
    expect(slides.length).toBeGreaterThanOrEqual(3);
    expect(new Set(slides.map((slide) => slide.format))).toEqual(new Set(['instagram-portrait']));
    expect(new Set(slides.map((slide) => slide.goal)).size).toBeGreaterThanOrEqual(3);

    // The new set opens as its own grid.
    await expect(page.getByRole('list', { name: 'New versions' })).toBeVisible({ timeout: 30_000 });
  });

  test('Make a short reel saves a free story reel project', async ({ page }) => {
    const templates: Array<Record<string, unknown>> = [];
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installPosterMocks(page, directorResponse([]));
    await installSessionMocks(page);
    await page.route('**/functions/v1/marketing-templates**', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      templates.push(route.request().postDataJSON() as Record<string, unknown>);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: 'tpl-reel-1', name: 'reel', contentType: 'video', designJson: {} },
        }),
      });
    });
    await startPost(page);
    await generate(page).click();
    const grid = page.getByRole('list', { name: 'New versions' });
    await expect(grid).toBeVisible({ timeout: 60_000 });
    await grid.getByRole('button', { name: 'Open version 1' }).click();

    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Make a short reel' }).click();
    await expect.poll(() => templates.length, { timeout: 60_000 }).toBe(1);
    const saved = templates[0] as {
      contentType: string;
      aspectPreset: string;
      designJson: { project: { scenes: Array<{ kind: string }>; format: string } };
    };
    expect(saved.contentType).toBe('video');
    expect(saved.aspectPreset).toBe('instagram-story');
    const kinds = saved.designJson.project.scenes.map((scene) => scene.kind);
    expect(kinds[kinds.length - 1]).toBe('cta');
    expect(kinds.filter((kind) => kind === 'photo').length).toBeLessThanOrEqual(3);
  });

  test('Preview reel plays the free reel, switches style and saves the shown one', async ({
    page,
  }) => {
    const templates: Array<Record<string, unknown>> = [];
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installPosterMocks(page, directorResponse([]));
    await installSessionMocks(page);
    await page.route('**/functions/v1/marketing-templates**', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      templates.push(route.request().postDataJSON() as Record<string, unknown>);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: 'tpl-reel-2', name: 'reel', contentType: 'video', designJson: {} },
        }),
      });
    });
    await startPost(page);
    await generate(page).click();
    const grid = page.getByRole('list', { name: 'New versions' });
    await expect(grid).toBeVisible({ timeout: 60_000 });
    await grid.getByRole('button', { name: 'Open version 1' }).click();

    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Preview reel' }).click();
    const dialog = page.getByRole('dialog', { name: 'Preview reel' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Edit in Videos' })).toBeEnabled({
      timeout: 60_000,
    });
    expect(templates).toHaveLength(0);

    await dialog.getByRole('tab', { name: 'Highlights' }).click();
    await expect(dialog.getByRole('button', { name: 'Edit in Videos' })).toBeEnabled({
      timeout: 60_000,
    });
    await dialog.getByRole('button', { name: 'Edit in Videos' }).click();
    await expect.poll(() => templates.length, { timeout: 60_000 }).toBe(1);
    const scenes = (
      templates[0] as { designJson: { project: { scenes: Array<{ kind: string }> } } }
    ).designJson.project.scenes;
    expect(scenes.filter((scene) => scene.kind === 'photo').length).toBeLessThanOrEqual(3);
  });

  test('Direct with AI applies the director lines and saves them with the reel', async ({
    page,
  }) => {
    const templates: Array<Record<string, unknown>> = [];
    const reelRequests: Array<Record<string, unknown>> = [];
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installPosterMocks(page, directorResponse([]));
    await installSessionMocks(page);
    await page.route('**/functions/v1/generate-marketing-template**', async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      if (body.contentType !== 'reel') return route.fallback();
      reelRequests.push(body);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            contentType: 'reel',
            photoUrls: body.photoUrls,
            direction: {
              recipe: 'highlights',
              photoIndexes: [0],
              copy: {
                headline: 'Slow mornings',
                subheadline: 'Coffee by the pool',
                ctaLine: 'Book your stay',
              },
            },
          },
        }),
      });
    });
    await page.route('**/functions/v1/marketing-templates**', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      templates.push(route.request().postDataJSON() as Record<string, unknown>);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: 'tpl-reel-3', name: 'reel', contentType: 'video', designJson: {} },
        }),
      });
    });
    await startPost(page);
    await generate(page).click();
    const grid = page.getByRole('list', { name: 'New versions' });
    await expect(grid).toBeVisible({ timeout: 60_000 });
    await grid.getByRole('button', { name: 'Open version 1' }).click();

    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Preview reel' }).click();
    const dialog = page.getByRole('dialog', { name: 'Preview reel' });
    await expect(dialog.getByRole('button', { name: 'Edit in Videos' })).toBeEnabled({
      timeout: 60_000,
    });
    expect(reelRequests).toHaveLength(0);

    await dialog.getByRole('button', { name: 'Direct with AI' }).click();
    await expect(dialog.getByRole('button', { name: 'Direct again with AI' })).toBeVisible({
      timeout: 60_000,
    });
    expect(reelRequests).toHaveLength(1);
    await expect(dialog.getByRole('button', { name: 'Edit in Videos' })).toBeEnabled({
      timeout: 60_000,
    });
    await dialog.getByRole('button', { name: 'Edit in Videos' }).click();
    await expect.poll(() => templates.length, { timeout: 60_000 }).toBe(1);
    const saved = templates[0] as {
      designJson: { aiTokens: { copy: { headline: string; ctaLine: string } } };
    };
    expect(saved.designJson.aiTokens.copy.headline).toBe('SLOW MORNINGS');
    expect(saved.designJson.aiTokens.copy.ctaLine).toBe('Book your stay');
  });

  test('a Reel conversation directs, saves a version and opens it in Videos', async ({ page }) => {
    const saves: Array<Record<string, unknown>> = [];
    const templates: Array<Record<string, unknown>> = [];
    const reelRequests: Array<Record<string, unknown>> = [];
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installPosterMocks(page, directorResponse([]));
    await installSessionMocks(page, saves);
    await page.route('**/functions/v1/generate-marketing-template**', async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      if (body.contentType !== 'reel') return route.fallback();
      reelRequests.push(body);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            contentType: 'reel',
            photoUrls: body.photoUrls,
            direction: {
              recipe: 'highlights',
              photoIndexes: [0],
              copy: {
                headline: 'Slow mornings',
                subheadline: 'Coffee by the pool',
                ctaLine: 'Book your stay',
              },
            },
          },
        }),
      });
    });
    await page.route('**/functions/v1/marketing-templates**', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      templates.push(route.request().postDataJSON() as Record<string, unknown>);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: 'tpl-reel-4', name: 'reel', contentType: 'video', designJson: {} },
        }),
      });
    });
    await page.goto(teamRbacPaths.marketingWorkspace);
    await expect(page.getByRole('heading', { name: 'What do you want to make?' })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /^Reel/ }).first().click();
    await expect(page.locator('#ai-studio-composer')).toBeVisible();
    await page
      .getByRole('button', { name: /^Make reel|^Generate/ })
      .first()
      .click();

    await expect(page.getByRole('list', { name: 'Reel versions' })).toBeVisible({
      timeout: 60_000,
    });
    expect(reelRequests).toHaveLength(1);
    expect(saves).toHaveLength(1);
    expect(saves[0]).toMatchObject({ output: 'reel' });
    const version = (saves[0]!.versions as Array<{ spec: { recipe: string } }>)[0]!;
    expect(version.spec.recipe).toBe('highlights');

    await page.getByRole('button', { name: 'Direct again' }).click();
    await expect.poll(() => saves.length, { timeout: 60_000 }).toBe(2);
    await expect(page.getByRole('button', { name: 'Open version 2' })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Edit in Videos' })).toBeEnabled({
      timeout: 60_000,
    });
    await page.getByRole('button', { name: 'Edit in Videos' }).click();
    await expect.poll(() => templates.length, { timeout: 60_000 }).toBe(1);
  });

  test('the Posts editor AI rail makes a promo post through the poster engine', async ({
    page,
  }) => {
    const saved: Array<Record<string, unknown>> = [];
    const requests: Array<Record<string, unknown>> = [];
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installPosterMocks(page, directorResponse(requests), saved);
    await page.goto(teamRbacPaths.marketing);
    await page
      .getByRole('button', { name: /Property colors/ })
      .first()
      .click({ timeout: 20_000 });
    await expect(page.getByRole('tab', { name: 'Posts' })).toBeVisible();
    const url = new URL(page.url());
    url.searchParams.set('tab', 'design');
    url.searchParams.set('item', 'new');
    url.searchParams.set('from', 'blank');
    url.searchParams.set('size', 'instagram-post');
    await page.evaluate((target) => {
      window.history.pushState({}, '', target);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, url.pathname + url.search);

    await page.getByText('AI', { exact: true }).last().click({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Describe a post' }).click();
    await page
      .getByPlaceholder(/Describe/)
      .first()
      .fill('Weekday stays, book direct');
    const wizard = page.getByRole('dialog', { name: 'Generate design' });
    await wizard.getByRole('button', { name: 'Next' }).click();
    await wizard.getByPlaceholder(/Describe the mood/).fill('Calm and warm');
    await wizard.getByRole('button', { name: 'Next' }).click();
    await wizard.getByRole('button', { name: /^Generate/ }).click();

    await expect.poll(() => requests.length, { timeout: 60_000 }).toBeGreaterThan(0);
    expect(requests[0]).toMatchObject({ contentType: 'poster', goal: 'promo' });
    await expect.poll(() => saved.length, { timeout: 60_000 }).toBe(1);
    const designJson = saved[0]!.designJson as Record<string, unknown>;
    expect(designJson.aiGenerated).toBe(true);
    expect(designJson.posterSpec).toBeTruthy();
    await expect(page).toHaveURL(new RegExp(`item=${POSTER_ID}`), { timeout: 20_000 });
  });

  test('the Posts editor AI rail sends Fully booked through the poster engine too', async ({
    page,
  }) => {
    const saved: Array<Record<string, unknown>> = [];
    const requests: Array<Record<string, unknown>> = [];
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installPosterMocks(page, directorResponse(requests), saved);
    await page.goto(teamRbacPaths.marketing);
    await page
      .getByRole('button', { name: /Property colors/ })
      .first()
      .click({ timeout: 20_000 });
    await expect(page.getByRole('tab', { name: 'Posts' })).toBeVisible();
    const url = new URL(page.url());
    url.searchParams.set('tab', 'design');
    url.searchParams.set('item', 'new');
    url.searchParams.set('from', 'blank');
    url.searchParams.set('size', 'instagram-post');
    await page.evaluate((target) => {
      window.history.pushState({}, '', target);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, url.pathname + url.search);

    await page.getByText('AI', { exact: true }).last().click({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Describe a post' }).click();
    await page.getByRole('button', { name: 'Fully booked' }).click();
    await page
      .getByPlaceholder(/Describe/)
      .first()
      .fill('Weekday stays, book direct');
    const wizard = page.getByRole('dialog', { name: 'Generate design' });
    await wizard.getByRole('button', { name: 'Next' }).click();
    await wizard.getByPlaceholder(/Describe the mood/).fill('Calm and warm');
    await wizard.getByRole('button', { name: 'Next' }).click();
    await wizard.getByRole('button', { name: /^Generate/ }).click();

    await expect.poll(() => requests.length, { timeout: 60_000 }).toBeGreaterThan(0);
    expect(requests[0]).toMatchObject({ contentType: 'poster', goal: 'vibe' });
    expect(String(requests[0]!.prompt)).toContain('Fully booked');
    await expect.poll(() => saved.length, { timeout: 60_000 }).toBe(1);
    const designJson = saved[0]!.designJson as Record<string, unknown>;
    expect(designJson.aiGenerated).toBe(true);
    expect(designJson.posterSpec).toBeTruthy();
    await expect(page).toHaveURL(new RegExp(`item=${POSTER_ID}`), { timeout: 20_000 });
  });

  test('an unreachable listing photo never produces a broken post', async ({ page }) => {
    const requests: Array<Record<string, unknown>> = [];
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installPosterMocks(page, directorResponse(requests));
    await installSessionMocks(page);
    // Registered last, so it wins: the listing photo is unreachable.
    await page.route(PHOTO_URL, (route) => route.fulfill({ status: 500, body: 'nope' }));
    await startPost(page);
    await generate(page).click();

    // Either posts arrive without the photo or the host gets a clear error: never a
    // saved post that shows the loader's red error frame (the render guard throws first).
    const grid = page.getByRole('list', { name: 'New versions' });
    const error = page.getByText('Could not draw these posts. Try again.');
    await expect(grid.or(error)).toBeVisible({ timeout: 60_000 });
    expect(requests).toHaveLength(1);
    await expect(page.getByText('Can not load the image')).toHaveCount(0);
  });

  test('out of credits shows the quota message and no posts', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installPosterMocks(page, (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'AI credits used up', upgradeHook: true }),
      })
    );
    await startPost(page);
    await generate(page).click();

    await expect(page.getByRole('button', { name: 'Buy credits' })).toBeVisible({
      timeout: 30_000,
    });
    // The form stays put: the quota path must not fall back to free quick layouts.
    await expect(generate(page)).toBeEnabled();
    await expect(page.getByRole('button', { name: /^Version \d/ })).toHaveCount(0);
  });

  // fixme: Marketing Studio entry moved to the New post gallery on 2026-10-30 (ledger PR-133).
  test.fixme('Edit in Posts saves the design and opens it in the Posts editor', async ({
    page,
  }) => {
    const saved: Array<Record<string, unknown>> = [];
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installPosterMocks(page, directorResponse([]), saved);
    await startPost(page);
    await generate(page).click();

    const edit = page.getByRole('button', { name: 'Edit in Posts' });
    await expect(edit).toBeEnabled({ timeout: 60_000 });
    await edit.click();

    await expect(page).toHaveURL(new RegExp(`item=${POSTER_ID}`), { timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Back to Posts' })).toBeVisible({
      timeout: 20_000,
    });
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      aspectPreset: 'instagram-portrait',
      contentType: 'design',
      kind: 'design',
    });
    const designJson = saved[0]!.designJson as Record<string, unknown>;
    expect(designJson.aiGenerated).toBe(true);
    expect(designJson.posterSpec).toBeTruthy();
    expect((designJson.polotno as { width: number; height: number }).height).toBe(1350);
  });

  test('without the AI generation plan, Generate opens the upgrade modal', async ({ page }) => {
    const requests: Array<Record<string, unknown>> = [];
    await installPropertyTeamRbacMocks(page, 'full_access', {
      aiMarketingGenerationAllowed: false,
    });
    await installPosterMocks(page, directorResponse(requests));
    await startPost(page);
    await generate(page).click();

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 20_000 });
    expect(requests).toHaveLength(0);
  });
});

test.describe('@ci @flaky marketing AI Post on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test.setTimeout(90_000);

  const fitsWidth = (page: Page) =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

  test('the create form, grid and quick edit sheet fit 375px with 44px targets', async ({
    page,
  }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installPosterMocks(page, directorResponse([]));
    await installSessionMocks(page);
    await startPost(page);
    expect(await fitsWidth(page)).toBe(true);
    await expect(page.getByRole('radio', { name: /Lifestyle/ })).toBeVisible();

    await generate(page).click();
    const grid = page.getByRole('list', { name: 'New versions' });
    await expect(grid).toBeVisible({ timeout: 60_000 });
    expect(await fitsWidth(page)).toBe(true);
    for (const thumb of await grid
      .getByRole('button', { name: /^(Like|Dislike) this post$/ })
      .all()) {
      const box = await thumb.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    await grid.getByRole('button', { name: 'Open version 1' }).click();
    await page.getByRole('button', { name: 'Quick edit' }).click();
    const sheet = page.getByRole('dialog', { name: 'Edit this post' });
    await expect(sheet).toBeVisible();
    const apply = sheet.getByRole('button', { name: 'Apply' });
    const cancel = sheet.getByRole('button', { name: 'Cancel' });
    for (const button of [apply, cancel]) {
      const box = await button.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.x + box!.width).toBeLessThanOrEqual(375);
    }
    expect(await fitsWidth(page)).toBe(true);

    // Leaving with edits asks first: the unsaved-changes guard is wired.
    await sheet.getByLabel('Headline').fill('A changed headline');
    await cancel.click();
    await expect(page.getByRole('button', { name: 'Keep editing' })).toBeVisible();
  });
});
