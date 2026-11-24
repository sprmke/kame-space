/**
 * Cursor + page-fill rules for the Notifications feed.
 *
 * The two regressions this guards:
 *   - bulk-inserted rows share `created_at`, so a timestamp-only cursor skipped them
 *   - legacy per-message inbox rows collapse after the fetch, so a busy thread could
 *     shrink a full page to one row
 */
import { assertEquals, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  collapseInboxRows,
  decodeNotificationCursor,
  encodeNotificationCursor,
  fillNotificationPage,
} from './notificationsPaging.ts';

type Row = {
  id: string;
  type: string;
  conversation_id: string | null;
  created_at: string;
};

const AT = '2026-11-24T10:00:00.000+00:00';

function row(id: string, overrides: Partial<Row> = {}): Row {
  return {
    id,
    type: 'booking_pending_review',
    conversation_id: null,
    created_at: AT,
    ...overrides,
  };
}

Deno.test('cursor round-trips the timestamp and the id', () => {
  const encoded = encodeNotificationCursor({
    id: '11111111-2222-3333-4444-555555555555',
    created_at: AT,
  });
  const decoded = decodeNotificationCursor(encoded);

  assertEquals(decoded?.id, '11111111-2222-3333-4444-555555555555');
  assertEquals(decoded?.createdAt, AT);
  assertEquals(decoded?.legacy, undefined);
});

Deno.test('cursor rejects junk and accepts the legacy timestamp-only form', () => {
  assertEquals(decodeNotificationCursor(null), null);
  assertEquals(decodeNotificationCursor(''), null);
  assertEquals(decodeNotificationCursor('not-a-cursor'), null);
  assertEquals(decodeNotificationCursor('2026-11-24T10:00:00.000+00:00|'), null);
  assertEquals(decodeNotificationCursor('yesterday|abc'), null);

  assertEquals(decodeNotificationCursor('2026-11-24T10:00:00.000Z'), {
    id: '',
    createdAt: '2026-11-24T10:00:00.000Z',
    legacy: true,
  });
});

Deno.test('collapse keeps one row per inbox conversation and every booking row', () => {
  const rows = [
    row('a', { type: 'inbox_new_message', conversation_id: 'c1' }),
    row('b', { type: 'inbox_new_message', conversation_id: 'c1' }),
    row('c', { type: 'booking_pending_review' }),
    row('d', { type: 'inbox_new_message', conversation_id: 'c2' }),
  ];

  assertEquals(
    collapseInboxRows(rows).map((r) => r.id),
    ['a', 'c', 'd']
  );
});

Deno.test('a full unique batch returns a page and a cursor', async () => {
  const rows = [row('a'), row('b'), row('c')];
  const page = await fillNotificationPage({
    limit: 3,
    fetch: async () => rows,
  });

  assertEquals(
    page.rows.map((r) => r.id),
    ['a', 'b', 'c']
  );
  assertEquals(page.nextCursor, encodeNotificationCursor(rows[2]!));
  assertEquals(page.fetched, 3);
});

Deno.test('a short batch ends the feed', async () => {
  const page = await fillNotificationPage({
    limit: 5,
    fetch: async () => [row('a'), row('b')],
  });

  assertEquals(
    page.rows.map((r) => r.id),
    ['a', 'b']
  );
  assertEquals(page.nextCursor, null);
});

Deno.test('a chatty conversation still fills the page from more batches', async () => {
  const batches: Row[][] = [
    [
      row('m1', { type: 'inbox_new_message', conversation_id: 'c1' }),
      row('m2', { type: 'inbox_new_message', conversation_id: 'c1' }),
      row('m3', { type: 'inbox_new_message', conversation_id: 'c1' }),
    ],
    [row('b1'), row('b2'), row('b3')],
  ];
  let call = 0;
  const page = await fillNotificationPage({
    limit: 3,
    fetch: async () => batches[call++] ?? [],
  });

  assertEquals(
    page.rows.map((r) => r.id),
    ['m1', 'b1', 'b2']
  );
  /* b3 was read but not shown, so the cursor points at the last shown row. */
  assertEquals(page.nextCursor, encodeNotificationCursor(batches[1]![1]!));
  assertEquals(page.fetched, 6);
});

Deno.test('the batch cap returns a cursor instead of dropping rows', async () => {
  const batches: Row[][] = [
    [
      row('m1', { type: 'inbox_new_message', conversation_id: 'c1' }),
      row('m2', { type: 'inbox_new_message', conversation_id: 'c1' }),
      row('m3', { type: 'inbox_new_message', conversation_id: 'c1' }),
    ],
    [
      row('m4', { type: 'inbox_new_message', conversation_id: 'c2' }),
      row('m5', { type: 'inbox_new_message', conversation_id: 'c2' }),
      row('m6', { type: 'inbox_new_message', conversation_id: 'c2' }),
    ],
  ];
  let call = 0;
  const page = await fillNotificationPage({
    limit: 3,
    maxBatches: 2,
    fetch: async () => batches[call++] ?? [],
  });

  /* Under-filled on purpose: better than looping on one thread forever. */
  assertEquals(
    page.rows.map((r) => r.id),
    ['m1', 'm4']
  );
  assertEquals(page.nextCursor, encodeNotificationCursor(batches[1]![0]!));
});

Deno.test('an exhausted feed never hands back a cursor', async () => {
  const page = await fillNotificationPage({
    limit: 3,
    fetch: async () => [row('a'), row('b')],
  });

  assertEquals(
    page.rows.map((r) => r.id),
    ['a', 'b']
  );
  assertEquals(page.nextCursor, null);
});

Deno.test('an empty feed returns no rows and no cursor', async () => {
  const page = await fillNotificationPage({ limit: 20, fetch: async () => [] });
  assertEquals(page.rows, []);
  assertEquals(page.nextCursor, null);
});
