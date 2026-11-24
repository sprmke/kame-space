import { seedSupabaseAuthSession } from '../../../shared/authSeam';
import { E2E_GUEST_USER_ID } from '../../../shared/ids';

import type { Page, Route } from '@playwright/test';

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

export const GUEST_MESSAGES_E2E_PATH = '/account/messages';
export const E2E_GUEST_CONVERSATION_ID = 'e2e-guest-conversation-1';
export const E2E_GUEST_PROPERTY_SLUG = 'solea-mactan';

const THREAD = {
  conversationId: E2E_GUEST_CONVERSATION_ID,
  propertySlug: E2E_GUEST_PROPERTY_SLUG,
  propertyName: 'Solea Mactan',
  propertyImageUrl: null,
  parkingSlug: null,
  parkingName: null,
  parkingImageUrl: null,
  hostName: 'Sample Stays PH',
  hostAvatarUrl: null,
  inquiryCheckIn: '2026-12-01',
  inquiryCheckOut: '2026-12-03',
  lastMessagePreview: 'Yes, early check-in is free if the unit is ready.',
  lastMessageAt: new Date(Date.now() - 90 * 60_000).toISOString(),
  unreadCount: 1,
  replyStatus: 'replied',
};

const MESSAGE_TEXTS: Array<{ direction: 'inbound' | 'outbound'; body: string }> = [
  { direction: 'outbound', body: 'Hi! Can we check in early on the 1st?' },
  { direction: 'inbound', body: 'Yes, early check-in is free if the unit is ready.' },
  { direction: 'outbound', body: 'Great. Is parking included?' },
  { direction: 'inbound', body: 'Parking is paid, 300 per night.' },
  { direction: 'outbound', body: 'We will take one slot for both nights.' },
  { direction: 'inbound', body: 'Noted. I will reserve slot 27 for you.' },
  { direction: 'outbound', body: 'Thank you. Can we also get a late check-out?' },
  { direction: 'inbound', body: 'Until 1pm, subject to the next booking.' },
  { direction: 'outbound', body: 'Perfect, see you on the 1st.' },
  // Tall thread: keeps the composer at the bottom of the pane, the case a fixed hub
  // height used to push under the tab bar.
  { direction: 'inbound', body: 'Safe travels! Message me when you arrive.' },
];

const MESSAGES = MESSAGE_TEXTS.map((message, index) => ({
  id: `e2e-guest-message-${index + 1}`,
  conversation_id: E2E_GUEST_CONVERSATION_ID,
  direction: message.direction,
  body_text: message.body,
  attachments: [],
  sent_at: new Date(Date.now() - (MESSAGE_TEXTS.length - index) * 20 * 60_000).toISOString(),
  delivery_status: message.direction === 'outbound' ? 'sent' : null,
  is_ai_generated: false,
}));

/** Guest session plus one conversation, for the guest Messages hub tours/specs. */
export async function installGuestMessagesMocks(
  page: Page,
  opts: { empty?: boolean; startError?: boolean } = {}
): Promise<void> {
  await seedSupabaseAuthSession(page, 'guest');

  await page.route('**/auth/v1/user**', async (route) => {
    await fulfillJson(route, {
      id: E2E_GUEST_USER_ID,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'guest@example.com',
      email_confirmed_at: new Date().toISOString(),
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: { full_name: 'E2E Guest' },
    });
  });

  await page.route('**/functions/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.split('/').pop();

    switch (endpoint) {
      case 'guest-web-chat-start':
        if (opts.startError) {
          await fulfillJson(route, { success: false, error: 'Failed to upsert conversation' }, 400);
          return;
        }
        await fulfillJson(route, {
          success: true,
          data: {
            conversationId: E2E_GUEST_CONVERSATION_ID,
            property: { id: 'e2e-property', slug: E2E_GUEST_PROPERTY_SLUG, name: 'Solea Mactan' },
            host: {
              organizationName: 'Sample Stays PH',
              ownerName: 'Sample Host',
              ownerAvatarUrl: null,
            },
            inquiryCheckIn: '2026-12-01',
            inquiryCheckOut: '2026-12-03',
            replyStatus: 'none',
            voiceReceptionistEnabled: false,
            stayGuideUrl: null,
            tripPath: '/account/trips',
          },
        });
        return;
      case 'guest-messages':
        await fulfillJson(route, {
          success: true,
          data: { threads: opts.empty ? [] : [THREAD] },
        });
        return;
      case 'guest-web-chat-messages':
        if (route.request().method() === 'GET') {
          await fulfillJson(route, {
            success: true,
            data: { messages: MESSAGES, hasMore: false, replyStatus: 'replied' },
          });
          return;
        }
        await fulfillJson(route, { success: true, data: {} });
        return;
      case 'guest-web-chat-resume':
        await fulfillJson(route, {
          success: true,
          data: {
            hasMessages: true,
            conversationId: E2E_GUEST_CONVERSATION_ID,
            bookingId: null,
            inquiryCheckIn: '2026-12-01',
            inquiryCheckOut: '2026-12-03',
            replyStatus: 'replied',
            property: { id: 'e2e-property', slug: E2E_GUEST_PROPERTY_SLUG, name: 'Solea Mactan' },
            parking: null,
            host: {
              organizationName: 'Sample Stays PH',
              ownerName: 'Sample Host',
              ownerAvatarUrl: null,
            },
            voiceReceptionistEnabled: false,
            stayGuideUrl: null,
            tripPath: '/account/trips',
          },
        });
        return;
      case 'guest-profile':
        await fulfillJson(route, {
          success: true,
          data: {
            displayName: 'E2E Guest',
            bio: null,
            avatarUrl: null,
            phone: null,
            locationLabel: null,
            email: 'guest@example.com',
          },
        });
        return;
      default:
        await route.continue();
    }
  });
}
