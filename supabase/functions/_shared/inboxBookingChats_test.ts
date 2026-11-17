import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  findBookingChats,
  guestNamesMatch,
  nameSearchTokens,
  rankBookingChats,
  toBookingChatDto,
  type BookingChatBooking,
  type BookingChatRow,
} from './inboxBookingChats.ts';

const PROPERTY = 'prop-1';
const OTHER_PROPERTY = 'prop-2';
const PARKING = 'park-1';
const ORG = 'org-1';
const META_CONN = 'conn-1';
const OTHER_CONN = 'conn-2';

type Row = Record<string, unknown>;

/** Minimal chainable stand-in: applies eq / in, ignores or / order / limit (matcher is strict). */
function fakeDb(rows: Row[]) {
  return {
    from(_table: string) {
      const filters: Array<(r: Row) => boolean> = [];
      const builder = {
        select: () => builder,
        eq: (col: string, val: unknown) => (filters.push((r) => r[col] === val), builder),
        in: (col: string, vals: unknown[]) => (filters.push((r) => vals.includes(r[col])), builder),
        or: () => builder,
        order: () => builder,
        limit: () => builder,
        then: (resolve: (v: { data: Row[]; error: null }) => unknown) =>
          resolve({ data: rows.filter((r) => filters.every((f) => f(r))), error: null }),
      };
      return builder;
    },
  };
}

function conv(over: Row): Row {
  return {
    id: 'c',
    organization_id: ORG,
    conversation_type: 'dm',
    platform: 'web',
    participant_name: null,
    participant_avatar_url: null,
    subject_preview: null,
    last_message_at: '2026-11-10T00:00:00Z',
    unread_count: 0,
    booking_id: null,
    connection_id: null,
    property_id: PROPERTY,
    parking_id: null,
    guest_user_id: null,
    ...over,
  };
}

const booking: BookingChatBooking = {
  id: 'b-1',
  primary_guest_name: 'Maria Santos',
  guest_facebook_name: 'Mara Santos',
  guest_user_id: 'u-1',
};

const args = (over: Partial<Parameters<typeof findBookingChats>[0]> = {}) => ({
  orgId: ORG,
  propertyId: PROPERTY,
  parkingId: null,
  metaConnectionIds: [META_CONN],
  booking,
  ...over,
});

Deno.test('guestNamesMatch: exact, whole-token and short-name rules', () => {
  assertEquals(guestNamesMatch('Maria Santos', ['maria  santos']), true);
  assertEquals(guestNamesMatch('Maria Santos Cruz', ['Maria Santos']), true);
  assertEquals(guestNamesMatch('Santos', ['Maria Santos']), true);
  assertEquals(guestNamesMatch('Maria', ['Mariana Lopez']), false);
  assertEquals(guestNamesMatch('Jo', ['Jo Ann Reyes']), false);
  assertEquals(guestNamesMatch('', ['Maria Santos']), false);
  assertEquals(guestNamesMatch('Maria Santos', [null, '']), false);
  assertEquals(guestNamesMatch('Mara Santos', ['Maria Santos', 'Mara Santos']), true);
});

Deno.test('nameSearchTokens: letters and digits only, short and duplicate tokens dropped', () => {
  assertEquals(nameSearchTokens(["O'Brien, Jo (VIP)", 'Maria Santos', 'maria']), [
    'brien',
    'vip',
    'maria',
    'santos',
  ]);
  assertEquals(nameSearchTokens([null, undefined, 'Al']), []);
});

Deno.test(
  'rankBookingChats: strongest tier first, newest within a tier, one row per thread',
  () => {
    const row = (id: string, match: BookingChatRow['match'], at: string): BookingChatRow => ({
      id,
      platform: 'web',
      participant_name: null,
      participant_avatar_url: null,
      subject_preview: null,
      last_message_at: at,
      unread_count: 0,
      booking_id: null,
      match,
    });
    const ranked = rankBookingChats([
      row('a', 'name', '2026-11-12T00:00:00Z'),
      row('b', 'booking', '2026-11-01T00:00:00Z'),
      row('a', 'guest', '2026-11-12T00:00:00Z'),
      row('c', 'name', '2026-11-15T00:00:00Z'),
    ]);
    assertEquals(
      ranked.map((r) => `${r.id}:${r.match}`),
      ['b:booking', 'a:guest', 'c:name']
    );
    assertEquals(rankBookingChats(ranked, 2).length, 2);
  }
);

