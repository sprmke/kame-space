import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { constantTimeEqual, constantTimeEqualSync } from './cryptoCompare.ts';

Deno.test('constantTimeEqual matches only identical secrets', async () => {
  assertEquals(await constantTimeEqual('shared-secret', 'shared-secret'), true);
  assertEquals(await constantTimeEqual('shared-secret', 'shared-secreT'), false);
  assertEquals(await constantTimeEqual('shared-secret', 'shared-secret '), false);
  assertEquals(await constantTimeEqual('', ''), true);
  assertEquals(await constantTimeEqual('', 'x'), false);
  assertEquals(await constantTimeEqual('x', ''), false);
  // Different lengths must not be treated as a match (the SHA-256 digests differ).
  assertEquals(await constantTimeEqual('secret', 'secret-but-longer'), false);
});

Deno.test('constantTimeEqualSync matches only identical secrets', () => {
  assertEquals(constantTimeEqualSync('shared-secret', 'shared-secret'), true);
  assertEquals(constantTimeEqualSync('shared-secret', 'shared-secreT'), false);
  assertEquals(constantTimeEqualSync('', ''), true);
  assertEquals(constantTimeEqualSync('', 'x'), false);
  assertEquals(constantTimeEqualSync('x', ''), false);
  assertEquals(constantTimeEqualSync('secret', 'secret-but-longer'), false);
  // A prefix match is not a match.
  assertEquals(constantTimeEqualSync('secret', 'sec'), false);
});
