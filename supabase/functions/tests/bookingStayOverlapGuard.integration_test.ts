/**
 * DB stay-overlap guard (ledger PR-032) against the local Postgres.
 *
 * Proves the trigger added in `20261345000000_booking_stay_no_overlap_guard.sql`:
 *   - rejects an overlapping direct stay (SQLSTATE 23P01)
 *   - lets back-to-back and same-day-turnover stays through
 *   - lets CANCELLED, IMPORTED and OTA-feed rows through
 *   - serializes two concurrent inserts so exactly one wins the race
 *
 * Run with a local stack up:
 *   bun run test:edge:overlap
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { LOCAL_SUPABASE_SERVICE_ROLE_KEY, LOCAL_SUPABASE_URL } from './_localSupabaseEnv.ts';

const serviceHeaders = {
  apikey: LOCAL_SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${LOCAL_SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

const TAG = `overlap-guard-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const CHECK_IN = '11-02-2031';
const CHECK_OUT = '11-05-2031';

function isConflict(status: number, code: string | undefined) {
  // PostgREST maps 23P01 to 400 on this version; accept 409 too so a server upgrade does not
  // break the assertion.
  return (status === 400 || status === 409) && code === '23P01';
}

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...serviceHeaders, Prefer: 'return=representation', ...(init.headers ?? {}) },
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function propertyId(): Promise<string> {
  const { body } = await rest('properties?select=id&limit=1');
  const rows = body as Array<{ id: string }>;
  if (!rows[0]?.id) throw new Error('No property in the local seed. Run `bun run db:reset`.');
  return rows[0].id;
}

function stay(overrides: Record<string, unknown> = {}) {
  return {
    guest_facebook_name: TAG,
    primary_guest_name: TAG,
    guest_phone_number: '0917 000 0000',
    guest_address: 'Test address',
    check_in_date: CHECK_IN,
    check_out_date: CHECK_OUT,
    number_of_nights: 3,
    find_us: 'test',
    payment_receipt_url: '',
    unit_owner: 'Owner',
    tower_and_unit_number: 'Tower 1',
    owner_onsite_contact_person: 'Contact',
    owner_contact_number: '0917 000 0001',
    status: 'PENDING_REVIEW',
    ...overrides,
  };
}

async function insert(property: string, overrides: Record<string, unknown> = {}) {
  return rest('guest_submissions', {
    method: 'POST',
    body: JSON.stringify({ property_id: property, ...stay(overrides) }),
  });
}

async function cleanup() {
  await rest(`guest_submissions?guest_facebook_name=eq.${encodeURIComponent(TAG)}`, {
    method: 'DELETE',
  });
}

Deno.test('DB stay-overlap guard rejects an overlapping direct stay', async () => {
  const property = await propertyId();
  try {
    const first = await insert(property);
    assertEquals(first.status, 201, `first insert: ${first.status} ${first.body?.message ?? ''}`);

    const overlap = await insert(property, {
      check_in_date: '11-03-2031',
      check_out_date: '11-06-2031',
    });
    assertEquals(
      isConflict(overlap.status, overlap.body?.code),
      true,
      `overlap: ${overlap.status} ${overlap.body?.code ?? ''}`
    );
  } finally {
    await cleanup();
  }
});

Deno.test('DB stay-overlap guard allows a back-to-back stay', async () => {
  const property = await propertyId();
  try {
    const first = await insert(property);
    assertEquals(first.status, 201, `first insert: ${first.status}`);

    const next = await insert(property, {
      check_in_date: '11-05-2031',
      check_out_date: '11-08-2031',
    });
    assertEquals(next.status, 201, `next insert: ${next.status} ${next.body?.message ?? ''}`);
  } finally {
    await cleanup();
  }
});

Deno.test('DB stay-overlap guard treats a same-day stay as one occupied night', async () => {
  const property = await propertyId();
  try {
    const dayUse = await insert(property, {
      check_in_date: '11-09-2031',
      check_out_date: '11-09-2031',
      number_of_nights: 1,
    });
    assertEquals(dayUse.status, 201, `day use: ${dayUse.status}`);

    const overnight = await insert(property, {
      check_in_date: '11-08-2031',
      check_out_date: '11-10-2031',
      number_of_nights: 2,
    });
    assertEquals(
      isConflict(overnight.status, overnight.body?.code),
      true,
      `overnight: ${overnight.status}`
    );
  } finally {
    await cleanup();
  }
});

Deno.test('DB stay-overlap guard lets CANCELLED and IMPORTED rows through', async () => {
  const property = await propertyId();
  try {
    for (const overrides of [{ status: 'CANCELLED' }, { status: 'IMPORTED' }]) {
      const res = await insert(property, overrides);
      assertEquals(res.status, 201, `${String(overrides.status)}: ${res.status}`);
    }
  } finally {
    await cleanup();
  }
});

Deno.test('DB stay-overlap guard lets an OTA feed row through', async () => {
  const property = await propertyId();
  let feedId: string | undefined;
  try {
    const feed = await rest('property_calendar_feeds', {
      method: 'POST',
      body: JSON.stringify({
        property_id: property,
        provider: 'airbnb',
        ics_url_encrypted: 'test-not-a-real-feed',
      }),
    });
    if (feed.status !== 201) throw new Error(`feed insert failed: ${feed.status}`);
    feedId = (feed.body as Array<{ id: string }>)[0]?.id;

    const ota = await insert(property, {
      external_feed_id: feedId,
      external_source: 'airbnb',
      external_uid: TAG,
    });
    assertEquals(ota.status, 201, `ota: ${ota.status} ${ota.body?.message ?? ''}`);
  } finally {
    await cleanup();
    if (feedId) await rest(`property_calendar_feeds?id=eq.${feedId}`, { method: 'DELETE' });
  }
});

Deno.test('DB stay-overlap guard serializes two concurrent inserts', async () => {
  const property = await propertyId();
  try {
    const [a, b] = await Promise.all([
      insert(property, { check_in_date: '11-12-2031', check_out_date: '11-15-2031' }),
      insert(property, { check_in_date: '11-13-2031', check_out_date: '11-16-2031' }),
    ]);
    const statuses = [a.status, b.status].sort((x, y) => x - y);
    assertEquals(
      statuses[0] === 201 && isConflict(statuses[1], (a.status === 201 ? b : a).body?.code),
      true,
      `statuses: ${statuses.join(',')}`
    );
  } finally {
    await cleanup();
  }
});
