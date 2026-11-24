/**
 * Meta inbox import state.
 *
 * The pill must not claim an import is running forever. A connection with no
 * `meta_sync_state` row and no conversations is a fresh connect (importing); a connection
 * with conversations but no row was imported before state tracking existed. An import row
 * that has never completed after a day is treated as finished so the status falls through
 * to freshness / reconnect, which the host can actually act on.
 */

export type MetaSyncStateRow = {
  import_completed_at?: string | null;
  created_at?: string | null;
} | null;

export type MetaImportState = {
  importComplete: boolean;
  importRunning: boolean;
};

/** An import older than this is no longer reported as in progress. */
export const META_IMPORT_MAX_MS = 24 * 60 * 60_000;

export function deriveMetaImportState(input: {
  stateRow: MetaSyncStateRow;
  conversationCount: number;
  now?: number;
}): MetaImportState {
  const { stateRow, conversationCount } = input;
  const now = input.now ?? Date.now();

  if (!stateRow) {
    // Nothing to import: this inbox already has conversations from before sync state.
    if (conversationCount > 0) return { importComplete: true, importRunning: false };
    return { importComplete: false, importRunning: true };
  }

  if (stateRow.import_completed_at) return { importComplete: true, importRunning: false };

  const startedAt = stateRow.created_at ? new Date(stateRow.created_at).getTime() : null;
  if (startedAt !== null && now - startedAt > META_IMPORT_MAX_MS) {
    return { importComplete: true, importRunning: false };
  }

  return { importComplete: false, importRunning: true };
}
