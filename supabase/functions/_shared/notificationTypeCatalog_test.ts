import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { NOTIFICATION_TYPES } from './notificationService.ts';

/**
 * The DB CHECK constraint drifted behind this union once already: parking cancellation,
 * refund-due and cancellation-request notifications were silently rejected. The migration is
 * the source of truth for the constraint; this test fails when a type is added without it.
 */
Deno.test('every notification type is allowed by the latest catalog migration', async () => {
  const sql = await Deno.readTextFile(
    new URL('../../migrations/20261350000000_notification_type_catalog.sql', import.meta.url)
  );
  const inMigration = new Set([...sql.matchAll(/'([a-z0-9_]+)'/g)].map((match) => match[1]));
  for (const type of NOTIFICATION_TYPES) {
    assert(inMigration.has(type), `notification type "${type}" is missing from the DB catalog`);
  }
  assertEquals(NOTIFICATION_TYPES.length, new Set(NOTIFICATION_TYPES).size);
});
