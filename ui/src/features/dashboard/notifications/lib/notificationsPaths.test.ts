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
    orgSlug: 'kame-homes',
    propertySlugById: new Map([['prop-1', 'kame-home']]),
    parkingSlugById: new Map<string, string>(),
  };

  it('resolveNotificationPath is exported', () => {
    expect(typeof resolveNotificationPath).toBe('function');
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
    ).toBe('/org/kame-homes/property/kame-home/pricing?channelSync=1');
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
    ).toBe('/org/kame-homes/property/kame-home/pricing?channelSync=1');
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
