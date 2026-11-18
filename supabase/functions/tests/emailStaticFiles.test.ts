import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/**
 * Email files must ship with the functions that render them.
 *
 * A function that renders a branded mail reads `_shared/email-templates/**` from disk at request
 * time. Those files exist inside the deployed function only when `config.toml` lists them under
 * `static_files`; without the entry the render throws
 *
 *   path not found: .../functions/_shared/email-templates/fragments/email-header-logo.html
 *
 * and the send fails at runtime, in production, on the first real request. Nothing else catches
 * it: the migration is fine, the deploy is green, and a cron keeps calling it.
 *
 * That is exactly how `pre-arrival-reminders` and `pending-review-expiry` shipped in 2026-11: both
 * were scheduled, both were reachable, and neither could render its first email.
 *
 * Scope is deliberately the guest-journey crons rather than "every function that can send mail".
 * A general scan has to follow the import graph, and at three hops it claims thirty functions send
 * branded mail (`accept-org-invite`, `cancel-parking-booking`, …) because they reach a shared
 * service that can render. A guard that fails on real, working functions is worse than none; the
 * full rule stays in AGENTS.md § Edge functions.
 */

const CONFIG = new URL('../../config.toml', import.meta.url);

/** Functions this module owns that render email on a schedule. */
const GUEST_JOURNEY_EMAIL_CRONS = ['pre-arrival-reminders', 'pending-review-expiry'];

async function configBlock(fn: string): Promise<string | null> {
  const config = await Deno.readTextFile(CONFIG);
  const escaped = fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = config.match(new RegExp(`\\[functions\\.${escaped}\\]([\\s\\S]*?)(?=\\n\\[|$)`));
  return match?.[1] ?? null;
}

Deno.test('guest journey email crons ship the template files', async () => {
  const missing: string[] = [];

  for (const fn of GUEST_JOURNEY_EMAIL_CRONS) {
    const block = await configBlock(fn);
    if (!block) {
      missing.push(`${fn} (no [functions.${fn}] entry)`);
      continue;
    }
    if (!block.includes('static_files')) {
      missing.push(`${fn} (no static_files)`);
      continue;
    }
    // A templates-only glob still throws: the header logo is a fragment.
    if (!block.includes('email-templates/*.html')) missing.push(`${fn} (no top-level templates)`);
    if (!block.includes('email-templates/fragments/*.html')) {
      missing.push(`${fn} (no fragments)`);
    }
  }

  assertEquals(
    missing,
    [],
    'Add or fix static_files under [functions.<name>] in supabase/config.toml'
  );
});

Deno.test('every static_files block ships the fragments too', async () => {
  const config = await Deno.readTextFile(CONFIG);
  const blocks = [...config.matchAll(/\[functions\.([a-z0-9-]+)\]([\s\S]*?)(?=\n\[|$)/g)].filter(
    ([, , body]) => body.includes('static_files')
  );
  assert(blocks.length > 0, 'at least one function declares static_files');

  const incomplete = blocks
    .filter(([, , body]) => !body.includes('email-templates/fragments/*.html'))
    .map(([, name]) => name);

  assertEquals(incomplete, [], 'a templates-only glob throws on the first render');
});
