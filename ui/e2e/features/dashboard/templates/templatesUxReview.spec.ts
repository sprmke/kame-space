import { expect, test, type Page } from '@playwright/test';
import { devices } from '@playwright/test';

import {
  demoPause,
  installTemplatesReviewMocks,
  openTemplates,
  TEMPLATES_E2E_PATH,
} from './shared/templatesHarness';

/**
 * Property Templates UI/UX review captures. @demo — never CI.
 *
 *   PLAYWRIGHT_CAPTURE_SCREENS=1 bunx playwright test \
 *     ui/e2e/features/dashboard/templates/templatesUxReview.spec.ts --project=chromium
 *
 * Writes stills to `docs/workflow/in-progress/templates-ux-review/screenshots/` and prints
 * layout, tap-target, contrast and semantics measurements used by the review.
 *
 * The assertions here are deliberately light: this is the evidence pass, not the regression
 * suite. `propertyTemplatesWorkbench.spec.ts` owns the hard behaviour gates.
 */

const REVIEW_DIR = 'docs/workflow/in-progress/templates-ux-review';
const SHOT_SET = process.env.TEMPLATES_SHOT_DIR ?? 'latest';
const CAPTURE = process.env.PLAYWRIGHT_CAPTURE_SCREENS === '1';

async function shot(page: Page, name: string, fullPage = false): Promise<void> {
  if (!CAPTURE) return;
  await page
    .locator('[data-admin-mobile-page], main')
    .first()
    .waitFor({ timeout: 15_000 })
    .catch(() => undefined);
  // Two frames after the caller's own visibility assertion, so a screenshot never catches
  // the first paint of a sheet that is still mounting. No fixed sleep.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })
  );
  await demoPause(page, 0.3);
  await page.screenshot({
    path: `${REVIEW_DIR}/screenshots/${SHOT_SET}/${name}.png`,
    fullPage,
    animations: 'disabled',
  });
}

