/**
 * Visual + behavioural audit of the Notifications module (`@demo`: headed, never CI).
 *
 * Walks every surface a host can reach — Activity feed, Telegram history, the
 * Manage sheet on both tabs, the notifications sheet, deep links, paused/empty/
 * error states and the restricted-permission variant — at phone, tablet and
 * desktop widths, writing one screenshot per state to
 * `test-results/notifications-audit/`.
 *
 * Full local run with the slow-motion walkthrough:
 *   PLAYWRIGHT_RECORD_VIDEO=1 PLAYWRIGHT_SLOW_MO=350 \
 *     bunx playwright test ui/e2e/features/dashboard/notificationsAudit.spec.ts --project=chromium
 */
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import {
  createParkingFlowState,
  installParkingFlowMocks,
} from '../parking/shared/parkingFlowHarness';
import { installPropertyTeamRbacMocks } from '../team/shared/propertyTeamRbacHarness';

const HUB = '/org/sample-stays-ph/property/solea-mactan/notifications';
const PARKING_HUB = '/org/sample-stays-ph/parking/slot-12a/notifications';
/** `NOTIFICATIONS_SHOTS` lets a before/after pair land in separate folders. */
const SHOTS = path.join('test-results', process.env.NOTIFICATIONS_SHOTS ?? 'notifications-audit');

const now = Date.now();
const iso = (hoursAgo: number) => new Date(now - hoursAgo * 3_600_000).toISOString();

function feedRow(
  id: string,
  type: string,
  title: string,
  body: string | null,
  extra: Record<string, unknown> = {}
) {
  return {
    id,
    type,
    title,
    body,
    booking_id: null,
    conversation_id: null,
    property_id: 'property-team-e2e-001',
    parking_id: null,
    metadata: {},
    created_at: iso(1),
    isRead: false,
    ...extra,
  };
}

/** Mixed, realistic feed: unread chat, linked stay, calendar conflict, long copy. */
function richFeed() {
  return [
    feedRow(
      'n-inbox-fb',
      'inbox_new_message',
      'Maria Santos',
      'Hi! Is the unit still available for Dec 20 to 27? We are 4 adults and 2 kids.',
      {
        conversation_id: 'conv-fb-1',
        booking_id: 'booking-linked-1',
        created_at: iso(0.2),
        metadata: {
          platform: 'facebook',
          guest_name: 'Maria Santos',
          inquiry_check_in: '2026-12-20',
          inquiry_check_out: '2026-12-27',
          message_id: 'msg-1',
        },
      }
    ),
    feedRow(
      'n-inbox-ig',
      'inbox_new_message',
      'Ana Reyes',
      'Can we check in early? Our flight lands at 6am and we have two toddlers with us.',
      {
        conversation_id: 'conv-ig-1',
        created_at: iso(0.9),
        metadata: {
          platform: 'instagram',
          guest_name: 'Ana Reyes',
          inquiry_check_in: '2026-12-04',
          inquiry_check_out: '2026-12-06',
        },
      }
    ),
    feedRow(
      'n-pending',
      'booking_pending_review',
      'New booking · Unit 2604',
      'Dec 20 - 27, 2026 · 6 guests · ₱48,000',
      { booking_id: 'booking-2', created_at: iso(1.4) }
    ),
    feedRow(
      'n-calendar',
      'calendar_conflict',
      'Calendar conflict · Unit 2604',
      'An Airbnb reservation overlaps an existing stay on Dec 22.',
      { created_at: iso(2.2) }
    ),
    feedRow(
      'n-trip',
      'booking_trip_viewed',
      'Maria opened their trip',
      'Guest view: documents, parking and check-in details.',
      { booking_id: 'booking-3', created_at: iso(3.1), isRead: true }
    ),
    feedRow(
      'n-checkout',
      'booking_ready_for_checkout',
      'Ready for checkout · Unit 2604',
      'Juan Dela Cruz checks out today.',
      { booking_id: 'booking-4', created_at: iso(5), isRead: true }
    ),
    feedRow(
      'n-review',
      'review_received',
      'New 5-star review · Unit 1208',
      '“Spotless unit and a very responsive host.”',
      { created_at: iso(8), isRead: true }
    ),
    feedRow(
      'n-pricing',
      'smart_pricing_updated',
      'Smart pricing raised weekend rates by 12% for the holidays',
      'Unit 2604 · Dec 18 - Jan 3',
      { created_at: iso(26), isRead: true }
    ),
    feedRow(
      'n-long',
      'booking_external_imported',
      'Imported from Airbnb · 14 new reservations synced for Unit 2604 between Dec 18 and Jan 3',
      'Calendar stays in sync every 15 minutes.',
      { created_at: iso(30), isRead: true }
    ),
    feedRow(
      'n-maint',
      'maintenance_guest_reported',
      'Maintenance · Aircon not cooling',
      'Reported by Juan Dela Cruz in Unit 2604.',
      { created_at: iso(50), isRead: true }
    ),
    feedRow(
      'n-receipt',
      'booking_receipt_uploaded',
      'Receipt uploaded',
      'Downpayment receipt for booking #4821.',
      {
        created_at: iso(70),
        isRead: true,
      }
    ),
    feedRow(
      'n-billing',
      'billing_notice',
      'Card expiring soon',
      'Update your payment method before Nov 30.',
      {
        created_at: iso(96),
        isRead: true,
      }
    ),
  ];
}

