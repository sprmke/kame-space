/**
 * indexnow-submit — tell Bing and Yandex which public URLs changed (SEO-19.5).
 *
 * IndexNow feeds Bing, which feeds ChatGPT search and Copilot, so a published or renamed
 * listing is discoverable in hours instead of weeks. Runs on `pg_cron` + `pg_net`, batched and
 * rate limited by the schedule rather than per-save pings.
 *
 * Auth: cron secret (`X-Indexnow-Cron-Secret`, env `INDEXNOW_CRON_SECRET`).
 * Env: `INDEXNOW_KEY` (also served at `/{key}.txt` by the middleware), optional
 *      `PUBLIC_GUEST_APP_ORIGIN` (defaults to `https://kamespace.com`).
 *
 * Fails open: an IndexNow outage never fails the run or blocks publishing.
 */

import { verifyCronSecret } from '../_shared/cronSecretGate.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { resolvePublicGuestAppOrigin } from '../_shared/publicAppOrigin.ts';
import { serveCronPost } from '../_shared/serveEdge.ts';

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
/** The protocol accepts 10,000 URLs per request; stay well under so payloads stay small. */
const MAX_URLS_PER_REQUEST = 1_000;
const PAGE = 1_000;

const FAMILY_PATH: Record<string, string> = {
  property: 'properties',
  parking: 'parkings',
  development: 'developments',
};

function verifyIndexNowSecret(req: Request): boolean {
  return verifyCronSecret(req, {
    envKey: 'INDEXNOW_CRON_SECRET',
    headerName: 'x-indexnow-cron-secret',
  });
}

/** Every ACTIVE listing URL, plus the static pages that change with them. */
async function collectUrls(origin: string): Promise<string[]> {
  const supabase = createServiceClient();
  const urls = new Set<string>([
    `${origin}/`,
    `${origin}/properties`,
    `${origin}/parkings`,
    `${origin}/developments`,
  ]);

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('public_listing_search')
      .select('family, slug, place_slug')
      .order('family')
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`indexnow read failed: ${error.message}`);

    const rows = data ?? [];
    for (const row of rows) {
      const familyPath = FAMILY_PATH[row.family as string];
      const slug = (row.slug as string | null)?.trim();
      const placeSlug = (row.place_slug as string | null)?.trim();
      if (!familyPath) continue;
      if (slug) urls.add(`${origin}/${familyPath}/${encodeURIComponent(slug)}`);
      if (placeSlug) urls.add(`${origin}/${familyPath}/in/${encodeURIComponent(placeSlug)}`);
    }
    if (rows.length < PAGE) break;
  }

  return [...urls];
}

serveCronPost('indexnow-submit', verifyIndexNowSecret, async () => {
  const key = Deno.env.get('INDEXNOW_KEY')?.trim();
  if (!key) return { skipped: 'indexnow_key_unset' };

  const origin = resolvePublicGuestAppOrigin();
  let urls: string[];
  try {
    urls = await collectUrls(origin);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'collect failed' };
  }

  const batches = Math.ceil(urls.length / MAX_URLS_PER_REQUEST);
  let submitted = 0;
  let failed = 0;

  for (let index = 0; index < batches; index += 1) {
    const slice = urls.slice(index * MAX_URLS_PER_REQUEST, (index + 1) * MAX_URLS_PER_REQUEST);
    try {
      const res = await fetch(INDEXNOW_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          host: new URL(origin).hostname,
          key,
          keyLocation: `${origin}/${key}.txt`,
          urlList: slice,
        }),
      });
      if (res.ok) submitted += slice.length;
      else failed += slice.length;
    } catch {
      failed += slice.length;
    }
  }

  return { ok: failed === 0, urls: urls.length, submitted, failed, batches };
});
