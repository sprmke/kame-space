import { assertEquals } from 'jsr:@std/assert@1';

import { cachedPublicListingRead } from './publicCachedRead.ts';
import { __resetListingCacheForTests, listingCacheKey } from './publicListingCache.ts';
import { resetPlatformSettingsCacheForTests } from './platformSettingsCache.ts';
import { resetInMemoryRateLimitForTests } from './rateLimit.ts';

/**
 * The service client keeps the `fetch` it was created with, so one stub is installed for the
 * whole file and each test changes what the counter RPC answers.
 */
const backend = { bumps: 0, bumpAnswer: '1' };
globalThis.fetch = ((input: RequestInfo | URL) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.includes('bump_rate_limit')) {
    backend.bumps += 1;
    return Promise.resolve(new Response(backend.bumpAnswer, { status: 200 }));
  }
  return Promise.resolve(new Response('[]', { status: 200 }));
}) as typeof fetch;

Deno.env.set('SUPABASE_URL', 'https://edge.test');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-key');

function reset(bumpAnswer = '1') {
  backend.bumps = 0;
  backend.bumpAnswer = bumpAnswer;
  __resetListingCacheForTests(() => Promise.resolve({ property: 1, development: 1, parking: 1 }));
  resetPlatformSettingsCacheForTests();
  resetInMemoryRateLimitForTests();
}

const req = (ip = '1.1.1.1') =>
  new Request('https://edge.test/fn', { headers: { 'x-forwarded-for': ip } });

Deno.test('a miss pays one durable write, a hit pays none', async () => {
  reset();
  const key = listingCacheKey('t', { a: 1 });
  let computes = 0;
  const compute = () => Promise.resolve({ n: ++computes });
  const options = { families: ['property' as const] };

  assertEquals(await cachedPublicListingRead(req(), 'fn', key, options, compute), {
    value: { n: 1 },
  });
  assertEquals(backend.bumps, 1);

  for (let i = 0; i < 5; i++) {
    assertEquals(await cachedPublicListingRead(req(), 'fn', key, options, compute), {
      value: { n: 1 },
    });
  }
  assertEquals(backend.bumps, 1);
  assertEquals(computes, 1);
});

Deno.test('a bypassed read never caches and is metered durably every time', async () => {
  reset();
  const key = listingCacheKey('t', { dates: true });
  let computes = 0;
  const compute = () => Promise.resolve(++computes);
  const options = { families: ['property' as const], bypass: true };
  await cachedPublicListingRead(req(), 'fn', key, options, compute);
  await cachedPublicListingRead(req(), 'fn', key, options, compute);
  assertEquals(backend.bumps, 2);
  assertEquals(computes, 2);
});

Deno.test('hits are still rate limited per identity, with a CORS 429 and Retry-After', async () => {
  reset();
  const key = listingCacheKey('t', { burst: 1 });
  const options = { families: ['property' as const] };
  const compute = () => Promise.resolve('x');
  await cachedPublicListingRead(req('2.2.2.2'), 'fn', key, options, compute);

  let limited: Response | null = null;
  for (let i = 0; i < 200 && !limited; i++) {
    const result = await cachedPublicListingRead(req('2.2.2.2'), 'fn', key, options, compute);
    if ('limited' in result) limited = result.limited;
  }
  assertEquals(limited?.status, 429);
  assertEquals(Number(limited?.headers.get('Retry-After')) >= 1, true);
  assertEquals((await limited!.json()).rateLimited, true);
  assertEquals(backend.bumps, 1);

  // Another visitor is unaffected.
  assertEquals(await cachedPublicListingRead(req('3.3.3.3'), 'fn', key, options, compute), {
    value: 'x',
  });
});

Deno.test('a miss over the durable limit is refused before any compute', async () => {
  reset('9999');
  let computes = 0;
  const result = await cachedPublicListingRead(
    req(),
    'fn',
    listingCacheKey('t', { over: 1 }),
    { families: ['property'] },
    () => Promise.resolve(++computes)
  );
  assertEquals('limited' in result && result.limited.status, 429);
  assertEquals(computes, 0);
});
