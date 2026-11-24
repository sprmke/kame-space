/**
 * Keyset paging for `notifications-list`.
 *
 * Two things the old `created_at`-only cursor got wrong:
 *   1. Rows written in one batch share a timestamp, so a page boundary silently
 *      dropped them (`lt(created_at)` skips every other row on the tie).
 *   2. Legacy per-message inbox rows collapse to one row per conversation after
 *      the fetch, so a busy thread could shrink a 20-row page to 1.
 *
 * The cursor is `<created_at>|<id>` (same shape as `list-activity-log`) and the
 * reader may pull extra batches to fill a page. Cross-page inbox repeats are
 * deduped on the client (`collapseInboxNotifications` over the flattened pages),
 * so the cursor can safely point at the last row the page actually consumed.
 */

export const NOTIFICATION_CURSOR_SEPARATOR = '|';

/** Postgres timestamptz in ISO form, as returned by supabase-js. */
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

export type NotificationCursorRow = { id: string; created_at: string };

export type NotificationCursor = {
  id: string;
  createdAt: string;
  /** Legacy cursor from before the composite change: timestamp only. */
  legacy?: boolean;
};

export function encodeNotificationCursor(row: NotificationCursorRow): string {
  return `${row.created_at}${NOTIFICATION_CURSOR_SEPARATOR}${row.id}`;
}

/**
 * Accepts the composite cursor and the legacy timestamp-only one. Returns null
 * for anything unparseable so a bad cursor cannot 500 the feed.
 */
export function decodeNotificationCursor(
  raw: string | null | undefined
): NotificationCursor | null {
  const value = raw?.trim();
  if (!value) return null;

  const separator = value.indexOf(NOTIFICATION_CURSOR_SEPARATOR);
  if (separator === -1) {
    return ISO_RE.test(value) ? { id: '', createdAt: value, legacy: true } : null;
  }

  const createdAt = value.slice(0, separator);
  const id = value.slice(separator + 1).trim();
  if (!ISO_RE.test(createdAt) || !ID_RE.test(id)) return null;
  return { id, createdAt };
}

type InboxRow = {
  type: string;
  conversation_id: string | null;
};

/** One row per inbox conversation (newest first). Booking rows are untouched. */
export function collapseInboxRows<T extends InboxRow>(rows: readonly T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const row of rows) {
    if (row.type === 'inbox_new_message' && row.conversation_id) {
      if (seen.has(row.conversation_id)) continue;
      seen.add(row.conversation_id);
    }
    result.push(row);
  }
  return result;
}

export type NotificationPage<T extends NotificationCursorRow & InboxRow> = {
  /** Collapsed rows, at most `limit`. */
  rows: T[];
  /** Cursor for the next request, or null when the feed is finished. */
  nextCursor: string | null;
  /** Raw rows fetched across batches (for logging and tests). */
  fetched: number;
};

export type FillNotificationPageOptions<T extends NotificationCursorRow & InboxRow> = {
  limit: number;
  /** Fetch up to `limit` raw rows starting after `cursor`. */
  fetch: (cursor: string | null, limit: number) => Promise<T[]>;
  initialCursor?: string | null;
  /** Safety stop: a page never pulls more than this many batches. */
  maxBatches?: number;
};

/**
 * Reads batches until the collapsed page is full, the feed ends, or the batch cap
 * is hit. A page that ends early is still returned: under-filling is better than
 * looping on one very chatty conversation.
 */
export async function fillNotificationPage<T extends NotificationCursorRow & InboxRow>(
  options: FillNotificationPageOptions<T>
): Promise<NotificationPage<T>> {
  const limit = Math.max(1, Math.floor(options.limit));
  const maxBatches = Math.max(1, Math.floor(options.maxBatches ?? 4));

  let cursor = options.initialCursor ?? null;
  let fetched = 0;
  let exhausted = false;
  const collected: T[] = [];

  for (let batch = 0; batch < maxBatches; batch += 1) {
    const rows = await options.fetch(cursor, limit);
    fetched += rows.length;

    if (rows.length === 0) {
      exhausted = true;
      break;
    }

    collected.push(...rows);
    cursor = encodeNotificationCursor(rows[rows.length - 1]!);

    /* A short batch is the last one, so anything collected now is the tail. */
    if (rows.length < limit) {
      exhausted = true;
      break;
    }

    if (collapseInboxRows(collected).length >= limit) break;
  }

  const collapsed = collapseInboxRows(collected);
  const rows = collapsed.slice(0, limit);
  const last = rows[rows.length - 1] ?? null;

  /*
   * Point at the last row the page actually consumed. If the batch cap left
   * collapsed rows on the floor they are re-read next page and deduped client
   * side, which is safer than a cursor that skips them forever.
   */
  const nextCursor =
    !last || (exhausted && collapsed.length <= limit) ? null : encodeNotificationCursor(last);

  return { rows, nextCursor, fetched };
}
