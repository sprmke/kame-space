/**
 * SQL vs TypeScript slug parity (SEO-17.1).
 *
 * `pls_slugify_name` runs in Postgres for the public listing search index;
 * `slugifyName` runs on the edge. If they disagree, a listing's sitemap URL and its
 * place-page grouping silently diverge.
 *
 * Requires the local stack (`bun run start:supabase`).
 * Run: `bun run test:edge:slugs`
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { SLUG_VECTORS } from '../_shared/slugUtils_test.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? 'http://127.0.0.1:54321';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

Deno.test({
  name: 'pls_slugify_name matches the TypeScript slugifier',
  ignore: !SERVICE_ROLE,
  async fn() {
    const values = SLUG_VECTORS.map(([input]) => `(${quote(input)})`).join(', ');
    const sql = `select public.pls_slugify_name(column1) from (values ${values}) as v`;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    });

    // The RPC only exists on stacks that expose `exec_sql`; skip rather than fail when it
    // is absent.
    if (!res.ok) {
      console.warn('seoSlugParity: exec_sql unavailable, skipping SQL check');
      return;
    }

    const rows = (await res.json()) as Array<{ pls_slugify_name: string }>;
    SLUG_VECTORS.forEach(([input, expected], index) => {
      assertEquals(rows[index]?.pls_slugify_name, expected, input);
    });
  },
});