Deno.test('toBookingChatDto: trims and caps the preview, drops connection internals', () => {
  const dto = toBookingChatDto({
    id: 'x',
    platform: 'facebook',
    participant_name: 'Maria',
    participant_avatar_url: null,
    subject_preview: `  ${'a'.repeat(300)}  `,
    last_message_at: '2026-11-10T00:00:00Z',
    unread_count: 2,
    booking_id: null,
    match: 'name',
  });
  assertEquals(dto.last_message_preview?.length, 140);
  assertEquals('connection_id' in dto, false);
});

Deno.test('findBookingChats: exact booking link wins and is scoped to the property', async () => {
  const db = fakeDb([
    conv({ id: 'linked', booking_id: 'b-1', participant_name: 'Anyone' }),
    conv({ id: 'elsewhere', booking_id: 'b-1', property_id: OTHER_PROPERTY }),
  ]);
  const result = await findBookingChats(args(), db);
  assertEquals(
    result.map((r) => `${r.id}:${r.match}`),
    ['linked:booking']
  );
});

Deno.test(
  'findBookingChats: signed-in guest identity finds a thread linked to another stay',
  async () => {
    const db = fakeDb([
      conv({ id: 'older', booking_id: 'b-0', guest_user_id: 'u-1', participant_name: 'Maria S.' }),
      conv({ id: 'stranger', guest_user_id: 'u-9', participant_name: 'Someone Else' }),
    ]);
    const result = await findBookingChats(args(), db);
    assertEquals(
      result.map((r) => `${r.id}:${r.match}`),
      ['older:guest']
    );
  }
);

Deno.test(
  'findBookingChats: name matches span web, Facebook and Instagram on the scope Page only',
  async () => {
    const db = fakeDb([
      conv({
        id: 'fb',
        platform: 'facebook',
        connection_id: META_CONN,
        participant_name: 'Mara Santos',
        property_id: null,
      }),
      conv({
        id: 'ig',
        platform: 'instagram',
        connection_id: META_CONN,
        participant_name: 'Maria Santos',
        property_id: null,
      }),
      conv({
        id: 'other-page',
        platform: 'facebook',
        connection_id: OTHER_CONN,
        participant_name: 'Maria Santos',
        property_id: null,
      }),
      conv({ id: 'web', participant_name: 'Maria Santos Reyes' }),
      conv({ id: 'near-miss', participant_name: 'Mariana Santos' }),
    ]);
    const result = await findBookingChats(args(), db);
    assertEquals(result.map((r) => r.id).sort(), ['fb', 'ig', 'web']);
    assertEquals(
      result.every((r) => r.match === 'name'),
      true
    );
  }
);

Deno.test('findBookingChats: no match returns an empty list', async () => {
  const db = fakeDb([conv({ id: 'unrelated', participant_name: 'Juan Dela Cruz' })]);
  assertEquals(await findBookingChats(args(), db), []);
});

Deno.test(
  'findBookingChats: parking scope never offers Meta threads and keys on parking_id',
  async () => {
    const db = fakeDb([
      conv({
        id: 'park-web',
        property_id: null,
        parking_id: PARKING,
        participant_name: 'Maria Santos',
      }),
      conv({ id: 'prop-web', participant_name: 'Maria Santos' }),
      conv({
        id: 'fb',
        platform: 'facebook',
        connection_id: META_CONN,
        participant_name: 'Maria Santos',
        property_id: null,
      }),
    ]);
    const result = await findBookingChats(
      args({ propertyId: null, parkingId: PARKING, metaConnectionIds: [META_CONN] }),
      db
    );
    assertEquals(
      result.map((r) => r.id),
      ['park-web']
    );
  }
);

Deno.test(
  'findBookingChats: a booking with no usable name or identity still honours the exact link',
  async () => {
    const db = fakeDb([conv({ id: 'linked', booking_id: 'b-2', participant_name: 'Zed' })]);
    const result = await findBookingChats(
      args({
        booking: {
          id: 'b-2',
          primary_guest_name: null,
          guest_facebook_name: null,
          guest_user_id: null,
        },
      }),
      db
    );
    assertEquals(
      result.map((r) => r.id),
      ['linked']
    );
  }
);
