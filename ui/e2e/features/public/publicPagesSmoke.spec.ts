import { expect, test } from '@playwright/test';

import { mockEdgeFunctions } from '../../shared/interceptEdge';
import {
  expectNoPageHorizontalOverflow,
  expectNoUnnamedInteractiveControls,
} from '../../shared/layoutAssertions';
import {
  mockPublicDevelopmentsListBody,
  mockPublicPricingPlansBody,
  mockPublicPropertiesListBody,
  mockPublicPropertyBody,
  mockSearchListingsBody,
  mockSearchSuggestionsBody,
} from '../../shared/mockFixtures';

async function expectPublicPageReady(page: Parameters<typeof expectNoPageHorizontalOverflow>[0]) {
  await expectNoPageHorizontalOverflow(page);
  await expectNoUnnamedInteractiveControls(page);
}

test.describe('@smoke @critical public marketing pages', () => {
  test('guest landing loads hero', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Find your next stay/i })).toBeVisible({
      timeout: 20_000,
    });
    await expectPublicPageReady(page);
  });

  test('properties list loads from mock API', async ({ page }) => {
    await mockEdgeFunctions(page, [
      { name: 'list-public-properties', body: mockPublicPropertiesListBody },
    ]);
    const listReady = page.waitForResponse(
      (res) => res.url().includes('/functions/v1/list-public-properties') && res.ok()
    );
    await page.goto('/properties?view=list');
    await listReady;
    await expect(page.getByText('Solea Mactan').first()).toBeVisible({ timeout: 20_000 });
    await expectPublicPageReady(page);
  });

  test('for-hosts landing loads the mascot hero and its sections', async ({ page }) => {
    // The fee calculator reads plan prices from the live catalog.
    await mockEdgeFunctions(page, [
      { name: 'list-public-pricing-plans', body: mockPublicPricingPlansBody },
    ]);
    await page.goto('/for-hosts');
    await expect(
      page.getByRole('heading', { name: 'Hosting made easy and affordable.' })
    ).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Watch the tour' }).click();
    const tourDialog = page.getByRole('dialog', { name: 'Product tour' });
    await expect(tourDialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tourDialog).toBeHidden();
    await expect(
      page.getByRole('heading', { name: 'AI-first property management.' })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Keep every channel. Run them from one place.' })
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Keep more of every booking.' })).toBeVisible();
    await expect(page.getByRole('slider', { name: 'Set your nightly rate' })).toBeVisible();
    // One card per night booked: the add card adds one, tapping a card removes it.
    await expect(page.getByText('2 nights of Airbnb fees pay for Kame Pro.')).toBeVisible();
    const kept = page.locator('#savings').getByText('You keep', { exact: true });
    await expect(kept).toHaveCount(8);
    await page.getByRole('button', { name: 'Add night' }).click();
    await expect(kept).toHaveCount(9);
    // The nights that pay for Pro are not buttons; a kept night is.
    await expect(page.getByRole('button', { name: /^Remove night 1:/ })).toHaveCount(0);
    await page.getByRole('button', { name: /^Remove night 3:/ }).click();
    await expect(kept).toHaveCount(8);

    // The hero selector is the keyboard path for the four floating panels.
    const messages = page
      .getByLabel('What you get')
      .getByRole('button', { name: 'Messages', exact: true });
    await messages.click();
    await expect(messages).toHaveAttribute('aria-pressed', 'true');

    // Picking an AI job stops the auto-play and leaves the approve step to a real tap.
    await page.getByRole('button', { name: 'Pricing', exact: true }).click();
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Rate applied' })).toBeVisible();
    await expectPublicPageReady(page);
  });

  test('for-hosts pricing loads plan cards', async ({ page }) => {
    await mockEdgeFunctions(page, [
      { name: 'list-public-pricing-plans', body: mockPublicPricingPlansBody },
    ]);
    await page.goto('/for-hosts/pricing');
    await expect(page.getByRole('heading', { name: 'Plans that grow with you' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('heading', { name: 'Free' })).toBeVisible();
    await expectPublicPageReady(page);
  });

  test('property detail page loads from mock API', async ({ page }) => {
    await mockEdgeFunctions(page, [{ name: 'get-public-property', body: mockPublicPropertyBody }]);
    await page.goto('/properties/solea-mactan');
    await expect(page.getByRole('heading', { name: 'Solea Mactan' })).toBeVisible({
      timeout: 20_000,
    });
    // Visible breadcrumb trail: Home / Stays / <place or development> / <listing>.
    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    await expect(breadcrumb.getByRole('link', { name: 'Stays' })).toHaveAttribute(
      'href',
      '/properties'
    );
    await expect(breadcrumb.getByText('Solea Mactan')).toHaveAttribute('aria-current', 'page');
    await expectPublicPageReady(page);
  });

  test('search page renders', async ({ page }) => {
    await mockEdgeFunctions(page, [
      { name: 'search-suggestions', body: mockSearchSuggestionsBody },
      { name: 'search-listings', body: mockSearchListingsBody },
    ]);
    await page.goto('/search');
    await expect(page.getByRole('heading', { name: 'No matches' })).toBeVisible({
      timeout: 15_000,
    });
    await expectPublicPageReady(page);
  });

  test('developments list loads from mock API', async ({ page }) => {
    await mockEdgeFunctions(page, [
      { name: 'list-public-developments', body: mockPublicDevelopmentsListBody },
    ]);
    const listReady = page.waitForResponse(
      (res) => res.url().includes('/functions/v1/list-public-developments') && res.ok()
    );
    await page.goto('/developments?view=list');
    await listReady;
    await expect(page.getByText('Solea Residences').first()).toBeVisible({ timeout: 20_000 });
    await expectPublicPageReady(page);
  });

  test('terms page loads', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.getByRole('heading', { name: 'Terms of Service' })).toBeVisible({
      timeout: 15_000,
    });
    await expectPublicPageReady(page);
  });
});
