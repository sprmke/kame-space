/**
 * `get-session-context` composition contract.
 *
 * The guards read the query keys this payload seeds, so the branch rules and the shape are
 * what must not drift. Loaders are stubbed: this asserts composition, not the database.
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { buildSessionContext } from '../../_shared/sessionContext.ts';

type Calls = { organizations: number; properties: string[]; scoped: string[] };

function stubLoaders(overrides?: { scoped?: unknown; organizationsThrows?: boolean }): {
  loaders: Parameters<typeof buildSessionContext>[1];
  calls: Calls;
} {
  const calls: Calls = { organizations: 0, properties: [], scoped: [] };

  const loaders = {
    organizations: async () => {
      calls.organizations += 1;
      if (overrides?.organizationsThrows) throw new Error('boom');
      return { isSuperAdmin: false, organizations: [{ slug: 'acme' }] };
    },
    properties: async (orgSlug: string) => {
      calls.properties.push(orgSlug);
      return { properties: [{ slug: 'one' }] };
    },
    propertyScoped: async (orgSlug: string, propertySlug: string) => {
      calls.scoped.push(`${orgSlug}/${propertySlug}`);
      return overrides?.scoped !== undefined
        ? (overrides.scoped as { propertyAccess?: unknown; entitlements?: unknown } | null)
        : { propertyAccess: { accessKind: 'owner' }, entitlements: { planName: 'Free' } };
    },
  };

  return { loaders, calls };
}

Deno.test('no org slug: organizations only, nothing else is fetched', async () => {
  const { loaders, calls } = stubLoaders();
  const payload = await buildSessionContext({}, loaders);

  assertEquals(Object.keys(payload), ['organizations']);
  assertEquals(calls.organizations, 1);
  assertEquals(calls.properties, []);
  assertEquals(calls.scoped, []);
});

Deno.test('org only: organizations plus that org properties, no property scoped read', async () => {
  const { loaders, calls } = stubLoaders();
  const payload = await buildSessionContext({ orgSlug: 'acme' }, loaders);

  assertEquals(Object.keys(payload).sort(), [
    'entitlements',
    'organizations',
    'properties',
    'propertyAccess',
  ]);
  // Explicit nulls, so the client has one stable shape to read on every scope.
  assertEquals(payload.propertyAccess, null);
  assertEquals(payload.entitlements, null);
  assertEquals(calls.properties, ['acme']);
  assertEquals(calls.scoped, []);
});

Deno.test('org plus property: adds access and entitlements', async () => {
  const { loaders, calls } = stubLoaders();
  const payload = await buildSessionContext({ orgSlug: 'acme', propertySlug: 'one' }, loaders);

  assertEquals(calls.scoped, ['acme/one']);
  assertEquals(payload.propertyAccess, { accessKind: 'owner' });
  assertEquals(payload.entitlements, { planName: 'Free' });
});

Deno.test('a property read that returns null still yields an organizations payload', async () => {
  const { loaders } = stubLoaders({ scoped: null });
  const payload = await buildSessionContext({ orgSlug: 'acme', propertySlug: 'missing' }, loaders);

  // The guards fall back to their own endpoints; the shell must still get a usable payload.
  assertEquals(Boolean(payload.organizations), true);
  assertEquals(payload.propertyAccess, null);
  assertEquals(payload.entitlements, null);
});

Deno.test('slugs are trimmed, and blank treated as absent', async () => {
  const { loaders, calls } = stubLoaders();
  await buildSessionContext({ orgSlug: '  acme  ', propertySlug: '   ' }, loaders);

  assertEquals(calls.properties, ['acme']);
  assertEquals(calls.scoped, []);
});

Deno.test('the independent reads run together, not in sequence', async () => {
  const order: string[] = [];
  const loaders = {
    organizations: async () => {
      order.push('orgs:start');
      await new Promise((resolve) => setTimeout(resolve, 20));
      order.push('orgs:end');
      return {};
    },
    properties: async () => {
      order.push('props:start');
      await new Promise((resolve) => setTimeout(resolve, 20));
      order.push('props:end');
      return {};
    },
    propertyScoped: async () => {
      order.push('scoped:start');
      await new Promise((resolve) => setTimeout(resolve, 20));
      order.push('scoped:end');
      return { propertyAccess: null, entitlements: null };
    },
  };

  await buildSessionContext({ orgSlug: 'acme', propertySlug: 'one' }, loaders);

  // All three must start before any finishes: that is the whole point of the bootstrap.
  const firstEnd = order.findIndex((entry) => entry.endsWith(':end'));
  const starts = order.filter((entry) => entry.endsWith(':start')).length;
  assertEquals(starts, 3);
  assertEquals(
    order.slice(0, 3).every((entry) => entry.endsWith(':start')),
    true
  );
  assertEquals(firstEnd >= 3, true);
});

Deno.test(
  'a failing organizations loader rejects instead of returning a half payload',
  async () => {
    const { loaders } = stubLoaders({ organizationsThrows: true });
    let threw = false;
    try {
      await buildSessionContext({ orgSlug: 'acme' }, loaders);
    } catch {
      threw = true;
    }
    // The handler's wrapper turns this into a 5xx, and the client falls back to the guards.
    assertEquals(threw, true);
  }
);
