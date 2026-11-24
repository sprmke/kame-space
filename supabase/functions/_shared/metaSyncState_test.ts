import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { deriveMetaImportState, META_IMPORT_MAX_MS } from './metaSyncState.ts';

const NOW = Date.UTC(2026, 10, 24, 12, 0, 0);

Deno.test('deriveMetaImportState reports a fresh connect as importing', () => {
  assertEquals(deriveMetaImportState({ stateRow: null, conversationCount: 0, now: NOW }), {
    importComplete: false,
    importRunning: true,
  });
});

Deno.test('deriveMetaImportState treats a pre-state inbox with conversations as complete', () => {
  assertEquals(deriveMetaImportState({ stateRow: null, conversationCount: 6, now: NOW }), {
    importComplete: true,
    importRunning: false,
  });
});

Deno.test('deriveMetaImportState respects a recorded completion', () => {
  assertEquals(
    deriveMetaImportState({
      stateRow: { import_completed_at: new Date(NOW - 1000).toISOString() },
      conversationCount: 0,
      now: NOW,
    }),
    { importComplete: true, importRunning: false }
  );
});

Deno.test('deriveMetaImportState keeps a recent unfinished import running', () => {
  assertEquals(
    deriveMetaImportState({
      stateRow: { import_completed_at: null, created_at: new Date(NOW - 60_000).toISOString() },
      conversationCount: 2,
      now: NOW,
    }),
    { importComplete: false, importRunning: true }
  );
});

Deno.test('deriveMetaImportState stops reporting a stuck import as in progress', () => {
  assertEquals(
    deriveMetaImportState({
      stateRow: {
        import_completed_at: null,
        created_at: new Date(NOW - META_IMPORT_MAX_MS - 60_000).toISOString(),
      },
      conversationCount: 2,
      now: NOW,
    }),
    { importComplete: true, importRunning: false }
  );
});

Deno.test('deriveMetaImportState tolerates a row without timestamps', () => {
  assertEquals(
    deriveMetaImportState({ stateRow: { import_completed_at: null }, conversationCount: 0, now: NOW }),
    { importComplete: false, importRunning: true }
  );
});