async function mockNotifications(page: Page, rows: unknown[], unreadCount = 3) {
  await page.route('**/functions/v1/notifications-list**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          notifications: rows,
          nextCursor: null,
          unreadCount,
          unreadSummary: { inbox: 2, bookings: 1, reviews: 0 },
        },
      }),
    })
  );
}

async function mockPreferences(page: Page) {
  await page.route('**/functions/v1/notification-preferences**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          preferences: {
            mutedGroups: ['reviews', 'analytics'],
            quietHoursEnabled: true,
            quietHoursStart: '22:00',
            quietHoursEnd: '07:00',
            quietHoursTimezone: 'Asia/Manila',
          },
        },
      }),
    })
  );
}

async function mockDelivery(page: Page, enabled = true) {
  await page.route('**/functions/v1/telegram-delivery-settings**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { enabled } }),
    })
  );
}

async function mockHistory(page: Page) {
  await page.route('**/functions/v1/telegram-message-log**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          messages: [
            {
              id: 'log-1',
              module: 'chat',
              text: 'New message from Maria Santos on Facebook: Hi! Is the unit still available for Dec 20 to 27? We are 4 adults and 2 kids. We would also like to know if late checkout is possible on the 27th, and whether parking for two cars is included in the nightly rate. Thank you so much!',
              status: 'sent',
              error: null,
              createdAt: iso(0.3),
            },
            {
              id: 'log-2',
              module: 'marketing',
              text: 'Daily calendar alert: 2 check-ins tomorrow, 1 checkout today.\nUnit 2604 · Maria Santos 14:00 · Juan Dela Cruz 11:00',
              status: 'sent',
              error: null,
              createdAt: iso(2),
            },
            {
              id: 'log-3',
              module: 'finance',
              text: 'Payment reminder for November dues.',
              status: 'failed',
              error: 'Bad Request: chat not found',
              createdAt: iso(9),
            },
            {
              id: 'log-4',
              module: 'operations',
              text: 'Booking #4821 moved to Ready for check-in.',
              status: 'sent',
              error: null,
              createdAt: iso(26),
            },
          ],
          nextCursor: null,
          deliveryEnabled: true,
          retentionDays: 15,
        },
      }),
    })
  );
}

async function installMocks(page: Page, opts: { rows?: unknown[]; delivery?: boolean } = {}) {
  await installPropertyTeamRbacMocks(page, 'full_access');
  await mockNotifications(page, opts.rows ?? richFeed());
  await mockPreferences(page);
  await mockDelivery(page, opts.delivery ?? true);
  await mockHistory(page);
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), animations: 'disabled' });
}

