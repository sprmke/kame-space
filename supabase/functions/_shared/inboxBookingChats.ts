/**
 * Guest Inbox threads that belong to one booking.
 *
 * Powers the chat shortcut on the bookings list: the host clicks the chat icon on a row and
 * lands on the right thread instead of a generic inbox. Three tiers, strongest first:
 *
 *  1. `booking` — `social_conversations.booking_id` is this booking (set by web chat when a
 *     signed-in guest opens chat from their trip).
 *  2. `guest`   — a web thread in the same scope owned by the booking's signed-in guest
 *     (`guest_user_id`). Covers a returning guest whose thread is linked to an earlier stay.
 *  3. `name`    — the participant name matches the guest name or the Facebook name on the
 *     booking. Conservative on purpose (whole tokens only); this is how Meta threads, which
 *     never carry a booking id, are found.
 *
 * Keep `guestNamesMatch` in step with `bookingNamesMatch` in
 * `ui/src/features/dashboard/inbox/lib/inboxMatchBooking.ts`.
 */

import { socialInboxDb } from './socialInboxDb.ts';
import type { SocialPlatform } from './socialInboxTypes.ts';

export type BookingChatMatchKind = 'booking' | 'guest' | 'name';

export type BookingChatBooking = {
  id: string;
  primary_guest_name: string | null;
  guest_facebook_name: string | null;
  guest_user_id: string | null;
};

export type BookingChatRow = {
  id: string;
  platform: SocialPlatform;
  participant_name: string | null;
  participant_avatar_url: string | null;
  subject_preview: string | null;
  last_message_at: string;
  unread_count: number;
  booking_id: string | null;
  match: BookingChatMatchKind;
};

export type BookingChatDto = {
  id: string;
  platform: SocialPlatform;
  participant_name: string | null;
  participant_avatar_url: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
  booking_id: string | null;
  match: BookingChatMatchKind;
};

export const BOOKING_CHAT_LIMIT = 10;
/** Candidates pulled per name query before the strict matcher runs. */
const NAME_CANDIDATE_LIMIT = 60;
const MAX_SEARCH_TOKENS = 6;
const MIN_SEARCH_TOKEN_LENGTH = 3;
const PREVIEW_MAX_CHARS = 140;

const COLUMNS =
  'id, platform, participant_name, participant_avatar_url, subject_preview, last_message_at, unread_count, booking_id, connection_id, property_id, parking_id';

const MATCH_ORDER: Record<BookingChatMatchKind, number> = { booking: 0, guest: 1, name: 2 };

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Strict guest-name match: exact, or every token of the shorter name is a whole token of the
 * longer one. A single token needs 3+ characters, so "Maria" never matches "Mariana".
 */
export function guestNamesMatch(
  participantRaw: string | null | undefined,
  bookingNames: ReadonlyArray<string | null | undefined>
): boolean {
  const participant = normalizeName(participantRaw ?? '');
  if (!participant) return false;

  return bookingNames.some((raw) => {
    const name = normalizeName(raw ?? '');
    if (!name) return false;
    if (name === participant) return true;

    const a = participant.split(' ').filter(Boolean);
    const b = name.split(' ').filter(Boolean);
    if (a.length === 0 || b.length === 0) return false;

    const shorter = a.length <= b.length ? a : b;
    const longer = a.length <= b.length ? b : a;
    const longerSet = new Set(longer);

    if (shorter.length >= 2) return shorter.every((token) => longerSet.has(token));

    const token = shorter[0]!;
    if (token.length < MIN_SEARCH_TOKEN_LENGTH) return false;
    return longerSet.has(token);
  });
}

/**
 * Letters and digits only, so a token can sit inside a PostgREST `or(...)` filter without
 * needing escaping. The strict matcher still decides; this only narrows what we load.
 */
export function nameSearchTokens(names: ReadonlyArray<string | null | undefined>): string[] {
  const tokens = new Set<string>();
  for (const raw of names) {
    for (const token of normalizeName(raw ?? '').split(/[^\p{L}\p{N}]+/u)) {
      if (token.length >= MIN_SEARCH_TOKEN_LENGTH) tokens.add(token);
      if (tokens.size >= MAX_SEARCH_TOKENS) return [...tokens];
    }
  }
  return [...tokens];
}

/** Best tier wins per thread; strongest tier first, then most recent activity. Capped. */
export function rankBookingChats(
  rows: ReadonlyArray<BookingChatRow>,
  limit: number = BOOKING_CHAT_LIMIT
): BookingChatRow[] {
  const best = new Map<string, BookingChatRow>();
  for (const row of rows) {
    const seen = best.get(row.id);
    if (!seen || MATCH_ORDER[row.match] < MATCH_ORDER[seen.match]) best.set(row.id, row);
  }
  return [...best.values()]
    .sort((a, b) => {
      const tier = MATCH_ORDER[a.match] - MATCH_ORDER[b.match];
      if (tier !== 0) return tier;
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
    })
    .slice(0, limit);
}

