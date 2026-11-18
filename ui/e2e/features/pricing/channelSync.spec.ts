import { expect, test, type Page, type Route } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  TEAM_E2E_ORG_SLUG,
  TEAM_E2E_PROPERTY_SLUG,
} from '../team/shared/propertyTeamRbacHarness';

const PRICING_PATH = `/org/${TEAM_E2E_ORG_SLUG}/property/${TEAM_E2E_PROPERTY_SLUG}/pricing`;

type Feed = Record<string, unknown>;

function feed(provider: string, over: Feed = {}): Feed {
  return {
    id: `feed-${provider}`,
    provider,
    label: null,
    isActive: true,
    createBookings: true,
    maskedUrl: '…abc.ics',
    hasUrl: true,
    health: 'ok',
    lastAttemptedAt: null,
    lastSuccessAt: new Date().toISOString(),
    lastError: null,
    consecutiveFailures: 0,
    createdAt: new Date().toISOString(),
    ...over,
  };
}

/** Overrides the harness default for `calendar-sync-settings` (the later route wins). */
async function mockCalendarSync(
  page: Page,
  opts: {
    connectable: string[];
    feeds?: Feed[];
    reads?: Record<string, unknown>;
    events?: Array<Record<string, unknown>>;
  }
): Promise<{ addBodies: Array<Record<string, unknown>> }> {
  const addBodies: Array<Record<string, unknown>> = [];
  await page.route('**/functions/v1/calendar-sync-settings**', async (route: Route) => {
    const req = route.request();
    if (req.method() === 'PATCH') {
      const body = JSON.parse(req.postData() ?? '{}') as Record<string, unknown>;
      if (body.action === 'addFeed') addBodies.push(body);
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { feed: {}, initialSync: null } }),
      });
      return;
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          feeds: opts.feeds ?? [],
          export: {
            enabled: true,
            rotatedAt: null,
            lastServedAt: null,
            reads: opts.reads ?? {},
            urls: {
              all: 'https://example.com/ical/all',
              airbnb: 'https://example.com/ical/airbnb',
              agoda: 'https://example.com/ical/agoda',
              booking_com: 'https://example.com/ical/booking-com',
            },
          },
          recentEvents: opts.events ?? [],
          connectableProviders: opts.connectable,
        },
      }),
    });
  });
  return { addBodies };
}

async function openChannelSync(page: Page) {
  await page.goto(PRICING_PATH);
  await expect(page.getByRole('heading', { name: 'Pricing' })).toBeVisible({ timeout: 20_000 });
  await page
    .getByRole('button', { name: /Channel sync/i })
    .first()
    .click();
  return page.getByRole('dialog');
}

for (const viewport of [
  { name: '375', width: 375, height: 812 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 768 },
]) {
  test.describe(`@ci channel sync (${viewport.name}px)`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
    });

    test('lists only Airbnb until other channels are rolled out', async ({ page }) => {
      await installPropertyTeamRbacMocks(page, 'full_access');
      await mockCalendarSync(page, { connectable: ['airbnb'] });
      const dialog = await openChannelSync(page);
      await expect(dialog.getByRole('button', { name: /^Airbnb, Not connected/ })).toBeVisible();
      await expect(dialog.getByRole('button', { name: /^Agoda/ })).toHaveCount(0);
    });

    test('connects Agoda with a valid link and rejects a wrong-host link', async ({ page }) => {
      await installPropertyTeamRbacMocks(page, 'full_access');
      const { addBodies } = await mockCalendarSync(page, { connectable: ['airbnb', 'agoda'] });
      const dialog = await openChannelSync(page);
      await dialog.getByRole('button', { name: /^Agoda/ }).click();
      await expect(dialog.getByRole('heading', { name: 'Get dates from Agoda' })).toBeVisible();
      await expect(dialog.getByRole('heading', { name: 'Send dates to Agoda' })).toBeVisible();

      const input = dialog.getByPlaceholder('https://…agoda.com/…');
      await input.fill('https://www.airbnb.com/calendar/ical/1.ics');
      await expect(dialog.getByText('Paste the Agoda calendar link')).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Connect' })).toBeDisabled();

      await input.fill('https://ycs.agoda.com/ical/abc.ics');
      // Enter, not a click: the pointer can still rest on the step help and a tooltip covers Connect.
      await input.press('Enter');
      await expect.poll(() => addBodies.length).toBe(1);
      expect(addBodies[0]).toMatchObject({
        action: 'addFeed',
        provider: 'agoda',
        icsUrl: 'https://ycs.agoda.com/ical/abc.ics',
      });
    });

    test('shows the hub checklist and per-channel warnings', async ({ page }) => {
      await installPropertyTeamRbacMocks(page, 'full_access');
      await mockCalendarSync(page, {
        connectable: ['airbnb', 'agoda', 'booking_com'],
        feeds: [
          feed('airbnb'),
          feed('agoda', { exportNeverRead: true }),
          feed('booking_com', { echoWarning: true }),
        ],
      });
      const dialog = await openChannelSync(page);
      await expect(dialog.getByText(/Connect each channel to Kame Space only/)).toBeVisible();
      await expect(dialog.getByRole('button', { name: /^Airbnb, Finish setup/ })).toBeVisible();
      await expect(dialog.getByRole('button', { name: /^Agoda, Needs attention/ })).toBeVisible();

      await dialog.getByRole('button', { name: /^Booking.com/ }).click();
      await expect(dialog.getByText(/sending back closed dates/)).toBeVisible();

      // No horizontal scroll inside the dialog at any width.
      const overflow = await dialog.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect(overflow).toBe(false);
    });

    test('shows Two-way, and Recent activity for both directions with an empty state', async ({
      page,
    }) => {
      await installPropertyTeamRbacMocks(page, 'full_access');
      const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
      await mockCalendarSync(page, {
        connectable: ['airbnb', 'agoda', 'booking_com'],
        feeds: [feed('agoda'), feed('booking_com', { createBookings: false })],
        reads: { agoda: { lastReadAt: hoursAgo(1), readCount: 5 } },
        events: [
          {
            id: 1,
            feed_id: 'feed-agoda',
            action: 'block_created',
            external_uid: 'u1',
            start_date: '2027-09-01',
            end_date: '2027-09-04',
            summary: 'Reserved',
            detail: null,
            created_at: hoursAgo(3),
          },
        ],
      });
      const dialog = await openChannelSync(page);
      await expect(dialog.getByRole('button', { name: /^Agoda, Two-way/ })).toBeVisible();
      await expect(
        dialog.getByRole('button', { name: /^Booking.com, Finish setup/ })
      ).toBeVisible();

      await dialog.getByRole('button', { name: /^Agoda/ }).click();
      await dialog.getByText('Recent activity').click();
      await expect(dialog.getByText('Busy dates imported')).toBeVisible();
      await expect(dialog.getByText('Agoda read your dates')).toBeVisible();

      await dialog.getByRole('button', { name: 'All channels' }).click();
      await dialog.getByRole('button', { name: /^Booking.com/ }).click();
      await dialog.getByText('Recent activity').click();
      await expect(dialog.getByText('No activity yet')).toBeVisible();

      const overflow = await dialog.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect(overflow).toBe(false);
    });
  });
}
