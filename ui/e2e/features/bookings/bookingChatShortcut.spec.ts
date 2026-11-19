import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { expectNoPageHorizontalOverflow } from '../../shared/layoutAssertions';
import {
  installPropertyTeamRbacMocks,
  teamRbacPaths,
  TEAM_E2E_ORG_SLUG,
  TEAM_E2E_PROPERTY_SLUG,
  type PropertyTeamRbacMockOpts,
} from '../team/shared/propertyTeamRbacHarness';

const ORG_BOOKINGS = `/org/${TEAM_E2E_ORG_SLUG}/bookings`;
const PROPERTY_INBOX = `/org/${TEAM_E2E_ORG_SLUG}/property/${TEAM_E2E_PROPERTY_SLUG}/messages`;

const chat = (over: Record<string, unknown> = {}) => ({
  id: 'conv-web-1',
  platform: 'web',
  participant_name: 'Jane Guest',
  participant_avatar_url: null,
  last_message_at: '2026-11-10T00:00:00Z',
  last_message_preview: 'See you soon',
  unread_count: 0,
  booking_id: 'booking-team-e2e-001',
  match: 'booking',
  ...over,
});

async function openBookings(
  page: Page,
  bookingChats: Array<Record<string, unknown>>,
  opts: { path?: string; mocks?: PropertyTeamRbacMockOpts } = {}
) {
  await installPropertyTeamRbacMocks(page, 'full_access', {
    orgHub: true,
    customTemplateSeeded: true,
    bookingChats,
    ...opts.mocks,
  });
  await page.goto(opts.path ?? ORG_BOOKINGS);
  const chatButton = page.getByRole('button', { name: /Open chat with Jane Guest/i }).first();
  await expect(chatButton).toBeVisible({ timeout: 20_000 });
  return chatButton;
}

test.describe('@ci booking chat shortcut', () => {
  test('one thread opens it directly in the property inbox', async ({ page }) => {
    const chatButton = await openBookings(page, [chat()]);
    await chatButton.click();
    await expect(page).toHaveURL(
      new RegExp(`${PROPERTY_INBOX}\\?conversationId=conv-web-1&platform=web`)
    );
  });

  test('several threads open a picker, and picking one deep-links to it', async ({ page }) => {
    const chatButton = await openBookings(page, [
      chat(),
      chat({ id: 'conv-fb-1', platform: 'facebook', match: 'name', unread_count: 2 }),
    ]);
    await chatButton.click();

    const picker = page.getByRole('dialog');
    await expect(picker.getByText('Open chat')).toBeVisible();
    await expect(picker.getByText(/Facebook · Name match/)).toBeVisible();
    await picker.getByRole('option', { name: /Facebook/ }).click();
    await expect(page).toHaveURL(
      new RegExp(`${PROPERTY_INBOX}\\?conversationId=conv-fb-1&platform=facebook`)
    );
  });

  test('no thread shows a toast that can search Messages by guest name', async ({ page }) => {
    const chatButton = await openBookings(page, []);
    await chatButton.click();
    await expect(page.getByText('No chat for this booking yet')).toBeVisible();
    await page.getByRole('button', { name: 'Search Messages' }).click();
    await expect(page).toHaveURL(new RegExp(`${PROPERTY_INBOX}\\?search=Jane\\+Guest`));
  });
  test('works on the property bookings list too', async ({ page }) => {
    const chatButton = await openBookings(page, [chat()], { path: teamRbacPaths.bookings });
    await chatButton.click();
    await expect(page).toHaveURL(
      new RegExp(`${PROPERTY_INBOX}\\?conversationId=conv-web-1&platform=web`)
    );
  });

  test('is hidden for a member who cannot view Messages', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', {
      orgHub: true,
      customTemplateSeeded: true,
      omitPermissions: ['inbox:view'],
    });
    await page.goto(ORG_BOOKINGS);
    await expect(page.getByText('Jane Guest').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /Open chat with/i })).toHaveCount(0);
  });

  test('a refused lookup toasts and stays on the list', async ({ page }) => {
    const chatButton = await openBookings(page, [], {
      mocks: { bookingChatsFailure: { status: 403, message: 'Access restricted' } },
    });
    await chatButton.click();
    await expect(page.getByText('You do not have access to Messages here')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(ORG_BOOKINGS);
    await expect(chatButton).toBeEnabled();
  });

  test('clicking the row still opens the booking, not the chat', async ({ page }) => {
    await openBookings(page, [chat()]);
    await page.getByText('Jane Guest').first().click();
    await expect(page).toHaveURL(/\/bookings\/booking-team-e2e-001/);
  });

  test('picker closes on Escape and does not navigate', async ({ page }) => {
    const chatButton = await openBookings(page, [
      chat(),
      chat({ id: 'conv-fb-1', platform: 'facebook' }),
    ]);
    await chatButton.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe(ORG_BOOKINGS);
  });

  test('phone: picker is a full-width bottom sheet and the page does not scroll sideways', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    const chatButton = await openBookings(page, [
      chat({ unread_count: 120 }),
      chat({ id: 'conv-fb-1', platform: 'facebook', match: 'name' }),
    ]);
    await chatButton.click();

    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    const box = (await sheet.boundingBox())!;
    expect(box.x).toBeLessThanOrEqual(1);
    expect(Math.round(box.width)).toBe(375);
    expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(795);
    await expect(sheet.getByText('99+')).toBeVisible();

    const rows = sheet.getByRole('option');
    for (let i = 0; i < (await rows.count()); i++) {
      expect((await rows.nth(i).boundingBox())!.height).toBeGreaterThanOrEqual(48);
    }
    await expectNoPageHorizontalOverflow(page);
  });

  test('the open picker has no serious accessibility violations', async ({ page }) => {
    const chatButton = await openBookings(page, [
      chat({ unread_count: 3 }),
      chat({ id: 'conv-fb-1', platform: 'facebook', match: 'name' }),
    ]);
    await chatButton.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`)).toEqual([]);
  });
  for (const width of [1024, 1280]) {
    test(`desktop ${width}px: the Actions chat icon is fully visible without scrolling the table`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      const chatButton = await openBookings(page, [chat()]);
      // IntersectionObserver respects the table's overflow clipping, unlike a bounding-box check.
      await expect(chatButton).toBeInViewport({ ratio: 1 });
    });
  }
});
