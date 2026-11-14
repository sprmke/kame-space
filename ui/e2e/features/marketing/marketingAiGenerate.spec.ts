import { expect, test, type Page } from '@playwright/test';

import { mockPublicPropertyBody } from '../../shared/mockFixtures';
import {
  installPropertyTeamRbacMocks,
  teamRbacPaths,
} from '../team/shared/propertyTeamRbacHarness';

/**
 * AI Studio, photo and clip. Step 1 picks what to make, step 2 is one short form,
 * and a finished creation opens as a conversation with its versions.
 */
const SEEDED_TITLE = 'Sunset shot of the rooftop pool deck';

const startCard = (page: Page, title: 'Post' | 'Photo' | 'Clip') =>
  page.getByRole('button', { name: new RegExp(`^${title}`) }).first();

async function openStudio(page: Page) {
  await page.goto(teamRbacPaths.marketingWorkspace);
  await expect(page.getByRole('heading', { name: 'Marketing' })).toBeVisible({ timeout: 20_000 });
}

/** Step 1 → step 2, for a property with nothing made yet. */
async function startNew(page: Page, title: 'Post' | 'Photo' | 'Clip') {
  await expect(page.getByRole('heading', { name: 'What do you want to make?' })).toBeVisible();
  await startCard(page, title).click();
  await expect(page.locator('#ai-studio-composer')).toBeVisible();
}

