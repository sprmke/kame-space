import { describe, expect, it } from 'vitest';

import type { BookingChatMatch } from '@/features/dashboard/inbox/types/inbox';

import {
  bookingChatGuestName,
  bookingChatOutcome,
  buildInboxConversationHref,
  buildInboxSearchHref,
  resolveBookingChatDestination,
} from './bookingChatLink';

const match = (over: Partial<BookingChatMatch> = {}): BookingChatMatch => ({
  id: 'c-1',
  platform: 'web',
  participant_name: 'Maria Santos',
  participant_avatar_url: null,
  last_message_at: '2026-11-10T00:00:00Z',
  last_message_preview: null,
  unread_count: 0,
  booking_id: 'b-1',
  match: 'booking',
  ...over,
});

describe('resolveBookingChatDestination', () => {
  it('uses the row slugs on an org-wide list', () => {
    expect(
      resolveBookingChatDestination(
        { booking_kind: 'property', property_id: 'p1', property_slug: 'solea' },
        'acme'
      )
    ).toEqual({ kind: 'property', id: 'p1', inboxPath: '/org/acme/property/solea/messages' });
  });

  it('prefers route context on a property dashboard', () => {
    expect(
      resolveBookingChatDestination({ property_id: null, property_slug: null }, 'acme', {
        propertyId: 'p9',
        propertySlug: 'ctx',
      })
    ).toEqual({ kind: 'property', id: 'p9', inboxPath: '/org/acme/property/ctx/messages' });
  });

  it('routes parking bookings to the parking inbox, ahead of any property id', () => {
    expect(
      resolveBookingChatDestination(
        {
          booking_kind: 'parking',
          property_id: 'p1',
          property_slug: 'solea',
          parking_id: 'k1',
          parking_slug: 'lot-a',
        },
        'acme'
      )
    ).toEqual({ kind: 'parking', id: 'k1', inboxPath: '/org/acme/parking/lot-a/messages' });
  });

  it('returns null when the org, id or slug is missing', () => {
    expect(resolveBookingChatDestination({ property_id: 'p1' }, 'acme')).toBeNull();
    expect(resolveBookingChatDestination({ property_slug: 'solea' }, 'acme')).toBeNull();
    expect(
      resolveBookingChatDestination({ property_id: 'p1', property_slug: 'solea' }, null)
    ).toBeNull();
    expect(
      resolveBookingChatDestination({ booking_kind: 'parking', parking_id: 'k1' }, 'acme')
    ).toBeNull();
  });
});

describe('buildInboxConversationHref', () => {
  it('sets conversationId and the platform tab', () => {
    expect(buildInboxConversationHref('/org/a/property/b/inbox', match())).toBe(
      '/org/a/property/b/inbox?conversationId=c-1&platform=web'
    );
    expect(buildInboxConversationHref('/x', match({ id: 'c 2&3', platform: 'instagram' }))).toBe(
      '/x?conversationId=c+2%263&platform=instagram'
    );
  });

  it('leaves the platform off for channels the inbox has no tab for', () => {
    expect(buildInboxConversationHref('/x', match({ platform: 'airbnb' }))).toBe(
      '/x?conversationId=c-1'
    );
  });
});

describe('buildInboxSearchHref', () => {
  it('encodes the guest name and falls back to the bare inbox', () => {
    expect(buildInboxSearchHref('/x', ' Maria & Jo ')).toBe('/x?search=Maria+%26+Jo');
    expect(buildInboxSearchHref('/x', '  ')).toBe('/x');
  });
});

describe('bookingChatGuestName', () => {
  it('walks guest name, Facebook name, email, then a generic label', () => {
    const base = { primary_guest_name: '', guest_facebook_name: '', guest_email: '' };
    expect(bookingChatGuestName({ ...base, primary_guest_name: ' Maria ' })).toBe('Maria');
    expect(bookingChatGuestName({ ...base, guest_facebook_name: 'Mara S' })).toBe('Mara S');
    expect(bookingChatGuestName({ ...base, guest_email: 'm@x.com' })).toBe('m@x.com');
    expect(bookingChatGuestName(base)).toBe('Guest');
  });
});

describe('bookingChatOutcome', () => {
  it('opens one thread directly, offers a choice for several, and reports none', () => {
    expect(bookingChatOutcome([]).kind).toBe('none');
    expect(bookingChatOutcome([match()]).kind).toBe('open');
    expect(bookingChatOutcome([match(), match({ id: 'c-2', platform: 'facebook' })]).kind).toBe(
      'choose'
    );
  });

  it('opens a lone name match only when the name is a full name', () => {
    const name = (participant_name: string | null) =>
      bookingChatOutcome([match({ match: 'name', participant_name })]).kind;
    expect(name('Maria Santos')).toBe('open');
    expect(name('Cruz')).toBe('choose');
    expect(name('jane.guest')).toBe('choose');
    expect(name(null)).toBe('choose');
    expect(name('  ')).toBe('choose');
  });

  it('never second-guesses a thread linked to the booking or its signed-in guest', () => {
    expect(bookingChatOutcome([match({ participant_name: 'Cruz' })]).kind).toBe('open');
    expect(bookingChatOutcome([match({ match: 'guest', participant_name: null })]).kind).toBe(
      'open'
    );
  });
});