export function toBookingChatDto(row: BookingChatRow): BookingChatDto {
  const preview = row.subject_preview?.trim() ?? '';
  return {
    id: row.id,
    platform: row.platform,
    participant_name: row.participant_name,
    participant_avatar_url: row.participant_avatar_url,
    last_message_at: row.last_message_at,
    last_message_preview: preview ? preview.slice(0, PREVIEW_MAX_CHARS) : null,
    unread_count: row.unread_count,
    booking_id: row.booking_id,
    match: row.match,
  };
}

type RawRow = Omit<BookingChatRow, 'match'> & {
  connection_id: string | null;
  property_id: string | null;
  parking_id: string | null;
};

type QueryResult = { data: unknown; error: { message: string } | null };

// deno-lint-ignore no-explicit-any
type Db = { from: (table: string) => any };

export type FindBookingChatsArgs = {
  orgId: string;
  propertyId: string | null;
  parkingId: string | null;
  /** Meta connection ids visible in this scope. Empty skips Facebook / Instagram. */
  metaConnectionIds: readonly string[];
  booking: BookingChatBooking;
};

async function run(query: PromiseLike<QueryResult>, label: string): Promise<RawRow[]> {
  const { data, error } = await query;
  if (error) throw new Error(`[inboxBookingChats] ${label}: ${error.message}`);
  return (data ?? []) as RawRow[];
}

export async function findBookingChats(
  args: FindBookingChatsArgs,
  db: Db = socialInboxDb()
): Promise<BookingChatRow[]> {
  const { orgId, propertyId, parkingId, metaConnectionIds, booking } = args;
  const scopeColumn = propertyId ? 'property_id' : 'parking_id';
  const scopeId = propertyId ?? parkingId;
  if (!scopeId) return [];

  const base = (limit: number) =>
    db
      .from('social_conversations')
      .select(COLUMNS)
      .eq('organization_id', orgId)
      .eq('conversation_type', 'dm')
      .limit(limit);

  const names = [booking.primary_guest_name, booking.guest_facebook_name];
  const tokens = nameSearchTokens(names);
  const nameFilter = tokens.map((token) => `participant_name.ilike.%${token}%`).join(',');

  const [exact, identity, webByName, metaByName] = await Promise.all([
    run(base(BOOKING_CHAT_LIMIT * 2).eq('booking_id', booking.id), 'exact'),
    booking.guest_user_id
      ? run(
          base(BOOKING_CHAT_LIMIT)
            .eq('platform', 'web')
            .eq('guest_user_id', booking.guest_user_id)
            .eq(scopeColumn, scopeId)
            .order('last_message_at', { ascending: false }),
          'identity'
        )
      : Promise.resolve([] as RawRow[]),
    tokens.length
      ? run(
          base(NAME_CANDIDATE_LIMIT)
            .eq('platform', 'web')
            .eq(scopeColumn, scopeId)
            .or(nameFilter)
            .order('last_message_at', { ascending: false }),
          'web name'
        )
      : Promise.resolve([] as RawRow[]),
    // Parking has a Chat-only inbox, so Meta threads are never offered there.
    tokens.length && propertyId && metaConnectionIds.length
      ? run(
          base(NAME_CANDIDATE_LIMIT)
            .in('platform', ['facebook', 'instagram'])
            .in('connection_id', [...metaConnectionIds])
            .or(nameFilter)
            .order('last_message_at', { ascending: false }),
          'meta name'
        )
      : Promise.resolve([] as RawRow[]),
  ]);

  // A thread the booking points at is only usable inside the scope it is opened from.
  const metaIds = new Set(metaConnectionIds);
  const exactInScope = exact.filter((row) =>
    row.platform === 'web'
      ? row[scopeColumn] === scopeId
      : Boolean(propertyId) && row.connection_id !== null && metaIds.has(row.connection_id)
  );

  const tag = (rows: RawRow[], match: BookingChatMatchKind): BookingChatRow[] =>
    rows.map((row) => ({
      id: row.id,
      platform: row.platform,
      participant_name: row.participant_name,
      participant_avatar_url: row.participant_avatar_url,
      subject_preview: row.subject_preview,
      last_message_at: row.last_message_at,
      unread_count: row.unread_count,
      booking_id: row.booking_id,
      match,
    }));

  return rankBookingChats([
    ...tag(exactInScope, 'booking'),
    ...tag(identity, 'guest'),
    ...tag(
      [...webByName, ...metaByName].filter((row) => guestNamesMatch(row.participant_name, names)),
      'name'
    ),
  ]);
}
