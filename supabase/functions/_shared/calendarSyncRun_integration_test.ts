/**
 * Integration test for the Phase 2 calendar-sync ingestion pipeline — runs `runFeedSync`
 * against the **local** Supabase Postgres with a stubbed ICS fetcher.
 *
 * Run (local stack must be up):
 *   deno test --allow-net --allow-env --allow-read --no-check \
 *     --env-file=supabase/.temp/functions-serve.env \
 *     supabase/functions/_shared/calendarSyncRun_integration_test.ts
 *
 * Every test seeds its own property_calendar_feeds row and cleans up after itself.
 */

import { assertEquals, assert } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import { createServiceClient } from './orgAuth.ts';
import { encryptIntegrationSecret } from './secretsCrypto.ts';
import {
  loadExportRanges,
  runFeedSync,
  type CalendarFeedRow,
  type IcsFetcher,
} from './calendarSyncRun.ts';
import type { FetchIcsResult } from './calendarSyncService.ts';

const sb = createServiceClient();

function ics(events: string[]): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Test//EN',
    'CALSCALE:GREGORIAN',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}

function vevent(
  uid: string,
  start: string,
  end: string,
  summary: string,
  description?: string
): string {
  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${summary}`,
    ...(description ? [`DESCRIPTION:${description}`] : []),
    'END:VEVENT',
  ].join('\r\n');
}

function stubFetch(body: string, over?: Partial<FetchIcsResult>) {
  return (): Promise<FetchIcsResult> =>
    Promise.resolve({
      status: 200,
      notModified: false,
      body,
      etag: null,
      lastModified: null,
      ...over,
    });
}

async function firstPropertyId(): Promise<string> {
  const { data } = await sb.from('properties').select('id').limit(1).maybeSingle();
  assert(data?.id, 'need at least one property in the local DB');
  return data!.id as string;
}

async function seedFeed(
  propertyId: string,
  createBookings: boolean,
  provider: 'airbnb' | 'booking_com' | 'agoda' = 'airbnb'
): Promise<CalendarFeedRow> {
  const enc = await encryptIntegrationSecret('https://example.com/calendar.ics');
  const { data, error } = await sb
    .from('property_calendar_feeds')
    .insert({
      property_id: propertyId,
      provider,
      label: `itest-${crypto.randomUUID().slice(0, 8)}`,
      ics_url_encrypted: enc,
      create_bookings: createBookings,
    })
    .select(
      'id, property_id, provider, label, ics_url_encrypted, is_active, create_bookings, last_etag, last_modified_header, last_feed_hash, consecutive_failures, empty_pull_streak'
    )
    .single();
  if (error) throw new Error(`seedFeed: ${error.message}`);
  return data as CalendarFeedRow;
}

async function cleanupFeed(feedId: string): Promise<void> {
  // property_blocked_dates + calendar_sync_events cascade on feed delete;
  // guest_submissions.external_feed_id is SET NULL, so delete those rows explicitly.
  await sb.from('guest_submissions').delete().eq('external_feed_id', feedId);
  await sb.from('property_calendar_feeds').delete().eq('id', feedId);
}

async function feedRow(feedId: string) {
  const { data } = await sb.from('property_calendar_feeds').select('*').eq('id', feedId).single();
  return data as Record<string, unknown>;
}

/**
 * `claimFeed` serialises runs on `last_attempted_at` (even `force` keeps a 5 s window).
 * Between sequential runs in a test, push the timestamp back so the next claim succeeds.
 */
async function reopenClaim(feedId: string): Promise<void> {
  await sb
    .from('property_calendar_feeds')
    .update({ last_attempted_at: new Date(Date.now() - 60_000).toISOString() })
    .eq('id', feedId);
}

/** Reload the feed row shaped as CalendarFeedRow, with the claim window reopened. */
async function refetch(base: CalendarFeedRow): Promise<CalendarFeedRow> {
  await reopenClaim(base.id);
  return { ...base, ...(await feedRow(base.id)) } as CalendarFeedRow;
}

async function blocks(feedId: string) {
  const { data } = await sb
    .from('property_blocked_dates')
    .select('start_date,end_date,source,external_uid,external_summary')
    .eq('feed_id', feedId)
    .order('start_date');
  return data ?? [];
}

async function bookings(feedId: string) {
  const { data } = await sb
    .from('guest_submissions')
    .select(
      'id,status,check_in_date,check_out_date,number_of_nights,primary_guest_name,guest_email,booking_source,external_source,external_uid'
    )
    .eq('external_feed_id', feedId)
    .order('check_in_date');
  return data ?? [];
}

async function events(feedId: string) {
  const { data } = await sb
    .from('calendar_sync_events')
    .select('action,external_uid,detail')
    .eq('feed_id', feedId)
    .order('created_at');
  return data ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────

Deno.test(
  'Phase 1: block-only feed - create, reschedule, remove; feed health tracked',
  async () => {
    const pid = await firstPropertyId();
    const feed = await seedFeed(pid, false);
    try {
      // pull 1 — two block events
      let r = await runFeedSync(feed, {
        runId: crypto.randomUUID(),
        force: true,
        fetchIcs: stubFetch(
          ics([
            vevent('blkA@abnb', '20270301', '20270305', 'Airbnb (Not available)'),
            vevent('blkB@abnb', '20270401', '20270403', 'Blocked'),
          ])
        ),
      });
      assertEquals(r.status, 'synced');
      assertEquals(r.blocksCreated, 2);
      assertEquals(r.bookingsCreated, 0, 'create_bookings=false must not make bookings');
      let b = await blocks(feed.id);
      assertEquals(b.length, 2);
      assertEquals(
        b.every((x) => x.source === 'ical_import'),
        true
      );

      // pull 2 — blkA dates change, blkB gone, new blkC
      const fresh = await refetch(feed);
      r = await runFeedSync(fresh, {
        runId: crypto.randomUUID(),
        force: true,
        fetchIcs: stubFetch(
          ics([
            vevent('blkA@abnb', '20270302', '20270306', 'Airbnb (Not available)'),
            vevent('blkC@abnb', '20270501', '20270502', 'Blocked'),
          ])
        ),
      });
      assertEquals(r.blocksCreated, 1);
      assertEquals(r.blocksUpdated, 1);
      assertEquals(r.blocksRemoved, 1);
      b = await blocks(feed.id);
      assertEquals(b.map((x) => x.external_uid).sort(), ['blkA@abnb', 'blkC@abnb']);
      const a = b.find((x) => x.external_uid === 'blkA@abnb')!;
      assertEquals(String(a.start_date), '2027-03-02');
      assertEquals(String(a.end_date), '2027-03-06');

      const fh = await feedRow(feed.id);
      assertEquals(fh.consecutive_failures, 0);
      assert(fh.last_success_at, 'last_success_at set');
      assert(fh.last_feed_hash, 'last_feed_hash set');
    } finally {
      await cleanupFeed(feed.id);
    }
  }
);

Deno.test(
  'Phase 2: reservation ingestion - create PENDING_REVIEW booking + block + notification',
  async () => {
    const pid = await firstPropertyId();
    const feed = await seedFeed(pid, true);
    try {
      const r = await runFeedSync(feed, {
        runId: crypto.randomUUID(),
        force: true,
        fetchIcs: stubFetch(
          ics([
            vevent(
              'resv1@abnb',
              '20270610',
              '20270613',
              'Reserved',
              'Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMWXYZ99\\nPhone Number (Last 4 Digits): 4321'
            ),
            vevent('ownblk@abnb', '20270620', '20270622', 'Airbnb (Not available)'),
          ])
        ),
      });
      assertEquals(r.status, 'synced');
      assertEquals(
        r.blocksCreated,
        2,
        'both the reservation and the owner-block get an ical_import block'
      );
      assertEquals(r.bookingsCreated, 1, 'only the reservation VEVENT becomes a booking');

      const bk = await bookings(feed.id);
      assertEquals(bk.length, 1);
      const row = bk[0];
      assertEquals(row.status, 'PENDING_REVIEW');
      assertEquals(row.booking_source, 'Airbnb');
      assertEquals(row.external_source, 'airbnb');
      assertEquals(row.external_uid, 'resv1@abnb');
      assertEquals(row.guest_email, null, 'no guest email until completion');
      assertEquals(String(row.check_in_date), '06-10-2027', 'stored MM-DD-YYYY');
      assertEquals(String(row.check_out_date), '06-13-2027');
      assertEquals(row.number_of_nights, 3);
      assertEquals(row.primary_guest_name, 'Airbnb HMWXYZ99', 'confirmation code from DESCRIPTION');

      const ev = await events(feed.id);
      assert(
        ev.some((e) => e.action === 'booking_created'),
        'booking_created event written'
      );

      const { data: notif } = await sb
        .from('notifications')
        .select('type,dedupe_key')
        .eq('type', 'booking_external_imported')
        .eq('dedupe_key', `booking:${row.id}:external_imported`)
        .maybeSingle();
      assert(notif, 'booking_external_imported notification emitted');
      if (notif) await sb.from('notifications').delete().eq('dedupe_key', notif.dedupe_key);
    } finally {
      await cleanupFeed(feed.id);
    }
  }
);

Deno.test(
  'Phase 2: reschedule while PENDING_REVIEW reverts to PENDING_REVIEW; blocked after review',
  async () => {
    const pid = await firstPropertyId();
    const feed = await seedFeed(pid, true);
    try {
      await runFeedSync(feed, {
        runId: crypto.randomUUID(),
        force: true,
        fetchIcs: stubFetch(ics([vevent('rsx@abnb', '20270701', '20270704', 'Reserved')])),
      });
      let bk = await bookings(feed.id);
      const id = bk[0].id as string;

      // dates change on the OTA — still PENDING_REVIEW → guarded update applies
      let fresh = await refetch(feed);
      let r = await runFeedSync(fresh, {
        runId: crypto.randomUUID(),
        force: true,
        fetchIcs: stubFetch(ics([vevent('rsx@abnb', '20270705', '20270709', 'Reserved')])),
      });
      assertEquals(r.bookingsUpdated, 1);
      bk = await bookings(feed.id);
      assertEquals(String(bk[0].check_in_date), '07-05-2027');
      assertEquals(bk[0].number_of_nights, 4);
      assertEquals(bk[0].status, 'PENDING_REVIEW');

      // host advances the booking, THEN the OTA reschedules again → guarded update = 0 rows
      await sb.from('guest_submissions').update({ status: 'READY_FOR_CHECKIN' }).eq('id', id);
      fresh = await refetch(feed);
      r = await runFeedSync(fresh, {
        runId: crypto.randomUUID(),
        force: true,
        fetchIcs: stubFetch(ics([vevent('rsx@abnb', '20270710', '20270714', 'Reserved')])),
      });
      assertEquals(r.bookingsUpdated, 0, 'must not force a booking that is past review');
      bk = await bookings(feed.id);
      assertEquals(String(bk[0].check_in_date), '07-05-2027', 'dates unchanged after review');
      const ev = await events(feed.id);
      assert(
        ev.some(
          (e) =>
            e.action === 'skipped' &&
            (e.detail as Record<string, unknown>)?.reason === 'reschedule_after_review'
        ),
        'logs reschedule_after_review'
      );
    } finally {
      await cleanupFeed(feed.id);
    }
  }
);

Deno.test(
  'Phase 2: cancellation - cancel while pending; skip when past check-in (stale feed drop)',
  async () => {
    const pid = await firstPropertyId();
    const feed = await seedFeed(pid, true);
    try {
      // two reservations
      await runFeedSync(feed, {
        runId: crypto.randomUUID(),
        force: true,
        fetchIcs: stubFetch(
          ics([
            vevent('cancelme@abnb', '20270801', '20270803', 'Reserved'),
            vevent('keepme@abnb', '20270810', '20270812', 'Reserved'),
          ])
        ),
      });
      let bk = await bookings(feed.id);
      assertEquals(bk.length, 2);
      const staleId = bk.find((x) => x.external_uid === 'keepme@abnb')!.id as string;
      // simulate this stay already checked in
      await sb.from('guest_submissions').update({ status: 'READY_FOR_CHECKIN' }).eq('id', staleId);

      // next pull: BOTH uids gone from the feed
      const fresh = await refetch(feed);
      const r = await runFeedSync(fresh, {
        runId: crypto.randomUUID(),
        force: true,
        // one unrelated event so the feed isn't "empty" (empty-feed guard)
        fetchIcs: stubFetch(ics([vevent('other@abnb', '20271201', '20271203', 'Reserved')])),
      });
      assertEquals(r.bookingsCancelled, 1, 'only the pending one is cancelled');
      assertEquals(r.bookingsCreated, 1, 'the unrelated new event is ingested');

      bk = await bookings(feed.id);
      const cancelled = bk.find((x) => x.external_uid === 'cancelme@abnb')!;
      assertEquals(cancelled.status, 'CANCELLED');
      const stale = bk.find((x) => x.external_uid === 'keepme@abnb')!;
      assertEquals(stale.status, 'READY_FOR_CHECKIN', 'past-check-in feed drop must NOT cancel');

      const ev = await events(feed.id);
      assert(
        ev.some(
          (e) =>
            e.action === 'skipped' &&
            (e.detail as Record<string, unknown>)?.reason === 'past_checkin_feed_drop'
        ),
        'logs past_checkin_feed_drop'
      );
      assert(
        ev.some((e) => e.action === 'booking_cancelled'),
        'logs booking_cancelled'
      );
    } finally {
      await cleanupFeed(feed.id);
    }
  }
);

Deno.test('Engine: 304 not-modified and byte-identical body are no-ops', async () => {
  const pid = await firstPropertyId();
  const feed = await seedFeed(pid, true);
  try {
    const body = ics([vevent('x@abnb', '20270901', '20270903', 'Reserved')]);
    await runFeedSync(feed, { runId: crypto.randomUUID(), force: true, fetchIcs: stubFetch(body) });
    assertEquals((await bookings(feed.id)).length, 1);

    // identical body → unchanged (hash short-circuit), no dup
    let fresh = await refetch(feed);
    let r = await runFeedSync(fresh, {
      runId: crypto.randomUUID(),
      force: true,
      fetchIcs: stubFetch(body),
    });
    assertEquals(r.status, 'unchanged');
    assertEquals((await bookings(feed.id)).length, 1);

    // 304 → not_modified, failure counters stay clean
    fresh = await refetch(feed);
    r = await runFeedSync(fresh, {
      runId: crypto.randomUUID(),
      force: true,
      fetchIcs: stubFetch('', { notModified: true, status: 304 }),
    });
    assertEquals(r.status, 'not_modified');
    assertEquals((await feedRow(feed.id)).consecutive_failures, 0);
  } finally {
    await cleanupFeed(feed.id);
  }
});

Deno.test(
  'Engine: HTTP error bumps failure count and leaves imported blocks untouched',
  async () => {
    const pid = await firstPropertyId();
    const feed = await seedFeed(pid, false);
    try {
      await runFeedSync(feed, {
        runId: crypto.randomUUID(),
        force: true,
        fetchIcs: stubFetch(ics([vevent('keep@abnb', '20271001', '20271003', 'Blocked')])),
      });
      assertEquals((await blocks(feed.id)).length, 1);

      const fresh = await refetch(feed);
      const r = await runFeedSync(fresh, {
        runId: crypto.randomUUID(),
        force: true,
        fetchIcs: () => Promise.reject(new Error('boom')),
      });
      assertEquals(r.ok, false);
      assertEquals(r.status, 'error');
      assertEquals(
        (await blocks(feed.id)).length,
        1,
        'a failed pull never deletes existing blocks'
      );
      assertEquals((await feedRow(feed.id)).consecutive_failures, 1);
    } finally {
      await cleanupFeed(feed.id);
    }
  }
);

Deno.test('Engine: empty-feed guard - a single empty pull does NOT mass-remove', async () => {
  const pid = await firstPropertyId();
  const feed = await seedFeed(pid, false);
  try {
    await runFeedSync(feed, {
      runId: crypto.randomUUID(),
      force: true,
      fetchIcs: stubFetch(ics([vevent('e1@abnb', '20271101', '20271103', 'Blocked')])),
    });
    assertEquals((await blocks(feed.id)).length, 1);

    const fresh = await refetch(feed);
    const r = await runFeedSync(fresh, {
      runId: crypto.randomUUID(),
      force: true,
      fetchIcs: stubFetch(ics([])), // valid but empty
    });
    assertEquals(r.status, 'skipped');
    assertEquals((await blocks(feed.id)).length, 1, 'first empty pull is not trusted');
    assertEquals((await feedRow(feed.id)).empty_pull_streak, 1);
  } finally {
    await cleanupFeed(feed.id);
  }
});

Deno.test(
  'Feed health: calendar_sync_failing fires once at exactly 4 consecutive failures',
  async () => {
    const pid = await firstPropertyId();
    const feed = await seedFeed(pid, false);
    const boom: IcsFetcher = () => Promise.reject(new Error('unreachable'));
    const dedupe = `feed:${pid}:${feed.label}:failing`;
    const notifCount = async (): Promise<number> => {
      const { count } = await sb
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'calendar_sync_failing')
        .eq('dedupe_key', dedupe);
      return count ?? 0;
    };
    try {
      for (let i = 1; i <= 5; i++) {
        const fresh = await refetch(feed);
        const r = await runFeedSync(fresh, {
          runId: crypto.randomUUID(),
          force: true,
          fetchIcs: boom,
        });
        assertEquals(r.ok, false);
        assertEquals((await feedRow(feed.id)).consecutive_failures, i, `failures after run ${i}`);
        const n = await notifCount();
        if (i < 4) assertEquals(n, 0, `no notification before the 4th failure (run ${i})`);
        else assertEquals(n, 1, `exactly one notification, not re-fired (run ${i})`);
      }
    } finally {
      await sb.from('notifications').delete().eq('dedupe_key', dedupe);
      await cleanupFeed(feed.id);
    }
  }
);

Deno.test(
  'Conflict pass: imported reservation overlapping a manual block is kept + flagged',
  async () => {
    const pid = await firstPropertyId();
    const feed = await seedFeed(pid, true);
    const { data: manual } = await sb
      .from('property_blocked_dates')
      .insert({
        property_id: pid,
        start_date: '2027-12-02',
        end_date: '2027-12-06',
        source: 'manual',
        note: 'itest-manual',
      })
      .select('id')
      .single();
    try {
      const r = await runFeedSync(feed, {
        runId: crypto.randomUUID(),
        force: true,
        fetchIcs: stubFetch(ics([vevent('ov@abnb', '20271201', '20271204', 'Reserved')])),
      });
      assertEquals(r.blocksCreated, 1, 'the overlapping import is still applied');
      assert(r.conflicts >= 1, 'conflict detected');
      const ev = await events(feed.id);
      assert(
        ev.some((e) => e.action === 'conflict_detected'),
        'conflict_detected event written'
      );
      const { data: conflictNotes } = await sb
        .from('notifications')
        .select('id, dedupe_key, metadata')
        .eq('type', 'calendar_conflict')
        .like('dedupe_key', `conflict:${feed.id}:%`);
      assertEquals(conflictNotes?.length ?? 0, 1, 'one summary calendar_conflict notification');
      assertEquals(
        (conflictNotes?.[0]?.metadata as { conflict_count?: number } | null)?.conflict_count,
        r.conflicts
      );
    } finally {
      await sb.from('property_blocked_dates').delete().eq('id', manual?.id);
      await sb.from('notifications').delete().like('dedupe_key', `conflict:${feed.id}:%`);
      await cleanupFeed(feed.id);
    }
  }
);

Deno.test('Phase 2: past reservations are skipped, not imported as ghost bookings', async () => {
  const pid = await firstPropertyId();
  const feed = await seedFeed(pid, true);
  try {
    const r = await runFeedSync(feed, {
      runId: crypto.randomUUID(),
      force: true,
      fetchIcs: stubFetch(ics([vevent('paststay@abnb', '20200101', '20200103', 'Reserved')])),
    });
    assertEquals(r.status, 'synced');
    assertEquals(r.bookingsCreated, 0);
    assertEquals(r.bookingsLinked, 0);
    assertEquals((await bookings(feed.id)).length, 0);

    const ev = await events(feed.id);
    assert(
      ev.some(
        (e) =>
          e.action === 'skipped' && (e.detail as { reason?: string } | null)?.reason === 'past_stay'
      ),
      'past_stay skip recorded'
    );
  } finally {
    await cleanupFeed(feed.id);
  }
});

Deno.test('Phase 2: a manually entered Airbnb stay is adopted, not duplicated', async () => {
  const pid = await firstPropertyId();
  const feed = await seedFeed(pid, true);
  const body = ics([vevent('adopt@abnb', '20270810', '20270812', 'Reserved')]);
  try {
    let r = await runFeedSync(feed, {
      runId: crypto.randomUUID(),
      force: true,
      fetchIcs: stubFetch(body),
    });
    assertEquals(r.bookingsCreated, 1);
    const created = (await bookings(feed.id))[0]!;

    // Detach provenance: this is what a host-entered Airbnb stay looks like.
    await sb
      .from('guest_submissions')
      .update({ external_source: null, external_uid: null, external_feed_id: null })
      .eq('id', created.id);
    await sb
      .from('property_calendar_feeds')
      .update({
        last_feed_hash: null,
        last_attempted_at: new Date(Date.now() - 60_000).toISOString(),
      })
      .eq('id', feed.id);

    r = await runFeedSync(await refetch(feed), {
      runId: crypto.randomUUID(),
      force: true,
      fetchIcs: stubFetch(body),
    });
    assertEquals(r.bookingsCreated, 0, 'no second row');
    assertEquals(r.bookingsLinked, 1, 'existing row linked');

    const rows = await bookings(feed.id);
    assertEquals(rows.length, 1);
    assertEquals(rows[0]!.id, created.id);
    assertEquals(rows[0]!.external_uid, 'adopt@abnb');

    const ev = await events(feed.id);
    assert(
      ev.some((e) => e.action === 'booking_linked'),
      'booking_linked event written'
    );
  } finally {
    await cleanupFeed(feed.id);
  }
});

Deno.test('Phase 2: turning ingestion off still cancels an existing imported booking', async () => {
  const pid = await firstPropertyId();
  const feed = await seedFeed(pid, true);
  try {
    let r = await runFeedSync(feed, {
      runId: crypto.randomUUID(),
      force: true,
      fetchIcs: stubFetch(ics([vevent('offcancel@abnb', '20271010', '20271012', 'Reserved')])),
    });
    assertEquals(r.bookingsCreated, 1);

    await sb.from('property_calendar_feeds').update({ create_bookings: false }).eq('id', feed.id);
    const off = await refetch(feed);

    // Reservation gone, but the feed is not empty (an unrelated block keeps it healthy).
    r = await runFeedSync(off, {
      runId: crypto.randomUUID(),
      force: true,
      fetchIcs: stubFetch(ics([vevent('offblock@abnb', '20271101', '20271102', 'Blocked')])),
    });
    assertEquals(r.bookingsCancelled, 1, 'cancellation still reconciles with ingestion off');
    assertEquals(r.bookingsCreated, 0, 'no new rows while ingestion is off');

    const { data } = await sb
      .from('guest_submissions')
      .select('status')
      .eq('external_feed_id', feed.id)
      .maybeSingle();
    assertEquals(data?.status, 'CANCELLED');
  } finally {
    await cleanupFeed(feed.id);
  }
});

Deno.test('Phase 2: reconnecting the same feed relinks the existing booking', async () => {
  const pid = await firstPropertyId();
  const feedA = await seedFeed(pid, true);
  const feedB = await seedFeed(pid, true);
  const body = ics([vevent('relink@abnb', '20270910', '20270912', 'Reserved')]);
  try {
    await runFeedSync(feedA, {
      runId: crypto.randomUUID(),
      force: true,
      fetchIcs: stubFetch(body),
    });
    const created = (await bookings(feedA.id))[0]!;

    // Feed removal clears external_feed_id but keeps the reservation UID.
    await sb.from('guest_submissions').update({ external_feed_id: null }).eq('id', created.id);

    const r = await runFeedSync(feedB, {
      runId: crypto.randomUUID(),
      force: true,
      fetchIcs: stubFetch(body),
    });
    assertEquals(r.bookingsCreated, 0, 'no duplicate');
    assertEquals(r.bookingsLinked, 1, 'orphaned row relinked');

    const { data } = await sb
      .from('guest_submissions')
      .select('external_feed_id')
      .eq('id', created.id)
      .single();
    assertEquals(data?.external_feed_id, feedB.id);
  } finally {
    await cleanupFeed(feedA.id);
    await cleanupFeed(feedB.id);
  }
});

Deno.test(
  'Phase 1b: an imported reservation is relayed to other channels, never to its own',
  async () => {
    const propertyId = await firstPropertyId();
    const airbnb = await seedFeed(propertyId, false, 'airbnb');
    const agoda = await seedFeed(propertyId, false, 'agoda');
    const start = '2027-06-01';
    const end = '2027-06-04';
    const icsStart = '20270601';
    const icsEnd = '20270604';
    try {
      const body = ics([
        vevent(
          'relay-stay-1',
          icsStart,
          icsEnd,
          'Reserved',
          'Reservation URL: https://www.airbnb.com/reservations/details/HMRELAY1'
        ),
      ]);
      const run = await runFeedSync(airbnb, {
        runId: crypto.randomUUID(),
        force: true,
        fetchIcs: stubFetch(body),
      });
      assertEquals(run.status, 'synced');

      const toAgoda = await loadExportRanges(sb, propertyId, 'agoda');
      assertEquals(
        toAgoda.ranges.filter((r) => r.startDate === start && r.endDate === end).length,
        1,
        'the stay blocks Agoda'
      );

      const toAirbnb = await loadExportRanges(sb, propertyId, 'airbnb');
      assertEquals(
        toAirbnb.ranges.filter((r) => r.startDate === start && r.endDate === end).length,
        0,
        'the source channel never gets its own stay back'
      );

      const all = await loadExportRanges(sb, propertyId, null);
      assertEquals(
        all.ranges.filter((r) => r.startDate === start && r.endDate === end).length,
        1,
        'the all-channels link publishes it'
      );
    } finally {
      await cleanupFeed(airbnb.id);
      await cleanupFeed(agoda.id);
    }
  }
);

Deno.test(
  'Phase 1b: a stay already carried by a live booking is relayed once, not twice',
  async () => {
    const propertyId = await firstPropertyId();
    const airbnb = await seedFeed(propertyId, true, 'airbnb');
    const agoda = await seedFeed(propertyId, false, 'agoda');
    const start = '2027-06-10';
    const end = '2027-06-13';
    const icsStart = '20270610';
    const icsEnd = '20270613';
    try {
      const body = ics([
        vevent(
          'relay-dedupe-1',
          icsStart,
          icsEnd,
          'Reserved',
          'Reservation URL: https://www.airbnb.com/reservations/details/HMRELAY2'
        ),
      ]);
      const run = await runFeedSync(airbnb, {
        runId: crypto.randomUUID(),
        force: true,
        fetchIcs: stubFetch(body),
      });
      assertEquals(run.bookingsCreated, 1);

      const toAgoda = await loadExportRanges(sb, propertyId, 'agoda');
      assertEquals(
        toAgoda.ranges.filter((r) => r.startDate === start && r.endDate === end).length,
        1,
        'rule 1 and rule 3 must not publish the same stay twice'
      );
    } finally {
      await cleanupFeed(airbnb.id);
      await cleanupFeed(agoda.id);
    }
  }
);

Deno.test(
  'Phase 1b: a Booking.com echo creates no booking and raises the closed-dates warning',
  async () => {
    const propertyId = await firstPropertyId();
    const feed = await seedFeed(propertyId, true, 'booking_com');
    const first = { start: '2027-07-01', end: '2027-07-04' };
    const second = { start: '2027-07-10', end: '2027-07-12' };
    const hashes = [`itest-${crypto.randomUUID()}`, `itest-${crypto.randomUUID()}`];
    try {
      await sb.from('calendar_export_reads').insert([
        {
          property_id: propertyId,
          channel: 'booking_com',
          ranges_hash: hashes[0],
          ranges: [first],
        },
        {
          property_id: propertyId,
          channel: 'booking_com',
          ranges_hash: hashes[1],
          ranges: [second],
        },
      ]);

      const body = ics([
        vevent('echo-1', '20270701', '20270704', 'CLOSED - Not available'),
        vevent('echo-2', '20270710', '20270712', 'CLOSED - Not available'),
      ]);
      const run = await runFeedSync(feed, {
        runId: crypto.randomUUID(),
        force: true,
        fetchIcs: stubFetch(body),
      });

      assertEquals(run.bookingsCreated, 0, 'an echo must never become a placeholder booking');
      assertEquals((await bookings(feed.id)).length, 0);

      const kept = await blocks(feed.id);
      assertEquals(kept.length, 2, 'echoes still block availability');

      const logged = await events(feed.id);
      assertEquals(
        logged.some(
          (e) =>
            e.action === 'skipped' && (e.detail as { reason?: string })?.reason === 'export_echo'
        ),
        true,
        'the echo is logged for support'
      );

      const row = await feedRow(feed.id);
      assert(row.echo_warning_at, 'two exact matches raise the closed-dates warning');
    } finally {
      await sb.from('calendar_export_reads').delete().in('ranges_hash', hashes);
      await cleanupFeed(feed.id);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Multi-channel hardening (Agoda and Booking.com). Dates are 2027-09 to 2027-12 so they never
// overlap the Airbnb cases above.

async function bookingRows(feedId: string) {
  const { data } = await sb
    .from('guest_submissions')
    .select('id,status,booking_source,external_source,find_us,primary_guest_name,guest_email')
    .eq('external_feed_id', feedId);
  return data ?? [];
}

function rangeCount(
  ranges: Array<{ startDate: string; endDate: string }>,
  start: string,
  end: string
) {
  return ranges.filter((r) => r.startDate === start && r.endDate === end).length;
}

Deno.test('Agoda: a reservation becomes an Agoda booking with channel provenance', async () => {
  const propertyId = await firstPropertyId();
  const feed = await seedFeed(propertyId, true, 'agoda');
  try {
    const run = await runFeedSync(feed, {
      runId: crypto.randomUUID(),
      force: true,
      fetchIcs: stubFetch(ics([vevent('agoda-1', '20270901', '20270904', 'Reserved')])),
    });
    assertEquals(run.bookingsCreated, 1);
    const [row] = await bookingRows(feed.id);
    assertEquals(row.booking_source, 'Agoda');
    assertEquals(row.external_source, 'agoda');
    assertEquals(row.find_us, 'Agoda');
    assertEquals(row.status, 'PENDING_REVIEW');
    assert(String(row.primary_guest_name).toLowerCase().includes('agoda'), 'placeholder names Agoda');
    assert(!row.guest_email, 'no guest email, so no guest-facing side effects');
    const [block] = await blocks(feed.id);
    assertEquals(block.source, 'ical_import');
  } finally {
    await cleanupFeed(feed.id);
  }
});

Deno.test('Booking.com: a real reservation outside served nights becomes a Booking.com booking', async () => {
  const propertyId = await firstPropertyId();
  const feed = await seedFeed(propertyId, true, 'booking_com');
  try {
    const run = await runFeedSync(feed, {
      runId: crypto.randomUUID(),
      force: true,
      fetchIcs: stubFetch(ics([vevent('bcom-1', '20270910', '20270913', 'CLOSED - Not available')])),
    });
    assertEquals(run.bookingsCreated, 1);
    const [row] = await bookingRows(feed.id);
    assertEquals(row.booking_source, 'Booking.com');
    assertEquals(row.external_source, 'booking_com');
    assertEquals(row.find_us, 'Booking.com');
    assertEquals((await feedRow(feed.id)).echo_warning_at, null, 'no echo, no warning');
  } finally {
    await cleanupFeed(feed.id);
  }
});

Deno.test('Booking.com with Create bookings off imports blocks only', async () => {
  const propertyId = await firstPropertyId();
  const feed = await seedFeed(propertyId, false, 'booking_com');
  try {
    const run = await runFeedSync(feed, {
      runId: crypto.randomUUID(),
      force: true,
      fetchIcs: stubFetch(ics([vevent('bcom-off', '20270915', '20270917', 'CLOSED - Not available')])),
    });
    assertEquals(run.bookingsCreated, 0);
    assertEquals((await blocks(feed.id)).length, 1);
    assertEquals((await bookingRows(feed.id)).length, 0);
  } finally {
    await cleanupFeed(feed.id);
  }
});

Deno.test('Relay follows the source: removed and rescheduled stays update the other channels', async () => {
  const propertyId = await firstPropertyId();
  const airbnb = await seedFeed(propertyId, false, 'airbnb');
  try {
    const keep = vevent('relay-keep', '20271001', '20271003', 'Reserved');
    const move = (s: string, e: string) => vevent('relay-move', s, e, 'Reserved');
    await runFeedSync(airbnb, {
      runId: crypto.randomUUID(),
      force: true,
      fetchIcs: stubFetch(ics([keep, move('20271010', '20271013')])),
    });
    let toAgoda = (await loadExportRanges(sb, propertyId, 'agoda')).ranges;
    assertEquals(rangeCount(toAgoda, '2027-10-10', '2027-10-13'), 1);

    // reschedule: the export moves with it
    await runFeedSync(await refetch(airbnb), {
      runId: crypto.randomUUID(),
      force: true,
      fetchIcs: stubFetch(ics([keep, move('20271020', '20271023')])),
    });
    toAgoda = (await loadExportRanges(sb, propertyId, 'agoda')).ranges;
    assertEquals(rangeCount(toAgoda, '2027-10-10', '2027-10-13'), 0, 'old dates freed');
    assertEquals(rangeCount(toAgoda, '2027-10-20', '2027-10-23'), 1, 'new dates held');

    // cancellation: the stay vanishes from the next pull and from the export
    await runFeedSync(await refetch(airbnb), {
      runId: crypto.randomUUID(),
      force: true,
      fetchIcs: stubFetch(ics([keep])),
    });
    toAgoda = (await loadExportRanges(sb, propertyId, 'agoda')).ranges;
    assertEquals(rangeCount(toAgoda, '2027-10-20', '2027-10-23'), 0, 'cancelled stay freed');
    assertEquals(rangeCount(toAgoda, '2027-10-01', '2027-10-03'), 1, 'untouched stay still held');
  } finally {
    await cleanupFeed(airbnb.id);
  }
});

Deno.test('Relay never publishes a channel-side block, only reservations', async () => {
  const propertyId = await firstPropertyId();
  const airbnb = await seedFeed(propertyId, false, 'airbnb');
  try {
    await runFeedSync(airbnb, {
      runId: crypto.randomUUID(),
      force: true,
      fetchIcs: stubFetch(
        ics([
          vevent('blk-1', '20271105', '20271108', 'Airbnb (Not available)'),
          vevent('res-1', '20271110', '20271112', 'Reserved'),
        ])
      ),
    });
    const toBcom = (await loadExportRanges(sb, propertyId, 'booking_com')).ranges;
    assertEquals(rangeCount(toBcom, '2027-11-05', '2027-11-08'), 0, 'host block stays on its channel');
    assertEquals(rangeCount(toBcom, '2027-11-10', '2027-11-12'), 1, 'reservation is relayed');
  } finally {
    await cleanupFeed(airbnb.id);
  }
});

Deno.test('Relay: a one-night stay occupies exactly that night on the other channels', async () => {
  const propertyId = await firstPropertyId();
  const airbnb = await seedFeed(propertyId, false, 'airbnb');
  try {
    await runFeedSync(airbnb, {
      runId: crypto.randomUUID(),
      force: true,
      fetchIcs: stubFetch(ics([vevent('one-night', '20271115', '20271116', 'Reserved')])),
    });
    const toAgoda = (await loadExportRanges(sb, propertyId, 'agoda')).ranges;
    assertEquals(rangeCount(toAgoda, '2027-11-15', '2027-11-16'), 1);
  } finally {
    await cleanupFeed(airbnb.id);
  }
});

Deno.test('Removing one channel keeps the relay from the others intact', async () => {
  const propertyId = await firstPropertyId();
  const airbnb = await seedFeed(propertyId, false, 'airbnb');
  const agoda = await seedFeed(propertyId, false, 'agoda');
  try {
    await runFeedSync(airbnb, {
      runId: crypto.randomUUID(),
      force: true,
      fetchIcs: stubFetch(ics([vevent('stay-air', '20271120', '20271123', 'Reserved')])),
    });
    await runFeedSync(agoda, {
      runId: crypto.randomUUID(),
      force: true,
      fetchIcs: stubFetch(ics([vevent('stay-ago', '20271125', '20271128', 'Reserved')])),
    });
    await cleanupFeed(agoda.id);
    const toBcom = (await loadExportRanges(sb, propertyId, 'booking_com')).ranges;
    assertEquals(rangeCount(toBcom, '2027-11-20', '2027-11-23'), 1, 'Airbnb stay still relayed');
    assertEquals(rangeCount(toBcom, '2027-11-25', '2027-11-28'), 0, 'removed channel stay is gone');
  } finally {
    await cleanupFeed(airbnb.id);
    await cleanupFeed(agoda.id);
  }
});

Deno.test('Echo window: nights served 48 h ago are echoes, 73 h ago are real channel stays', async () => {
  const propertyId = await firstPropertyId();
  const ghost = await seedFeed(propertyId, true, 'booking_com');
  const stale = await seedFeed(propertyId, true, 'booking_com');
  const hashes = [`itest-${crypto.randomUUID()}`, `itest-${crypto.randomUUID()}`];
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
  try {
    await sb.from('calendar_export_reads').insert([
      {
        property_id: propertyId,
        channel: 'booking_com',
        ranges_hash: hashes[0],
        ranges: [{ start: '2027-12-01', end: '2027-12-04' }],
        first_read_at: hoursAgo(48),
        last_read_at: hoursAgo(48),
      },
      {
        property_id: propertyId,
        channel: 'booking_com',
        ranges_hash: hashes[1],
        ranges: [{ start: '2027-12-10', end: '2027-12-13' }],
        first_read_at: hoursAgo(73),
        last_read_at: hoursAgo(73),
      },
    ]);
    const inside = await runFeedSync(ghost, {
      runId: crypto.randomUUID(),
      force: true,
      fetchIcs: stubFetch(ics([vevent('ghost-1', '20271201', '20271204', 'CLOSED - Not available')])),
    });
    assertEquals(inside.bookingsCreated, 0, 'inside 72 h: ghost of a Kame booking, never a booking');

    const outside = await runFeedSync(stale, {
      runId: crypto.randomUUID(),
      force: true,
      fetchIcs: stubFetch(ics([vevent('ghost-2', '20271210', '20271213', 'CLOSED - Not available')])),
    });
    assertEquals(outside.bookingsCreated, 1, 'past 72 h: treated as a real channel stay');
  } finally {
    await sb.from('calendar_export_reads').delete().in('ranges_hash', hashes);
    await cleanupFeed(ghost.id);
    await cleanupFeed(stale.id);
  }
});

Deno.test('A partly covered range is not an echo', async () => {
  const propertyId = await firstPropertyId();
  const feed = await seedFeed(propertyId, true, 'booking_com');
  const hash = `itest-${crypto.randomUUID()}`;
  try {
    await sb.from('calendar_export_reads').insert({
      property_id: propertyId,
      channel: 'booking_com',
      ranges_hash: hash,
      ranges: [{ start: '2027-12-20', end: '2027-12-22' }],
    });
    const run = await runFeedSync(feed, {
      runId: crypto.randomUUID(),
      force: true,
      fetchIcs: stubFetch(ics([vevent('partial-1', '20271220', '20271224', 'CLOSED - Not available')])),
    });
    assertEquals(run.bookingsCreated, 1, 'only part of the stay was ours, so it is a real stay');
  } finally {
    await sb.from('calendar_export_reads').delete().eq('ranges_hash', hash);
    await cleanupFeed(feed.id);
  }
});

Deno.test('Adoption stays inside the feed channel: an Agoda stay is never adopted by an Airbnb feed', async () => {
  const propertyId = await firstPropertyId();
  const agoda = await seedFeed(propertyId, true, 'agoda');
  const airbnb = await seedFeed(propertyId, true, 'airbnb');
  let detachedId: string | null = null;
  try {
    const body = ics([vevent('adopt-x', '20271210', '20271212', 'Reserved')]);
    await runFeedSync(agoda, { runId: crypto.randomUUID(), force: true, fetchIcs: stubFetch(body) });
    const [made] = await bookingRows(agoda.id);
    detachedId = made.id as string;
    // A host-entered Agoda stay: provenance removed, source kept.
    await sb
      .from('guest_submissions')
      .update({ external_source: null, external_uid: null, external_feed_id: null })
      .eq('id', detachedId);

    const air = await runFeedSync(airbnb, {
      runId: crypto.randomUUID(),
      force: true,
      fetchIcs: stubFetch(body),
    });
    assertEquals(air.bookingsLinked, 0, 'Airbnb must not adopt an Agoda row');
    assertEquals(air.bookingsCreated, 1);

    await sb
      .from('property_calendar_feeds')
      .update({ last_feed_hash: null })
      .eq('id', agoda.id);
    const ago = await runFeedSync(await refetch(agoda), {
      runId: crypto.randomUUID(),
      force: true,
      fetchIcs: stubFetch(body),
    });
    assertEquals(ago.bookingsLinked, 1, 'the Agoda feed adopts its own channel row');
  } finally {
    if (detachedId) await sb.from('guest_submissions').delete().eq('id', detachedId);
    await cleanupFeed(airbnb.id);
    await cleanupFeed(agoda.id);
  }
});

Deno.test('Two channels reporting the same nights raise a conflict and keep both stays', async () => {
  const propertyId = await firstPropertyId();
  const airbnb = await seedFeed(propertyId, true, 'airbnb');
  const agoda = await seedFeed(propertyId, true, 'agoda');
  try {
    await runFeedSync(airbnb, {
      runId: crypto.randomUUID(),
      force: true,
      fetchIcs: stubFetch(ics([vevent('dbl-a', '20271215', '20271218', 'Reserved')])),
    });
    const run = await runFeedSync(agoda, {
      runId: crypto.randomUUID(),
      force: true,
      fetchIcs: stubFetch(ics([vevent('dbl-b', '20271216', '20271219', 'Reserved')])),
    });
    assertEquals(run.bookingsCreated, 1, 'both stays are kept, never silently dropped');
    assert(run.conflicts >= 1, 'the overlap is flagged for a human');
    assertEquals((await bookingRows(airbnb.id)).length, 1);
    assertEquals((await bookingRows(agoda.id)).length, 1);
  } finally {
    await cleanupFeed(airbnb.id);
    await cleanupFeed(agoda.id);
  }
});

Deno.test('A feed whose provider is no longer supported is skipped, never run', async () => {
  const propertyId = await firstPropertyId();
  const feed = await seedFeed(propertyId, true, 'airbnb');
  try {
    const run = await runFeedSync(
      { ...feed, provider: 'vrbo' as never },
      { runId: crypto.randomUUID(), force: true, fetchIcs: stubFetch(ics([])) }
    );
    assertEquals(run.status, 'skipped');
    assertEquals(run.ok, true);
    const logged = await events(feed.id);
    assertEquals(
      logged.some((e) => (e.detail as { reason?: string })?.reason === 'unsupported_provider'),
      true
    );
  } finally {
    await cleanupFeed(feed.id);
  }
});
