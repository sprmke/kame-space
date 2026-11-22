import { describe, expect, it } from 'vitest';

import {
  resolveNotificationPath,
  notificationsHubActivityHash,
  notificationsHubViewQuery,
  resolveNotificationsHubView,
  useNotificationsHubPath,
  isNotificationsHubView,
  IN_APP_NOTIFICATIONS_SECTION_ID,
  NOTIFICATIONS_HUB_VIEWS,
} from '@/features/dashboard/notifications/lib/notificationsPaths';

describe('resolveNotificationPath', () => {
  const scope = {
    orgSlug: 'acme',
    propertySlugById: new Map([['prop-1', 'solea']]),
    parkingSlugById: new Map([['park-1', 'lot-a']]),
  };

  it('resolveNotificationPath is exported', () => {
    expect(typeof resolveNotificationPath).toBe('function');
  });

  it('opens a property inbox thread with conversation, platform, and message', () => {
    expect(
      resolveNotificationPath(
        {
          type: 'inbox_new_message',
          booking_id: null,
          conversation_id: 'c-1',
          property_id: 'prop-1',
          parking_id: null,
          metadata: { platform: 'facebook', message_id: 'm-9' },
        },
        scope
      )
    ).toBe(
      '/org/acme/property/solea/messages?conversationId=c-1&platform=facebook&messageId=m-9'
    );
  });

  it('prefers Messages over booking detail when both conversation_id and booking_id are set', () => {
    expect(
      resolveNotificationPath(
        {
          type: 'inbox_new_message',
          booking_id: 'booking-linked',
          conversation_id: 'c-linked',
          property_id: 'prop-1',
          parking_id: null,
          metadata: { platform: 'web', message_id: 'm-linked' },
        },
        scope
      )
    ).toBe(
      '/org/acme/property/solea/messages?conversationId=c-linked&platform=web&messageId=m-linked'
    );
  });

  it('still opens booking detail when only booking_id is set', () => {
    expect(
      resolveNotificationPath(
        {
          type: 'booking_pending_review',
          booking_id: 'booking-1',
          conversation_id: null,
          property_id: 'prop-1',
          parking_id: null,
        },
        scope
      )
    ).toBe('/org/acme/property/solea/bookings/booking-1');
  });

  it('opens a parking inbox thread when only parking_id is set', () => {
    expect(
      resolveNotificationPath(
        {
          type: 'inbox_new_message',
          booking_id: null,
          conversation_id: 'c-2',
          property_id: null,
          parking_id: 'park-1',
          metadata: { platform: 'web' },
        },
        scope
      )
    ).toBe('/org/acme/parking/lot-a/messages?conversationId=c-2&platform=web');
  });

  it('still opens the thread when message_id is missing (legacy rows)', () => {
    expect(
      resolveNotificationPath(
        {
          type: 'inbox_new_message',
          booking_id: null,
          conversation_id: 'c-3',
          property_id: 'prop-1',
          parking_id: null,
          metadata: { platform: 'instagram' },
        },
        scope
      )
    ).toBe('/org/acme/property/solea/messages?conversationId=c-3&platform=instagram');
  });

  it('routes calendar conflict notifications to pricing channel sync', () => {
    expect(
      resolveNotificationPath(
        {
          type: 'calendar_conflict',
          booking_id: null,
          conversation_id: null,
          property_id: 'prop-1',
          parking_id: null,
        },
        scope
      )
    ).toBe('/org/acme/property/solea/pricing?channelSync=1');
  });

  it('routes calendar sync failing notifications to pricing channel sync', () => {
    expect(
      resolveNotificationPath(
        {
          type: 'calendar_sync_failing',
          booking_id: null,
          conversation_id: null,
          property_id: 'prop-1',
          parking_id: null,
        },
        scope
      )
    ).toBe('/org/acme/property/solea/pricing?channelSync=1');
  });
});

describe('notificationsHubActivityHash', () => {
  it('notificationsHubActivityHash is exported', () => {
    expect(typeof notificationsHubActivityHash).toBe('function');
  });
});

describe('useNotificationsHubPath', () => {
  it('useNotificationsHubPath is exported', () => {
    expect(typeof useNotificationsHubPath).toBe('function');
  });
});

describe('IN_APP_NOTIFICATIONS_SECTION_ID', () => {
  it('is defined', () => {
    expect(IN_APP_NOTIFICATIONS_SECTION_ID).toBeDefined();
  });
});

describe('NOTIFICATIONS_HUB_VIEWS', () => {
  it('lists activity first so it is the hub default', () => {
    expect(NOTIFICATIONS_HUB_VIEWS).toEqual(['activity', 'telegram']);
  });
});

describe('isNotificationsHubView', () => {
  it('accepts known views and rejects anything else', () => {
    expect(isNotificationsHubView('activity')).toBe(true);
    expect(isNotificationsHubView('telegram')).toBe(true);
    expect(isNotificationsHubView('inbox')).toBe(false);
    expect(isNotificationsHubView(null)).toBe(false);
  });
});

describe('notificationsHubViewQuery', () => {
  it('builds the view query suffix', () => {
    expect(notificationsHubViewQuery('activity')).toBe('?view=activity');
    expect(notificationsHubViewQuery('telegram')).toBe('?view=telegram');
  });
});

describe('resolveNotificationsHubView', () => {
  const base = { view: null, module: null, section: null, hash: '' };

  it('defaults to the activity feed', () => {
    expect(resolveNotificationsHubView(base)).toBe('activity');
  });

  it('honours an explicit view param', () => {
    expect(resolveNotificationsHubView({ ...base, view: 'telegram' })).toBe('telegram');
    expect(resolveNotificationsHubView({ ...base, view: 'activity' })).toBe('activity');
  });

  it('ignores an unknown view param', () => {
    expect(resolveNotificationsHubView({ ...base, view: 'nope' })).toBe('activity');
  });

  it('opens Telegram for a validated module deep link', () => {
    expect(resolveNotificationsHubView({ ...base, module: 'chat' })).toBe('telegram');
  });

  it('lets an explicit view win over a module deep link', () => {
    expect(resolveNotificationsHubView({ ...base, view: 'activity', module: 'chat' })).toBe(
      'activity'
    );
  });

  it('still honours the legacy activity deep links', () => {
    expect(resolveNotificationsHubView({ ...base, section: 'activity' })).toBe('activity');
    expect(resolveNotificationsHubView({ ...base, hash: '#section-activity' })).toBe('activity');
  });
});
