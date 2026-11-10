/**
 * Guards the `list-organizations` response contract.
 *
 * The handler moved from seven PostgREST round trips to one RPC. The shape is the thing
 * that must not drift, because `RequireOrgContext`, tenant switchers and the org hub all
 * read it.
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import { toOrganizationPayload } from './listOrganizations.ts';

const row = {
  id: 'org-1',
  owner_id: 'user-1',
  name: 'Kame Test Tenant',
  slug: 'kame-test-tenant',
  description: null,
  logo_url: null,
  settings: null,
  host_modes: null,
  created_at: '2026-11-08T00:00:00+00:00',
  updated_at: '2026-11-08T00:00:00+00:00',
  access_kind: 'owner' as const,
  plan_limited: false,
};

Deno.test('toOrganizationPayload: always exposes accessKind and planLimited', () => {
  const [payload] = toOrganizationPayload([row]);

  assertEquals(payload.accessKind, 'owner');
  assertEquals(payload.planLimited, false);
  assertEquals(payload.id, 'org-1');
  assertEquals(payload.slug, 'kame-test-tenant');
  assertEquals(payload.createdAt, '2026-11-08T00:00:00+00:00');
});

Deno.test('toOrganizationPayload: null settings and host_modes become safe defaults', () => {
  const [payload] = toOrganizationPayload([row]);

  assertEquals(payload.settings, {});
  assertEquals(payload.hostModes, []);
});

Deno.test('toOrganizationPayload: keeps planLimited true when the org is plan limited', () => {
  const [payload] = toOrganizationPayload([
    { ...row, access_kind: 'property_member', plan_limited: true },
  ]);

  assertEquals(payload.accessKind, 'property_member');
  assertEquals(payload.planLimited, true);
});

Deno.test('toOrganizationPayload: preserves order supplied by the RPC', () => {
  const payload = toOrganizationPayload([
    { ...row, id: 'a', name: 'Alpha' },
    { ...row, id: 'b', name: 'Bravo' },
  ]);

  assertEquals(
    payload.map((org) => org.name),
    ['Alpha', 'Bravo']
  );
});
