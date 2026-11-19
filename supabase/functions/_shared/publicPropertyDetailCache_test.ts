import { assertEquals, assertNotEquals } from 'jsr:@std/assert@1';

import { __resetListingCacheForTests } from './publicListingCache.ts';
import {
  loadPublicPropertyDetailCached,
  peekPublicPropertyDetail,
  propertyDetailCacheKey,
} from './publicPropertyDetailCache.ts';
import type { PublicPropertyDetailDto } from './publicPropertyService.ts';

const loader = () => Promise.resolve({ property: 1, development: 1, parking: 1 });
const detail = (name: string) =>
  ({ id: 'p1', slug: 's', name }) as unknown as PublicPropertyDetailDto;

Deno.test('a loaded detail is served to the next peek without loading again', async () => {
  __resetListingCacheForTests(loader);
  let loads = 0;
  const load = () => {
    loads += 1;
    return Promise.resolve(detail('Unit A'));
  };
  const lookup = { slug: 'unit-a', id: null };
  assertEquals(await peekPublicPropertyDetail(lookup), null);
  const first = await loadPublicPropertyDetailCached(lookup, load);
  assertEquals(await peekPublicPropertyDetail(lookup), first);
  await loadPublicPropertyDetailCached(lookup, load);
  assertEquals(loads, 1);
});

Deno.test('a missing or unpublished listing is never cached', async () => {
  __resetListingCacheForTests(loader);
  const lookup = { slug: 'draft', id: null };
  let live = false;
  const load = () => Promise.resolve(live ? detail('Now live') : null);
  assertEquals(await loadPublicPropertyDetailCached(lookup, load), null);
  assertEquals(await peekPublicPropertyDetail(lookup), null);
  live = true;
  assertEquals((await loadPublicPropertyDetailCached(lookup, load))?.name, 'Now live');
});

Deno.test('different listings never share an entry', async () => {
  __resetListingCacheForTests(loader);
  await loadPublicPropertyDetailCached({ slug: 'a', id: null }, () => Promise.resolve(detail('A')));
  assertEquals(await peekPublicPropertyDetail({ slug: 'b', id: null }), null);
  assertNotEquals(
    propertyDetailCacheKey({ slug: 'a', id: null }),
    propertyDetailCacheKey({ slug: null, id: 'a' })
  );
});

Deno.test('a failing load is not cached and surfaces the error', async () => {
  __resetListingCacheForTests(loader);
  const lookup = { slug: 'boom', id: null };
  let calls = 0;
  const load = () => {
    calls += 1;
    return calls === 1 ? Promise.reject(new Error('db')) : Promise.resolve(detail('ok'));
  };
  await loadPublicPropertyDetailCached(lookup, load).catch(() => undefined);
  assertEquals((await loadPublicPropertyDetailCached(lookup, load))?.name, 'ok');
});
