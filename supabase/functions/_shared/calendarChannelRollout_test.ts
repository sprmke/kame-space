import { assertEquals } from 'jsr:@std/assert@1';

import { connectableProvidersFor, isProviderConnectable } from './calendarChannelRollout.ts';

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';

Deno.test('rollout: no env keeps production Airbnb-only', () => {
  assertEquals(connectableProvidersFor(ORG_A, {}), ['airbnb']);
  assertEquals(connectableProvidersFor(null, { enabled: '' }), ['airbnb']);
});

Deno.test('rollout: enabled list opens listed channels for everyone', () => {
  assertEquals(connectableProvidersFor(ORG_A, { enabled: 'agoda' }), ['airbnb', 'agoda']);
  assertEquals(connectableProvidersFor(ORG_B, { enabled: ' Agoda , booking_com ' }), [
    'airbnb',
    'agoda',
    'booking_com',
  ]);
});

Deno.test('rollout: beta org list limits the new channels to named orgs', () => {
  const env = { enabled: 'agoda', betaOrgIds: ORG_A };
  assertEquals(connectableProvidersFor(ORG_A, env), ['airbnb', 'agoda']);
  assertEquals(connectableProvidersFor(ORG_B, env), ['airbnb']);
  assertEquals(connectableProvidersFor(null, env), ['airbnb']);
});

Deno.test('rollout: org ids match case-insensitively', () => {
  assertEquals(
    connectableProvidersFor(ORG_A.toUpperCase(), { enabled: 'agoda', betaOrgIds: ORG_A }),
    ['airbnb', 'agoda']
  );
});

Deno.test('rollout: unknown and ineligible providers fail closed', () => {
  assertEquals(connectableProvidersFor(ORG_A, { enabled: 'expedia,other,airbnb' }), ['airbnb']);
});

Deno.test('rollout: isProviderConnectable follows the same rules', () => {
  assertEquals(isProviderConnectable('agoda', ORG_A, {}), false);
  assertEquals(isProviderConnectable('agoda', ORG_A, { enabled: 'agoda' }), true);
  assertEquals(isProviderConnectable('booking_com', ORG_A, { enabled: 'agoda' }), false);
});
