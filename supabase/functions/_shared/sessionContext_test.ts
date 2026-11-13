import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { buildSessionContext } from './sessionContext.ts';

const loaders = (overrides: Partial<Record<string, unknown>> = {}) => ({
  organizations: async () => ({ organizations: ['org'] }),
  properties: async (slug: string) => ({ properties: [`${slug}-properties`] }),
  propertyScoped: async (org: string, property: string) => ({
    propertyAccess: { propertySlug: property, orgSlug: org },
    entitlements: { planCode: 'free' },
  }),
  orgExtras: async () => ({
    orgAccess: { orgSlug: 'acme' },
    featureAvailability: { serverNow: '2026-11-13T00:00:00.000Z', entries: [] },
    parkings: { parkings: [] },
  }),
  ...overrides,
});

Deno.test('buildSessionContext - org shell, no property, still carries org extras', async () => {
  const payload = await buildSessionContext({ orgSlug: 'acme' }, loaders());
  assertEquals('properties' in payload, true);
  assertEquals(payload.propertyAccess, null);
  assertEquals(payload.entitlements, null);
  assertEquals(payload.orgAccess, { orgSlug: 'acme' });
  assertEquals(payload.parkings, { parkings: [] });
});

Deno.test('buildSessionContext - property scope adds access and entitlements', async () => {
  const payload = await buildSessionContext({ orgSlug: 'acme', propertySlug: 'villa' }, loaders());
  assertEquals(payload.propertyAccess, { propertySlug: 'villa', orgSlug: 'acme' });
  assertEquals(payload.entitlements, { planCode: 'free' });
});

Deno.test('buildSessionContext - no org slug returns organizations only', async () => {
  const payload = await buildSessionContext({}, loaders());
  assertEquals(Object.keys(payload), ['organizations']);
});

Deno.test('buildSessionContext - a loader without extras keeps the old shape', async () => {
  const withoutExtras = loaders({ orgExtras: undefined });
  const payload = await buildSessionContext({ orgSlug: 'acme' }, withoutExtras);
  assertEquals('orgAccess' in payload, false);
  assertEquals('parkings' in payload, false);
});