test.describe('@ci @flaky marketing AI generate tab', () => {
  test('starting a photo opens one short form with everything else under Advanced', async ({
    page,
  }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await openStudio(page);
    await startNew(page, 'Photo');

    await expect(page.getByRole('button', { name: 'Back to AI Studio' })).toBeVisible();
    await expect(page.getByText('New photo')).toBeVisible();
    // Enhance a photo is the default; the old text-to-image flow is one tap away.
    await expect(page.getByText('What should change?')).toBeVisible();
    await page.getByRole('tab', { name: 'Create a scene' }).click();
    await expect(page.getByRole('button', { name: 'Choose' })).toHaveCount(0);
    await expect(page.locator('#ai-studio-prompt')).toBeVisible();
    await expect(page.getByRole('button', { name: /Add photos/ })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Size' })).toBeVisible();
    await expect(page.getByRole('button', { name: /generate/i })).toBeVisible();

    // Quality, look and image size stay out of the way until asked for.
    await expect(page.getByRole('tablist', { name: 'Quality' })).toHaveCount(0);
    await page.getByRole('button', { name: /Advanced/ }).click();
    await expect(page.getByRole('tablist', { name: 'Quality' })).toBeVisible();
    await expect(page.getByRole('tablist', { name: 'Image size' })).toBeVisible();
  });

  test('Enhance a photo sends one reference, the preset and a structure-locked intent', async ({
    page,
  }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', { marketingGenerationSeeded: true });
    let sent: Record<string, unknown> | null = null;
    await page.route('**/functions/v1/generate-marketing-media**', async (route) => {
      sent = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Generation failed' }),
      });
    });
    await openStudio(page);
    await startNew(page, 'Photo');

    // Generate stays off until one photo is picked.
    await page.getByRole('button', { name: /Add photos|Add a photo/ }).click();
    const chooser = page.getByRole('dialog');
    const uploadsTab = chooser.getByRole('tab', { name: /Uploads/ });
    if (await uploadsTab.isVisible()) await uploadsTab.click();
    await page.getByRole('button', { name: /Use balcony\.jpg/i }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('radio', { name: /Golden hour/ }).click();
    await page.getByRole('button', { name: /generate/i }).click();

    await expect.poll(() => sent).not.toBeNull();
    expect(sent).toMatchObject({ mediaType: 'image', intent: 'enhance', enhancePrompt: false });
    expect((sent as unknown as { referenceIds: string[] }).referenceIds).toHaveLength(1);
    expect((sent as unknown as { prompt: string }).prompt).toMatch(/golden/i);
  });

  test('Extend to 9:16 sends the story shape with the structure-locked intent', async ({
    page,
  }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', { marketingGenerationSeeded: true });
    let sent: Record<string, unknown> | null = null;
    await page.route('**/functions/v1/generate-marketing-media**', async (route) => {
      sent = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Generation failed' }),
      });
    });
    await openStudio(page);
    await startNew(page, 'Photo');
    await page.getByRole('button', { name: /Add photos|Add a photo/ }).click();
    const chooser = page.getByRole('dialog');
    const uploadsTab = chooser.getByRole('tab', { name: /Uploads/ });
    if (await uploadsTab.isVisible()) await uploadsTab.click();
    await page.getByRole('button', { name: /Use balcony\.jpg/i }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('radio', { name: /Extend to 9:16/ }).click();
    await page.getByRole('button', { name: /generate/i }).click();

    await expect.poll(() => sent).not.toBeNull();
    expect(sent).toMatchObject({ intent: 'enhance', aspectRatio: '9:16' });
  });

  test('an enhanced photo opens with a before and after slider', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', { marketingGenerationSeeded: true });
    const A =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const B =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const sessionId = '7d1f0a52-4b6c-4e0a-9a53-0c1d2e3f4a5b';
    const job = {
      id: 'mgj-enhance-1',
      sessionId,
      parentJobId: null,
      mediaType: 'image',
      jobStatus: 'completed',
      prompt: 'brighten',
      model: 'gemini-3.1-flash-image',
      qualityTier: 'standard',
      aspectRatio: '1:1',
      imageSize: '1K',
      referenceUrls: [A],
      referencePaths: [],
      outputUrl: B,
      outputMimeType: 'image/png',
      generationOptions: { aiEdited: true },
      estimatedCredits: 45,
      creditsConsumed: 45,
      createdAt: '2026-09-12T08:00:00.000Z',
      updatedAt: '2026-09-12T08:00:00.000Z',
      completedAt: '2026-09-12T08:00:00.000Z',
    };
    const ok = (data: unknown) => ({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data }),
    });
    await page.route('**/functions/v1/generate-marketing-media**', (route) =>
      route.fulfill(ok({ job }))
    );
    await page.route('**/functions/v1/get-marketing-generation-job**', (route) =>
      route.fulfill(ok({ job }))
    );
    await page.route('**/functions/v1/marketing-ai-sessions**', (route) =>
      route.fulfill(
        ok({
          session: {
            id: sessionId,
            output: 'image',
            title: 'Brightened photo',
            themeKey: null,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
            deletedAt: null,
          },
          jobs: [job],
          postVersions: [],
        })
      )
    );
    await openStudio(page);
    await startNew(page, 'Photo');
    await page.getByRole('button', { name: /Add photos|Add a photo/ }).click();
    const chooser = page.getByRole('dialog');
    const uploadsTab = chooser.getByRole('tab', { name: /Uploads/ });
    if (await uploadsTab.isVisible()) await uploadsTab.click();
    await page.getByRole('button', { name: /Use balcony\.jpg/i }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /generate/i }).click();

    const slider = page.getByRole('slider', { name: 'Compare before and after' });
    await expect(slider).toBeVisible({ timeout: 30_000 });
    await slider.fill('80');
    await expect(page.getByText('Before', { exact: true })).toBeVisible();
    await expect(page.getByText('After', { exact: true })).toBeVisible();
  });

  test('a finished clip can be used in a reel', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', { marketingGenerationSeeded: true });
    const sessionId = '7d1f0a52-4b6c-4e0a-9a53-0c1d2e3f4a5b';
    const CLIP = 'https://cdn.example.test/clip.mp4';
    const PHOTO =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const job = {
      id: 'mgj-clip-1',
      sessionId,
      parentJobId: null,
      mediaType: 'video',
      jobStatus: 'completed',
      prompt: 'slow push in',
      model: 'veo',
      qualityTier: 'standard',
      aspectRatio: '9:16',
      imageSize: null,
      resolution: '720p',
      durationSeconds: 8,
      referenceUrls: [PHOTO],
      referencePaths: [],
      outputUrl: CLIP,
      outputMimeType: 'video/mp4',
      generationOptions: {},
      estimatedCredits: 100,
      creditsConsumed: 100,
      createdAt: '2026-09-12T08:00:00.000Z',
      updatedAt: '2026-09-12T08:00:00.000Z',
      completedAt: '2026-09-12T08:00:00.000Z',
    };
    const ok = (data: unknown) => ({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data }),
    });
    const templates: Array<Record<string, unknown>> = [];
    const LISTING_PHOTO = 'https://e2e-photos.test/living-room.png';
    await page.route(LISTING_PHOTO, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'image/png',
        headers: { 'access-control-allow-origin': '*' },
        body: Buffer.from(PHOTO.split(',')[1]!, 'base64'),
      })
    );
    await page.route('**/functions/v1/get-public-property**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockPublicPropertyBody,
          data: { ...mockPublicPropertyBody.data, images: [LISTING_PHOTO] },
        }),
      })
    );
    await page.route('**/functions/v1/generate-marketing-media**', (route) =>
      route.fulfill(ok({ job }))
    );
    await page.route('**/functions/v1/get-marketing-generation-job**', (route) =>
      route.fulfill(ok({ job }))
    );
    await page.route('**/functions/v1/marketing-ai-sessions**', (route) =>
      route.fulfill(
        ok({
          session: {
            id: sessionId,
            output: 'video',
            title: 'Pool clip',
            themeKey: null,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
            deletedAt: null,
          },
          jobs: [job],
          postVersions: [],
        })
      )
    );
    await page.route('**/functions/v1/marketing-templates**', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      templates.push(route.request().postDataJSON() as Record<string, unknown>);
      return route.fulfill(
        ok({ id: 'tpl-reel-2', name: 'reel', contentType: 'video', designJson: {} })
      );
    });
    await openStudio(page);
    await startNew(page, 'Clip');
    await page
      .getByRole('button', { name: /Add photos|Add a photo|Choose/ })
      .first()
      .click();
    const chooser = page.getByRole('dialog');
    const uploadsTab = chooser.getByRole('tab', { name: /Uploads/ });
    if (await uploadsTab.isVisible()) await uploadsTab.click();
    await page.getByRole('button', { name: /Use balcony\.jpg/i }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /generate/i }).click();

    await page.getByRole('button', { name: 'More actions' }).click({ timeout: 30_000 });
    await page.getByRole('menuitem', { name: 'Use in a reel' }).click();
    await expect.poll(() => templates.length, { timeout: 30_000 }).toBe(1);
    const saved = templates[0] as {
      aspectPreset: string;
      designJson: {
        project: { scenes: Array<{ imageUrl: string | null; backgroundMediaType?: string }> };
      };
    };
    expect(saved.aspectPreset).toBe('instagram-story');
    const first = saved.designJson.project.scenes[0]!;
    expect(first.imageUrl).toBe(CLIP);
    expect(first.backgroundMediaType).toBe('video');
  });

  test('Clip sends the camera move, sound and an 8s length', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    let sent: Record<string, unknown> | null = null;
    await page.route('**/functions/v1/generate-marketing-media**', async (route) => {
      sent = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Generation failed' }),
      });
    });
    await openStudio(page);
    await startNew(page, 'Clip');

    await page.locator('#ai-studio-prompt').fill('Curtains moving in a soft breeze');
    await page.getByRole('button', { name: /Advanced/ }).click();
    await page.getByRole('radio', { name: 'Orbit' }).click();
    await page.getByRole('tablist', { name: 'Sound' }).getByRole('tab', { name: 'Music' }).click();
    await page
      .locator('#ai-studio-composer')
      .getByRole('button', { name: /generate/i })
      .click();

    await expect.poll(() => sent).not.toBeNull();
    expect(sent).toMatchObject({
      mediaType: 'video',
      prompt: 'Curtains moving in a soft breeze',
      cameraMove: 'orbit',
      sound: 'music',
      durationSeconds: 8,
      resolution: '1080p',
      enhancePrompt: true,
    });
  });

  test('below Business, Generate opens the upgrade modal and sends nothing', async ({ page }) => {
    const generateCalls: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/functions/v1/generate-marketing-media'))
        generateCalls.push(req.url());
    });
    await installPropertyTeamRbacMocks(page, 'full_access', { videoPlanAllowed: false });
    await openStudio(page);
    await startNew(page, 'Clip');

    await page.locator('#ai-studio-prompt').fill('Slow pan across the living room');
    await page
      .locator('#ai-studio-composer')
      .getByRole('button', { name: /generate/i })
      .click();

    await expect(page.getByRole('dialog')).toBeVisible();
    expect(generateCalls).toEqual([]);
  });

  test('the photo chooser lists saved uploads', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', { marketingGenerationSeeded: true });
    await openStudio(page);

    await page.getByRole('button', { name: 'New photo' }).click();
    await expect(page.locator('#ai-studio-composer')).toBeVisible();
    await page.getByRole('button', { name: /Add photos|Add a photo/ }).click();
    const chooser = page.getByRole('dialog', { name: /Choose (a )?photos?/ });
    await expect(chooser).toBeVisible();
    const uploadsTab = chooser.getByRole('tab', { name: /Uploads/ });
    if (await uploadsTab.isVisible()) await uploadsTab.click();
    await expect(page.getByRole('button', { name: /Use balcony\.jpg/i })).toBeVisible();
  });

  // fixme: Marketing Studio entry moved to the New post gallery on 2026-10-30 (ledger PR-133).
  test.fixme('a finished photo opens as a conversation with its versions', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', { marketingGenerationSeeded: true });
    await openStudio(page);

    await expect(page.getByText('Your creations')).toBeVisible();
    await page.getByRole('button', { name: new RegExp(`^Open ${SEEDED_TITLE}`) }).click();

    await expect(page.getByRole('region', { name: 'Preview' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /^Version 1/ })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Describe a change' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download' })).toBeVisible();

    // Back returns to the creations grid without leaving the tab.
    await page.getByRole('button', { name: 'Back to AI Studio' }).click();
    await expect(page.getByText('Your creations')).toBeVisible();
  });

  test('a role without the photo permission cannot start one', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'operations');
    await openStudio(page);

    await expect(page.getByRole('heading', { name: 'What do you want to make?' })).toBeVisible();
    await expect(startCard(page, 'Photo')).toBeDisabled();
    await expect(startCard(page, 'Clip')).toBeDisabled();
    await expect(page.getByText('Ask the owner for access').first()).toBeVisible();
  });
});
