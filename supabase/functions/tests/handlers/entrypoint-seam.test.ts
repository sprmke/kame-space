import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * Every edge entrypoint must be importable by a test.
 *
 * Fifteen used to `import { serve }` directly, so importing one booted an HTTP server and no
 * handler test was possible. They now go through `serveHandler`, which mounts the handler in
 * test mode and calls the same `serve(handler)` in production.
 *
 * This test imports all of them: a regression back to a bare `serve()` throws here (a port
 * bind or a hung server) rather than silently removing the ability to test a money path.
 */

Deno.env.set('EDGE_HANDLER_TEST', '1');
Deno.env.set('SUPABASE_URL', 'http://127.0.0.1:54321');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
Deno.env.set('SUPABASE_ANON_KEY', 'test-anon-key');

const ENTRYPOINTS = [
  'calendar-sync-cron',
  'ical-export',
  'meta-inbox-oauth-callback',
  'sd-refund-cron',
  'submit-form',
  'submit-form-completion',
  'submit-sd-form',
  'superhost-assessment-cron',
  'upload-app-settings-asset',
  'upload-development-media',
  'upload-org-settings-asset',
  'upload-parking-media',
  'upload-parking-settings-asset',
  'upload-property-media',
  'upload-property-template-asset',
] as const;

const { getMountedEdgeHandler } = await import('../../_shared/serveEdge.ts');

for (const name of ENTRYPOINTS) {
  Deno.test(`${name} mounts a handler instead of starting a server`, async () => {
    await import(`../../${name}/index.ts`);
    assert(
      getMountedEdgeHandler(name),
      `${name} must mount through serveHandler, not a bare serve()`
    );
  });
}

Deno.test('importing an entrypoint never serves on a real port in test mode', async () => {
  // A bare `serve()` would already have bound the default port by now and the imports above
  // would have failed or hung. Reaching here with every handler mounted is the proof.
  assertEquals(ENTRYPOINTS.every((name) => getMountedEdgeHandler(name) !== null), true);
});
