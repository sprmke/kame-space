/**
 * Bookings list chat shortcut against the live local stack (`./dev.sh` database + auth).
 * Calls the real `social-inbox-booking-chats` handler in process with a real session, real
 * PostgREST filters (`or`, `ilike`, `in`) and real Meta scope resolution. Seeds throwaway rows
 * on the seeded property that has a connected Facebook Page and always cleans up. Skipped unless
 * LOCAL_BOOKING_CHATS_LIVE=1.
 *
 *   LOCAL_BOOKING_CHATS_LIVE=1 bun run test:booking-chats:live
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  LOCAL_SUPABASE_SERVICE_ROLE_KEY,
  LOCAL_SUPABASE_URL,
  applyLocalSupabaseTestEnv,
} from './_localSupabaseEnv.ts';

const enabled = Deno.env.get('LOCAL_BOOKING_CHATS_LIVE') === '1';
const ANON_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const PROPERTY_SLUG = Deno.env.get('BOOKING_CHATS_LIVE_PROPERTY_SLUG');
const GUEST = 'Zed Livetestguest';

const service = {
  apikey: LOCAL_SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${LOCAL_SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...service, Prefer: 'return=representation', ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`REST ${path} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

async function adminUser(path: string, init: RequestInit = {}) {
  const res = await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/admin/${path}`, {
    ...init,
    headers: service,
  });
  return res.json();
}

async function sessionToken(email: string): Promise<string> {
  const link = await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: service,
    body: JSON.stringify({ type: 'magiclink', email }),
  }).then((r) => r.json());
  const verified = await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token_hash: link.hashed_token }),
  }).then((r) => r.json());
  if (!verified.access_token) throw new Error(`no session for ${email}`);
  return verified.access_token as string;
}

/** Removes everything this test seeds, so a crashed earlier run never leaves rows behind. */
async function purge() {
  await rest('social_conversations?external_thread_id=like.live-*', { method: 'DELETE' });
  await rest(`guest_submissions?primary_guest_name=in.("${GUEST}","Qux Nobodyknows")`, {
    method: 'DELETE',
  });
  const listed = await adminUser('users?per_page=200');
  for (const user of (listed.users ?? []) as Array<{ id: string; email?: string }>) {
    if (user.email?.startsWith('booking-chats-')) {
      await adminUser(`users/${user.id}`, { method: 'DELETE' });
    }
  }
}