function watchConsole(page: Page, label: string): void {
  page.on('pageerror', (error) => console.log(`[${label}] PAGEERROR: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      console.log(`[${label}] CONSOLE: ${message.text().slice(0, 240)}`);
    }
  });
}

type Metrics = {
  viewport: number;
  overflowX: number;
  clipped: Array<{ text: string; scrollWidth: number; clientWidth: number }>;
  smallTapTargets: Array<{ text: string; w: number; h: number; hasPad: boolean }>;
  lowContrast: Array<{ text: string; ratio: number; size: number; color: string; bg: string }>;
  headings: Record<string, number>;
  unnamedControls: string[];
  unlabeledFields: string[];
  imagesWithoutAlt: number;
  tinyText: Array<{ text: string; size: number }>;
};

/**
 * Reports what a naive overflow check misses: flex children clipped inside their own box,
 * visual-only controls under 44px, text under 4.5:1, and missing accessible names.
 */
async function measure(page: Page, label: string): Promise<Metrics> {
  const data = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('[data-admin-mobile-page]') ?? document.body;
    const visible = (element: Element) => {
      const style = getComputedStyle(element);
      if (
        style.visibility === 'hidden' ||
        style.display === 'none' ||
        Number(style.opacity) === 0
      ) {
        return false;
      }
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const label = (element: Element) =>
      (
        element.getAttribute('aria-label') ||
        element.getAttribute('title') ||
        element.textContent ||
        element.tagName
      )
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 70);

    const hasHitPad = (element: Element) => {
      const before = getComputedStyle(element, '::before');
      return (
        before.content !== 'none' && before.content !== 'normal' && before.position === 'absolute'
      );
    };

    const clipped = Array.from(root.querySelectorAll<HTMLElement>('*'))
      .filter((element) => {
        if (!visible(element) || !element.textContent?.trim()) return false;
        const style = getComputedStyle(element);
        if (style.overflow === 'visible') return false;
        return element.scrollWidth > element.clientWidth + 1;
      })
      .slice(0, 10)
      .map((element) => ({
        text: label(element),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      }));

    const interactiveSelector =
      'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="tab"], [role="option"], [role="menuitem"], [role="switch"], [role="combobox"]';
    const smallTapTargets = Array.from(root.querySelectorAll<HTMLElement>(interactiveSelector))
      .filter((element) => visible(element))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width < 44 || rect.height < 44;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          text: label(element),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
          hasPad: hasHitPad(element),
        };
      })
      .slice(0, 25);

    const parseColor = (value: string) => {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match) return { r: 0, g: 0, b: 0, a: 1 };
      const parts = match[1]!
        .split(/[,\s/]+/)
        .filter(Boolean)
        .map(Number);
      return { r: parts[0] ?? 0, g: parts[1] ?? 0, b: parts[2] ?? 0, a: parts[3] ?? 1 };
    };
    const luminance = ({ r, g, b }: { r: number; g: number; b: number }) => {
      const channel = (value: number) => {
        const v = value / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };
    const blend = (
      top: { r: number; g: number; b: number; a: number },
      bottom: { r: number; g: number; b: number; a: number }
    ) => ({
      r: top.r * top.a + bottom.r * (1 - top.a),
      g: top.g * top.a + bottom.g * (1 - top.a),
      b: top.b * top.a + bottom.b * (1 - top.a),
      a: 1,
    });
    const backgroundOf = (element: Element) => {
      let node: Element | null = element;
      let stack: Array<{ r: number; g: number; b: number; a: number }> = [];
      while (node) {
        const color = parseColor(getComputedStyle(node).backgroundColor);
        if (color.a > 0) stack = [color, ...stack];
        if (color.a >= 1) break;
        node = node.parentElement;
      }
      let base = { r: 255, g: 255, b: 255, a: 1 };
      for (const color of stack) base = blend(color, base);
      return base;
    };

    const lowContrast: Array<{
      text: string;
      ratio: number;
      size: number;
      color: string;
      bg: string;
    }> = [];
    const tinyText: Array<{ text: string; size: number }> = [];

    const textElements = Array.from(root.querySelectorAll<HTMLElement>('*')).filter((element) => {
      if (!visible(element)) return false;
      const direct = Array.from(element.childNodes).some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
      );
      return direct;
    });

    for (const element of textElements) {
      const style = getComputedStyle(element);
      const size = Number.parseFloat(style.fontSize) || 14;
      const text = label(element);
      if (size < 11 && text) tinyText.push({ text, size });
      const fg = parseColor(style.color);
      const bg = backgroundOf(element);
      const blended = fg.a < 1 ? blend(fg, bg) : fg;
      const l1 = luminance(blended);
      const l2 = luminance(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const weight = Number.parseInt(style.fontWeight, 10) || 400;
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      const threshold = large ? 3 : 4.5;
      if (ratio < threshold && text) {
        lowContrast.push({
          text,
          ratio: Math.round(ratio * 100) / 100,
          size: Math.round(size),
          color: style.color,
          bg: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
        });
      }
    }

    const headings: Record<string, number> = {};
    for (const heading of Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6'))) {
      if (!visible(heading)) continue;
      const tag = heading.tagName.toLowerCase();
      headings[tag] = (headings[tag] ?? 0) + 1;
    }

    const unnamedControls = Array.from(root.querySelectorAll<HTMLElement>(interactiveSelector))
      .filter((element) => visible(element))
      .filter((element) => {
        const name =
          element.getAttribute('aria-label') ||
          element.getAttribute('title') ||
          element.textContent ||
          '';
        return name.trim().length === 0;
      })
      .map((element) => element.tagName.toLowerCase())
      .slice(0, 10);

    const unlabeledFields = Array.from(
      root.querySelectorAll<HTMLElement>('input:not([type="hidden"]), select, textarea')
    )
      .filter((field) => visible(field))
      .filter((field) => {
        const id = field.getAttribute('id');
        const hasLabel = id ? Boolean(document.querySelector(`label[for="${id}"]`)) : false;
        return (
          !hasLabel && !field.getAttribute('aria-label') && !field.getAttribute('aria-labelledby')
        );
      })
      .map((field) => field.tagName.toLowerCase())
      .slice(0, 10);

    const imagesWithoutAlt = Array.from(root.querySelectorAll('img')).filter(
      (image) => visible(image) && !image.getAttribute('alt')
    ).length;

    return {
      viewport: window.innerWidth,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      clipped,
      smallTapTargets,
      lowContrast: lowContrast.slice(0, 15),
      headings,
      unnamedControls,
      unlabeledFields,
      imagesWithoutAlt,
      tinyText: tinyText.slice(0, 10),
    };
  });

  console.log(`\n[metrics ${label}]`, JSON.stringify(data, null, 2));
  return data as Metrics;
}

test.describe('templates ux review @demo', () => {
  test.setTimeout(240_000);

  test('every supported width', async ({ page }) => {
    watchConsole(page, 'widths');
    await installTemplatesReviewMocks(page);

    const widths = [
      { name: '1920', width: 1920, height: 1080 },
      { name: '1440', width: 1440, height: 960 },
      { name: '1280', width: 1280, height: 800 },
      { name: '1024', width: 1024, height: 768 },
      { name: '834', width: 834, height: 1112 },
      { name: '768', width: 768, height: 1024 },
      { name: '430', width: 430, height: 932 },
      { name: '390', width: 390, height: 844 },
      { name: '360', width: 360, height: 800 },
    ];

    for (const size of widths) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto(TEMPLATES_E2E_PATH);
      await expect(page.getByRole('heading', { name: 'Templates', exact: true })).toBeVisible({
        timeout: 30_000,
      });
      await demoPause(page, 0.8);
      await shot(page, `templates-${size.name}`, true);
      const metrics = await measure(page, size.name);
      expect(metrics.overflowX).toBeLessThanOrEqual(size.width < 768 ? 1 : 2);
    }
  });

  test('desktop rail, filter and search states', async ({ page }) => {
    watchConsole(page, 'rail');
    await installTemplatesReviewMocks(page);
    await page.setViewportSize({ width: 1440, height: 960 });
    await openTemplates(page);
    await demoPause(page, 0.8);
    await shot(page, '01-desktop-default');

    const rail = page.getByRole('complementary', { name: 'Templates' });

    // Hover a host-owned row to reveal the organise trigger.
    await rail.getByRole('button', { name: /^Airport transfer/ }).hover();
    await demoPause(page, 0.6);
    await shot(page, '02-desktop-rail-row-hover');

    // Row overflow sheet.
    await rail.getByRole('button', { name: 'Template actions for Airport transfer' }).click();
    await demoPause(page, 0.5);
    await shot(page, '03-desktop-rail-row-menu');
    await page.keyboard.press('Escape');

    // Group overflow: add template / fold.
    await rail.getByRole('button', { name: 'Group actions for Stay guide' }).click();
    await demoPause(page, 0.5);
    await shot(page, '04-desktop-rail-group-menu');
    await page.keyboard.press('Escape');

    // Type filter popover.
    await page.getByRole('button', { name: 'Filter template type' }).click();
    await demoPause(page, 0.5);
    await shot(page, '05-desktop-filter-popover');
    await page.getByRole('option', { name: 'Custom', exact: true }).click();
    await demoPause(page, 0.7);
    await shot(page, '06-desktop-filter-custom');
    await measure(page, 'desktop-filter-custom');

    await page.getByRole('button', { name: 'Filter template type' }).click();
    await page.getByRole('option', { name: 'All types', exact: true }).click();

    // Search with no results.
    const search = page.getByRole('searchbox', { name: 'Search templates' });
    await search.fill('zzzz');
    await demoPause(page, 0.6);
    await shot(page, '07-desktop-search-empty');
    await search.fill('house');
    await demoPause(page, 0.6);
    await shot(page, '08-desktop-search-hit');
    await search.fill('');
  });

  test('editor states: preview, subject, visibility, placeholders, save', async ({ page }) => {
    watchConsole(page, 'editor');
    await installTemplatesReviewMocks(page);
    await page.setViewportSize({ width: 1440, height: 960 });
    await openTemplates(page);
    await demoPause(page, 0.6);

    const pane = page.getByRole('region', { name: 'Template editor' });

    // Preview tab.
    await pane.getByRole('tab', { name: 'Preview' }).click();
    await expect(pane.locator('iframe')).toBeVisible();
    await demoPause(page, 1.2);
    await shot(page, '09-desktop-preview');
    await measure(page, 'desktop-preview');

    await pane.getByRole('tab', { name: 'Edit' }).click();
    await demoPause(page, 0.4);

    // Placeholders dialog.
    await page.getByRole('button', { name: 'Placeholders' }).click();
    await demoPause(page, 0.5);
    await shot(page, '10-desktop-placeholders');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Unsaved state on the visibility switch, then the leave guard.
    const rail = page.getByRole('complementary', { name: 'Templates' });
    await pane.getByRole('switch', { name: 'Show to guests' }).click();
    await expect(pane.getByText('Unsaved', { exact: true })).toBeVisible();
    await demoPause(page, 0.5);
    await shot(page, '11-desktop-unsaved-visibility');

    await rail.getByRole('button', { name: /^Booking confirmation/ }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await demoPause(page, 0.6);
    await shot(page, '11b-desktop-unsaved-guard');
    await measure(page, 'desktop-unsaved-guard');
    await page.getByRole('button', { name: 'Discard', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await demoPause(page, 0.8);

    // Automated email with subject and automation facts.
    await shot(page, '13-desktop-automated-email');

    // Dirty subject, then Save opens the verification dialog.
    const subject = pane.getByLabel('Subject', { exact: true });
    await subject.fill('Your confirmed stay at Solea Mactan');
    await demoPause(page, 0.4);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await demoPause(page, 1);
    await shot(page, '12-desktop-save-verification');
    await measure(page, 'desktop-save-verification');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await demoPause(page, 0.5);

    // Leave without saving, then the remaining rows.
    await rail.getByRole('button', { name: /^GAF request/ }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Discard', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await demoPause(page, 0.8);
    await shot(page, '14-desktop-fixed-subject');

    // Hidden guide section badge.
    await rail.getByRole('button', { name: /^Getting here/ }).click();
    await demoPause(page, 0.6);
    await shot(page, '15-desktop-hidden-section');

    // A newer default banner.
    await rail.getByRole('button', { name: /^Using the unit/ }).click();
    await demoPause(page, 0.6);
    await shot(page, '16-desktop-new-default-banner');

    // Reset confirmation.
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await demoPause(page, 0.6);
    await shot(page, '17-desktop-reset-confirm');
    await page.keyboard.press('Escape');
  });

  test('custom template create, organise and send', async ({ page }) => {
    watchConsole(page, 'custom');
    const state = await installTemplatesReviewMocks(page);
    await page.setViewportSize({ width: 1440, height: 960 });
    await openTemplates(page);
    await demoPause(page, 0.6);

    // Create.
    await page.getByRole('button', { name: 'New template' }).click();
    await demoPause(page, 0.8);
    await shot(page, '18-desktop-new-template-dialog');
    await page.getByLabel('Name', { exact: true }).fill('Early check-in offer');
    await demoPause(page, 0.4);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await demoPause(page, 0.8);
    await shot(page, '19-desktop-create-verification');
    // Verification cancelled on purpose, then reload so the draft dialog does not linger.
    await page.keyboard.press('Escape');
    await demoPause(page, 0.4);
    await page.reload();
    await page
      .getByRole('heading', { name: 'Templates', exact: true })
      .waitFor({ timeout: 30_000 });
    await demoPause(page, 0.6);

    // New group.
    await page.getByRole('button', { name: 'New group' }).click();
    await demoPause(page, 0.6);
    await shot(page, '20-desktop-new-group');
    await page.getByLabel('Group name').fill('Seasonal');
    await page.getByRole('button', { name: 'Create group' }).click();
    await demoPause(page, 0.8);
    await shot(page, '21-desktop-after-new-group');

    const rail = page.getByRole('complementary', { name: 'Templates' });
    await rail.getByRole('button', { name: /^Arrival instructions/ }).click();
    await demoPause(page, 0.6);

    // Move. (A folder and a template may share a name; this folder menu is the first match.)
    await rail.getByRole('button', { name: 'Group actions for Arrival pack' }).first().click();
    await demoPause(page, 0.4);
    await shot(page, '22-desktop-folder-menu');
    await page.keyboard.press('Escape');

    // Row overflow triggers are hover-revealed on desktop; hover the row first.
    await rail.getByRole('button', { name: /^Late check-out offer/ }).hover();
    await rail.getByRole('button', { name: 'Template actions for Late check-out offer' }).click();
    await page.getByRole('menuitem', { name: 'Move' }).click();
    await demoPause(page, 0.6);
    await shot(page, '23-desktop-move-dialog');
    await page.getByRole('button', { name: 'Seasonal' }).click();
    await demoPause(page, 0.8);

    // Delete confirmation.
    await rail.getByRole('button', { name: /^Airport transfer/ }).hover();
    await rail.getByRole('button', { name: 'Template actions for Airport transfer' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await demoPause(page, 0.6);
    await shot(page, '24-desktop-delete-confirm');
    await page.getByRole('button', { name: 'Delete template' }).click();
    await demoPause(page, 0.8);

    // Send to guest.
    await rail.getByRole('button', { name: /^Arrival instructions/ }).click();
    await demoPause(page, 0.4);
    const pane = page.getByRole('region', { name: 'Template editor' });
    await pane.getByRole('button', { name: 'Actions for Arrival instructions' }).click();
    await demoPause(page, 0.4);
    await shot(page, '25-desktop-editor-overflow');
    await page.getByRole('menuitem', { name: 'Send to guest' }).click();
    await demoPause(page, 0.8);
    await shot(page, '26-desktop-send-to-guest');
    await measure(page, 'desktop-send-to-guest');
    await page.keyboard.press('Escape');

    console.log('[templates requests]', JSON.stringify(state.requests, null, 2));
    expect(state.requests.length).toBeGreaterThan(0);
  });

  test('phone: list, sheets, editor and preview', async ({ browser }) => {
    // A real phone context: `hasTouch` turns `(hover: hover)` off, which is what reveals
    // the row ⋯ on device. A desktop context at 390px would hide it behind a hover.
    const context = await browser.newContext({
      ...devices['iPhone 13'],
      viewport: { width: 390, height: 844 },
      storageState: './ui/e2e/shared/consentStorageState.json',
      timezoneId: 'Asia/Manila',
      locale: 'en-PH',
    });
    const page = await context.newPage();
    watchConsole(page, 'phone');
    await installTemplatesReviewMocks(page);
    await openTemplates(page);
    await demoPause(page, 0.8);
    await shot(page, '30-phone-list');
    await measure(page, 'phone-list');

    // Filter sheet.
    await page.getByRole('button', { name: 'Filter template type' }).click();
    await demoPause(page, 0.6);
    await shot(page, '31-phone-filter-sheet');
    await page.getByRole('option', { name: 'All types', exact: true }).click();
    await demoPause(page, 0.4);

    // Hero actions.
    await page.getByRole('button', { name: 'Template actions', exact: true }).click();
    await demoPause(page, 0.6);
    await shot(page, '32-phone-hero-menu');
    await page.keyboard.press('Escape');
    await demoPause(page, 0.3);

    // Row overflow (filter to the row first so the rail never scrolls it behind a sticky heading).
    const search = page.getByRole('searchbox', { name: 'Search templates' });
    await search.fill('airport');
    await demoPause(page, 0.6);
    await shot(page, '33a-phone-search-hit');
    await page.getByRole('button', { name: 'Template actions for Airport transfer' }).click();
    await demoPause(page, 0.6);
    await shot(page, '33-phone-row-sheet');
    await page.keyboard.press('Escape');
    await search.fill('');
    await demoPause(page, 0.4);

    // Editor.
    const rail = page.getByRole('complementary', { name: 'Templates' });
    await rail.getByRole('button', { name: /^Airport transfer/ }).click();
    const pane = page.getByRole('region', { name: 'Template editor' });
    await expect(pane.getByRole('heading', { name: 'Airport transfer' })).toBeVisible();
    await demoPause(page, 1);
    await shot(page, '34-phone-editor');
    await measure(page, 'phone-editor');

    // Overflow in the editor.
    await pane.getByRole('button', { name: 'Actions for Airport transfer' }).click();
    await demoPause(page, 0.5);
    await shot(page, '35-phone-editor-overflow');
    await page.keyboard.press('Escape');

    // Preview.
    await pane.getByRole('tab', { name: 'Preview' }).click();
    await expect(pane.locator('iframe')).toBeVisible();
    await demoPause(page, 1.2);
    await shot(page, '36-phone-preview');
    await measure(page, 'phone-preview');

    // Back to list.
    await pane.getByRole('button', { name: 'All templates' }).click();
    await expect(page.getByRole('complementary', { name: 'Templates' })).toBeVisible();
    await demoPause(page, 0.6);
    await shot(page, '37-phone-back-to-list');

    // Narrowest phone the app supports: the editor header has back + icon + title on one row.
    await page.setViewportSize({ width: 360, height: 800 });
    await rail.getByRole('button', { name: /^Airport transfer/ }).click();
    await expect(pane.getByRole('heading', { name: 'Airport transfer' })).toBeVisible();
    await demoPause(page, 0.6);
    await shot(page, '39-phone-360-editor');
    await measure(page, 'phone-360-editor');
    await page.setViewportSize({ width: 390, height: 844 });
    await pane.getByRole('button', { name: 'All templates' }).click();
    await expect(page.getByRole('complementary', { name: 'Templates' })).toBeVisible();

    // Create sheet.
    await page.getByRole('button', { name: 'Template actions', exact: true }).click();
    await page.getByRole('option', { name: 'New template' }).click();
    await demoPause(page, 0.8);
    await shot(page, '38-phone-new-template-sheet');
    await measure(page, 'phone-new-template-sheet');
    await context.close();
  });

  test('plan-gated org: badges and upgrade path', async ({ page }) => {
    watchConsole(page, 'free');
    await installTemplatesReviewMocks(page, { freePlan: true });
    await page.setViewportSize({ width: 1440, height: 960 });
    await openTemplates(page);
    await demoPause(page, 0.8);
    await shot(page, '40-free-desktop');

    await page.getByRole('button', { name: 'New template' }).click();
    await demoPause(page, 0.9);
    await shot(page, '41-free-upgrade-modal');
    await measure(page, 'free-upgrade-modal');
    await page.keyboard.press('Escape');

    const rail = page.getByRole('complementary', { name: 'Templates' });
    await rail.getByRole('button', { name: /^Booking confirmation/ }).click();
    await demoPause(page, 0.6);
    await shot(page, '42-free-email-badges');
  });

  test('read-only member: no edit affordances', async ({ page }) => {
    watchConsole(page, 'readonly');
    await installTemplatesReviewMocks(page, { readOnly: true });
    await page.setViewportSize({ width: 1440, height: 960 });
    await openTemplates(page);
    await demoPause(page, 0.8);
    await shot(page, '43-readonly-desktop');
    await measure(page, 'readonly-desktop');

    await expect(page.getByRole('button', { name: 'New template' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
  });

  test('dark mode', async ({ page }) => {
    watchConsole(page, 'dark');
    await page.addInitScript(() => localStorage.setItem('kame-ui-theme', 'dark'));
    await installTemplatesReviewMocks(page);
    await page.setViewportSize({ width: 1440, height: 960 });
    await openTemplates(page);
    await demoPause(page, 0.8);
    await shot(page, '44-dark-desktop');
    await measure(page, 'dark-desktop');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page.getByRole('heading', { name: 'Templates', exact: true }).waitFor();
    await demoPause(page, 0.8);
    await shot(page, '45-dark-phone');
  });

  test('loading, empty and error states', async ({ page, browser }) => {
    watchConsole(page, 'states');
    await installTemplatesReviewMocks(page, { loadDelayMs: 2500 });
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(TEMPLATES_E2E_PATH);
    await demoPause(page, 0.8);
    await shot(page, '50-loading-desktop');
    await page
      .getByRole('heading', { name: 'Templates', exact: true })
      .waitFor({ timeout: 30_000 });

    await page.unroute('**/functions/v1/property-templates-settings**');
    await installTemplatesReviewMocks(page, { emptyLibrary: true });
    await page.reload();
    await page.getByRole('heading', { name: 'Templates', exact: true }).waitFor();
    await demoPause(page, 0.8);
    await shot(page, '51-empty-desktop');
    await measure(page, 'empty-desktop');

    // A fresh context: the persisted React Query cache (IndexedDB) would otherwise hydrate
    // the empty library and mask the failure state.
    const errorContext = await browser.newContext({
      viewport: { width: 1440, height: 960 },
      storageState: './ui/e2e/shared/consentStorageState.json',
      timezoneId: 'Asia/Manila',
      locale: 'en-PH',
    });
    const errorPage = await errorContext.newPage();
    watchConsole(errorPage, 'error');
    await installTemplatesReviewMocks(errorPage, { failLoad: true });
    await errorPage.goto(TEMPLATES_E2E_PATH);
    await expect(errorPage.getByText('Templates did not load')).toBeVisible({ timeout: 30_000 });
    await demoPause(errorPage, 0.6);
    await shot(errorPage, '52-error-desktop');
    await errorContext.close();
  });
});