/**
 * Manage lives in the desktop header at lg+, and in the hero as an icon below it.
 * `.or()` waits for whichever renders instead of racing a bare `count()`.
 */
async function openManage(page: Page) {
  await page
    .getByRole('button', { name: 'Manage', exact: true })
    .or(page.getByRole('button', { name: 'Manage notifications' }))
    .first()
    .click();
}

/** The bell is the Quick Access pill on desktop and phone. */
async function openBell(page: Page) {
  await page
    .getByRole('button', { name: /Quick access/ })
    .first()
    .click();
  await page
    .getByRole('button', { name: /^Notifications/ })
    .first()
    .click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 30_000 });
}

async function waitForPushRow(page: Page) {
  await expect(page.getByRole('switch', { name: 'Push notifications' })).toBeVisible({
    timeout: 30_000,
  });
}

async function openHub(page: Page) {
  await page.goto(HUB);
  await expect(page.getByRole('heading', { name: 'Notifications', level: 1 })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('ul[aria-label="Notifications"] li').first()).toBeVisible({
    timeout: 30_000,
  });
}

test.describe('@demo notifications audit', () => {
  test.describe.configure({ timeout: 120_000 });

  test.describe('desktop 1440', () => {
    test.use({ viewport: { width: 1440, height: 960 } });

    test('activity, telegram, manage and bell', async ({ page }) => {
      await installMocks(page);
      await openHub(page);
      await shot(page, 'desktop-01-activity');

      await page.getByRole('tab', { name: 'Telegram' }).click();
      await expect(page.getByText('New message from Maria Santos on Facebook')).toBeVisible();
      await shot(page, 'desktop-02-telegram-history');

      await page.getByRole('button', { name: 'Show more' }).first().click();
      await shot(page, 'desktop-03-telegram-expanded');

      await openManage(page);
      const manage = page.getByRole('dialog');
      await expect(manage).toBeVisible({ timeout: 30_000 });
      await waitForPushRow(page);
      await shot(page, 'desktop-04-manage-activity');

      await manage.getByRole('tab', { name: 'Telegram' }).click();
      await expect(page.locator('#section-chat')).toBeVisible({ timeout: 30_000 });
      await shot(page, 'desktop-05-manage-telegram-top');

      await page.locator('#section-operations').scrollIntoViewIfNeeded();
      await shot(page, 'desktop-06-manage-telegram-modules');

      await page.locator('#section-maintenance').scrollIntoViewIfNeeded();
      await shot(page, 'desktop-07-manage-telegram-bottom');

      await manage.getByRole('button', { name: 'Done' }).click();
      await expect(manage).toBeHidden();

      await page.getByRole('button', { name: 'How notifications work' }).click();
      const help = page.getByRole('dialog').last();
      await expect(help.getByRole('heading', { name: 'How notifications work' })).toBeVisible();
      await shot(page, 'desktop-08-how-it-works');
      await help.getByRole('button', { name: 'Close' }).first().click();

      /* Desktop reaches the bell through the Quick access pill. */
      await openBell(page);
      await shot(page, 'desktop-09-bell-sheet');
    });

    test('marks everything read, and the deep link / paused states', async ({ page }) => {
      await installMocks(page);
      await openHub(page);
      await page.getByRole('button', { name: 'Mark all as read' }).click();
      await shot(page, 'desktop-10-marked-read');

      await page.goto(`${HUB}?module=finance`);
      const manage = page.getByRole('dialog');
      await expect(manage).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('#section-finance')).toContainText('Due-date reminders');
      await shot(page, 'desktop-11-deep-link-finance');
      await manage.getByRole('button', { name: 'Done' }).click();

      await page.route('**/functions/v1/telegram-delivery-settings**', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { enabled: false } }),
        })
      );
      await page.goto(`${HUB}?view=telegram`);
      await expect(page.getByText('Telegram is paused')).toBeVisible({ timeout: 30_000 });
      await shot(page, 'desktop-12-telegram-paused');

      await openManage(page);
      await page.getByRole('dialog').getByRole('tab', { name: 'Telegram' }).click();
      await expect(page.getByRole('dialog').getByText('Telegram is paused')).toBeVisible();
      await shot(page, 'desktop-13-manage-telegram-paused');
    });

    test('empty activity', async ({ page }) => {
      await installMocks(page, { rows: [] });
      await page.goto(HUB);
      await expect(page.getByText('No activity yet')).toBeVisible({ timeout: 30_000 });
      await shot(page, 'desktop-14-activity-empty');
    });

    test('list error keeps the page usable', async ({ page }) => {
      await installMocks(page);
      await page.route('**/functions/v1/notifications-list**', (route) =>
        route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' })
      );
      await page.goto(HUB);
      await expect(page.getByText('Could not load notifications.')).toBeVisible({
        timeout: 30_000,
      });
      await shot(page, 'desktop-15-activity-error');
    });
  });

  test.describe('tablet 768', () => {
    test.use({ viewport: { width: 768, height: 1024 } });

    test('activity and manage', async ({ page }) => {
      await installMocks(page);
      await openHub(page);
      await shot(page, 'tablet-01-activity');

      await openManage(page);
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 30_000 });
      await waitForPushRow(page);
      await shot(page, 'tablet-02-manage-activity');

      await page.getByRole('dialog').getByRole('tab', { name: 'Telegram' }).click();
      await expect(page.locator('#section-chat')).toBeVisible({ timeout: 30_000 });
      await shot(page, 'tablet-03-manage-telegram');
    });
  });

  test.describe('phone 375', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test('activity, telegram, manage and bell sheets', async ({ page }) => {
      await installMocks(page);
      await openHub(page);
      await shot(page, 'phone-01-activity');

      await page.getByRole('tab', { name: 'Telegram' }).click();
      await expect(page.getByText('New message from Maria Santos on Facebook')).toBeVisible();
      await shot(page, 'phone-02-telegram-history');

      await openManage(page);
      const manage = page.getByRole('dialog');
      await expect(manage).toBeVisible({ timeout: 30_000 });
      await waitForPushRow(page);
      await shot(page, 'phone-03-manage-activity');

      await manage.getByRole('tab', { name: 'Telegram' }).click();
      await expect(page.locator('#section-chat')).toBeVisible({ timeout: 30_000 });
      await shot(page, 'phone-04-manage-telegram');

      await page.locator('#section-finance').scrollIntoViewIfNeeded();
      await shot(page, 'phone-05-manage-telegram-modules');

      await manage.getByRole('button', { name: 'Done' }).click();
      await expect(manage).toBeHidden();

      await openBell(page);
      await shot(page, 'phone-06-bell-sheet');
    });

    test('deep link scrolls to the module card', async ({ page }) => {
      await installMocks(page);
      await page.goto(`${HUB}?module=maintenance`);
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 30_000 });
      await page.locator('#section-maintenance').scrollIntoViewIfNeeded();
      await shot(page, 'phone-07-deep-link-maintenance');
    });
  });

  test.describe('restricted permissions', () => {
    test.use({ viewport: { width: 1440, height: 960 } });

    test('read-only member reaches the hub without write affordances', async ({ page }) => {
      await installPropertyTeamRbacMocks(page, 'read_only');
      await mockNotifications(page, richFeed());
      await mockPreferences(page);
      await mockDelivery(page);
      await mockHistory(page);
      await openHub(page);
      await shot(page, 'desktop-16-read-only-activity');

      await openManage(page);
      const manage = page.getByRole('dialog');
      await manage.getByRole('tab', { name: 'Telegram' }).click();
      await expect(page.locator('#section-chat')).toBeVisible({ timeout: 30_000 });
      await shot(page, 'desktop-17-read-only-telegram');
    });
  });

  test.describe('legacy entry', () => {
    test.use({ viewport: { width: 1440, height: 960 } });

    test('the bare /notifications path redirects into the property hub', async ({ page }) => {
      await installMocks(page);
      await page.goto('/notifications');
      await expect(page).toHaveURL(/\/org\/[^/]+\/property\/[^/]+\/notifications$/, {
        timeout: 30_000,
      });
      await expect(page.getByRole('heading', { name: 'Notifications', level: 1 })).toBeVisible({
        timeout: 30_000,
      });
      await shot(page, 'legacy-01-bare-path-redirect');
    });
  });

  test.describe('parking notifications', () => {
    async function installParkingNotificationMocks(page: Page) {
      const state = createParkingFlowState();
      await installParkingFlowMocks(page, state);
      await mockNotifications(page, [
        feedRow('p-1', 'parking_booked', 'Parking request accepted', 'Slot 12A · Nov 25 - 27', {
          parking_id: 'parking-e2e-001',
          property_id: null,
        }),
        feedRow(
          'p-2',
          'parking_payment_expired',
          'Payment window expired',
          'Slot 12A · request searching again',
          {
            parking_id: 'parking-e2e-001',
            property_id: null,
            isRead: true,
          }
        ),
      ]);
      await mockPreferences(page);
      await mockDelivery(page);
      await mockHistory(page);
      await page.route('**/functions/v1/telegram-parking-settings**', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              enabled: false,
              reservationRequestTemplate: 'New parking reservation request for {{slot_label}}.',
              checkInReminderTemplate: 'Parking check-in reminder: {{slot_label}}.',
              paymentReceivedTemplate: 'Payment received for parking {{slot_label}}.',
              requestCancelledTemplate: 'Guest cancelled parking {{slot_label}}.',
              paymentExpiredTemplate: 'Payment window expired for parking {{slot_label}}.',
              endorsementFailedTemplate: 'Endorsement failed for {{slot_label}}.',
              notifyOnReservationRequest: true,
              notifyOnCheckInReminder: true,
              notifyOnPaymentReceived: true,
              notifyOnRequestCancelled: true,
              notifyOnPaymentExpired: true,
              notifyOnEndorsementFailed: true,
              placeholdersReference: [],
              updatedAt: null,
            },
          }),
        })
      );
    }

    test.describe('desktop 1440', () => {
      test.use({ viewport: { width: 1440, height: 960 } });

      test('parking hub and manage sheet', async ({ page }) => {
        await installParkingNotificationMocks(page);
        await page.goto(PARKING_HUB);
        await expect(page.getByRole('heading', { name: 'Notifications', level: 1 })).toBeVisible({
          timeout: 30_000,
        });
        await expect(page.getByRole('tab', { name: /Activity/ })).toBeVisible({ timeout: 30_000 });
        await shot(page, 'parking-desktop-01-activity');

        await openManage(page);
        await expect(page.getByRole('dialog')).toBeVisible({ timeout: 30_000 });
        await page.getByRole('dialog').getByRole('tab', { name: 'Telegram' }).click();
        await expect(page.locator('#section-parking')).toBeVisible({ timeout: 30_000 });
        await shot(page, 'parking-desktop-02-manage-telegram');
      });
    });

    test.describe('phone 375', () => {
      test.use({ viewport: { width: 375, height: 812 } });

      test('parking hub on a phone', async ({ page }) => {
        await installParkingNotificationMocks(page);
        await page.goto(PARKING_HUB);
        await expect(page.getByRole('heading', { name: 'Notifications', level: 1 })).toBeVisible({
          timeout: 30_000,
        });
        await expect(page.getByRole('tab', { name: /Activity/ })).toBeVisible({ timeout: 30_000 });
        await shot(page, 'parking-phone-01-activity');
      });
    });
  });
});