Deno.test({
  name: 'booking chat shortcut: real handler, real queries, scoped and ranked',
  ignore: !enabled,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    applyLocalSupabaseTestEnv();
    Deno.env.set('EDGE_HANDLER_TEST', '1');
    Deno.env.set('SUPABASE_ANON_KEY', ANON_KEY);
    const { getMountedEdgeHandler } = await import('../_shared/serveEdge.ts');
    await import('../social-inbox-booking-chats/index.ts');
    const handler = getMountedEdgeHandler('social-inbox-booking-chats')!;
    assert(handler, 'handler must mount');

    await purge();
    // The seeded property that owns a connected Facebook Page (override with the env slug).
    let propertyQuery = PROPERTY_SLUG
      ? `properties?slug=eq.${PROPERTY_SLUG}&select=id,organization_id`
      : null;
    if (!propertyQuery) {
      const [fb] = await rest(
        'social_channel_connections?platform=eq.facebook&status=eq.connected&property_id=not.is.null&select=property_id&limit=1'
      );
      assert(fb, 'no property with a connected Facebook Page; run ./dev.sh seed');
      propertyQuery = `properties?id=eq.${fb.property_id}&select=id,organization_id`;
    }
    const [property] = await rest(propertyQuery);
    assert(property, 'fixture property missing; run ./dev.sh seed');
    const [org] = await rest(`organizations?id=eq.${property.organization_id}&select=owner_id`);
    const owner = await adminUser(`users/${org.owner_id}`);
    const token = await sessionToken(owner.email as string);

    const connections = (await rest(
      `social_channel_connections?organization_id=eq.${property.organization_id}&status=eq.connected&select=id,platform,property_id`
    )) as Array<{ id: string; platform: string; property_id: string | null }>;
    const webConn = connections.find((c) => c.platform === 'web')!;
    const fbConn = connections.find((c) => c.platform === 'facebook')!;
    assert(webConn && fbConn, 'fixture web + facebook connections missing');

    const marker = crypto.randomUUID().slice(0, 8);
    const guestUser = await adminUser('users', {
      method: 'POST',
      body: JSON.stringify({
        email: `booking-chats-${marker}@example.com`,
        password: `Bc-${crypto.randomUUID()}`,
        email_confirm: true,
      }),
    });

    const bookingRow = (over: Record<string, unknown>) => ({
      guest_facebook_name: GUEST,
      primary_guest_name: GUEST,
      guest_phone_number: '+639000000000',
      guest_address: 'n/a',
      check_in_date: '12-01-2026',
      check_out_date: '12-03-2026',
      number_of_nights: 2,
      find_us: 'test',
      payment_receipt_url: 'n/a',
      unit_owner: 'n/a',
      tower_and_unit_number: 'n/a',
      owner_onsite_contact_person: 'n/a',
      owner_contact_number: 'n/a',
      guest_email: `booking-chats-${marker}@example.com`,
      ...over,
    });
    const [booking] = await rest('guest_submissions', {
      method: 'POST',
      body: JSON.stringify(bookingRow({ property_id: property.id })),
    });
    // A parking booking: outside the property scope, inside the parking one.
    const [parking] = await rest(
      `parkings?organization_id=eq.${property.organization_id}&select=id&limit=1`
    );
    assert(parking, 'fixture parking missing; run ./dev.sh seed');
    const [foreignBooking] = await rest('guest_submissions', {
      method: 'POST',
      body: JSON.stringify(bookingRow({ property_id: null, parking_id: parking.id })),
    });
    const [soloBooking] = await rest('guest_submissions', {
      method: 'POST',
      body: JSON.stringify(
        bookingRow({
          property_id: property.id,
          primary_guest_name: 'Qux Nobodyknows',
          guest_facebook_name: 'Qux Nobodyknows',
          guest_user_id: null,
        })
      ),
    });

    const conv = (over: Record<string, unknown>) => ({
      organization_id: property.organization_id,
      conversation_type: 'dm',
      last_message_at: new Date().toISOString(),
      subject_preview: 'hello',
      ...over,
    });
    const seedRows = [
      conv({
        connection_id: webConn.id,
        platform: 'web',
        external_thread_id: `live-${marker}-linked`,
        participant_name: 'Someone Else',
        property_id: property.id,
        booking_id: booking.id,
      }),
      conv({
        connection_id: fbConn.id,
        platform: 'facebook',
        external_thread_id: `live-${marker}-fb`,
        participant_name: GUEST,
      }),
      conv({
        connection_id: webConn.id,
        platform: 'web',
        external_thread_id: `live-${marker}-parking`,
        participant_name: GUEST,
        parking_id: parking.id,
      }),
      conv({
        connection_id: fbConn.id,
        platform: 'facebook',
        external_thread_id: `live-${marker}-fb-near`,
        participant_name: 'Zed Livetestguestly',
      }),
    ];
    const created: Array<{ id: string; external_thread_id: string }> = [];
    for (const row of seedRows) {
      const [made] = await rest('social_conversations', {
        method: 'POST',
        body: JSON.stringify(row),
      });
      created.push(made);
    }
    const byThread = Object.fromEntries(created.map((c) => [c.external_thread_id, c.id]));

    const call = async (query: string, method = 'GET') => {
      const res = await handler(
        new Request(`${LOCAL_SUPABASE_URL}/social-inbox-booking-chats?${query}`, {
          method,
          headers: { Authorization: `Bearer ${token}` },
        })
      );
      return { status: res.status, json: (await res.json()) as Record<string, any> };
    };

    try {
      // Exact link first, then the Facebook name match; the near-miss name is excluded.
      const ok = await call(`booking_id=${booking.id}&property_id=${property.id}`);
      assertEquals(ok.status, 200);
      const rows = ok.json.data.conversations as Array<{ id: string; match: string }>;
      assertEquals(
        rows.map((r) => `${r.match}:${r.id}`),
        [`booking:${byThread[`live-${marker}-linked`]}`, `name:${byThread[`live-${marker}-fb`]}`]
      );

      // A booking nobody wrote about has no chat.
      const none = await call(`booking_id=${soloBooking.id}&property_id=${property.id}`);
      assertEquals(none.status, 200);
      assertEquals(none.json.data.conversations, []);

      // Guest identity: a thread owned by the booking's signed-in guest, linked to no booking.
      await rest(`guest_submissions?id=eq.${booking.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ guest_user_id: guestUser.id }),
      });
      const [identity] = (await rest('social_conversations', {
        method: 'POST',
        body: JSON.stringify(
          conv({
            connection_id: webConn.id,
            platform: 'web',
            external_thread_id: `live-${marker}-guest`,
            participant_name: 'Initials Only',
            property_id: property.id,
            guest_user_id: guestUser.id,
          })
        ),
      })) as Array<{ id: string }>;
      const withIdentity = await call(`booking_id=${booking.id}&property_id=${property.id}`);
      const tiers = (withIdentity.json.data.conversations as Array<{ id: string; match: string }>)
        .filter((r) => r.id === identity.id)
        .map((r) => r.match);
      assertEquals(tiers, ['guest']);

      // Parking scope: only the parking Chat thread, never Facebook or a property thread.
      const parkingResult = await call(`booking_id=${foreignBooking.id}&parking_id=${parking.id}`);
      assertEquals(parkingResult.status, 200);
      assertEquals(
        (parkingResult.json.data.conversations as Array<{ id: string; match: string }>).map(
          (r) => `${r.match}:${r.id}`
        ),
        [`name:${byThread[`live-${marker}-parking`]}`]
      );
      // A property booking asked for under the parking scope is not found.
      assertEquals((await call(`booking_id=${booking.id}&parking_id=${parking.id}`)).status, 404);

      // Input validation and scope isolation.
      assertEquals((await call(`booking_id=not-a-uuid&property_id=${property.id}`)).status, 400);
      assertEquals((await call(`booking_id=${booking.id}`)).status, 400);
      assertEquals(
        (await call(`booking_id=${foreignBooking.id}&property_id=${property.id}`)).status,
        404
      );
      assertEquals(
        (await call(`booking_id=${booking.id}&property_id=${property.id}`, 'POST')).status,
        405
      );
      const noAuth = await handler(
        new Request(
          `${LOCAL_SUPABASE_URL}/social-inbox-booking-chats?booking_id=${booking.id}&property_id=${property.id}`
        )
      );
      assertEquals(noAuth.status, 401);
      await noAuth.text();
    } finally {
      await purge();
    }
  },
});
