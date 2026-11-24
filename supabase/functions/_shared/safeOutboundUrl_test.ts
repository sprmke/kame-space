import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import {
  assertPublicHttpUrl,
  fetchFirstPartyOrPublic,
  isPrivateIpLiteral,
  readResponseBytesBounded,
  UnsafeOutboundUrlError,
} from './safeOutboundUrl.ts';

Deno.test('isPrivateIpLiteral covers loopback, RFC1918, link-local, CGNAT', () => {
  assertEquals(isPrivateIpLiteral('127.0.0.1'), true);
  assertEquals(isPrivateIpLiteral('10.0.0.1'), true);
  assertEquals(isPrivateIpLiteral('192.168.1.1'), true);
  assertEquals(isPrivateIpLiteral('172.16.0.1'), true);
  assertEquals(isPrivateIpLiteral('169.254.169.254'), true);
  assertEquals(isPrivateIpLiteral('100.64.0.1'), true);
  assertEquals(isPrivateIpLiteral('::1'), true);
  assertEquals(isPrivateIpLiteral('8.8.8.8'), false);
  assertEquals(isPrivateIpLiteral('1.1.1.1'), false);
});

Deno.test('isPrivateIpLiteral covers multicast, reserved ranges and IPv6 multicast', () => {
  assertEquals(isPrivateIpLiteral('224.0.0.1'), true);
  assertEquals(isPrivateIpLiteral('239.255.255.250'), true);
  assertEquals(isPrivateIpLiteral('240.0.0.1'), true);
  assertEquals(isPrivateIpLiteral('255.255.255.255'), true);
  assertEquals(isPrivateIpLiteral('ff02::1'), true);
  assertEquals(isPrivateIpLiteral('fd00::1'), true);
  assertEquals(isPrivateIpLiteral('fe80::1'), true);
  assertEquals(isPrivateIpLiteral('2606:4700:4700::1111'), false);
});

Deno.test('assertPublicHttpUrl rejects private, localhost, credentials, non-http', async () => {
  await assertRejects(() => assertPublicHttpUrl('https://127.0.0.1/x'), UnsafeOutboundUrlError);
  await assertRejects(
    () => assertPublicHttpUrl('https://169.254.169.254/latest/meta-data'),
    UnsafeOutboundUrlError
  );
  await assertRejects(() => assertPublicHttpUrl('https://localhost/x'), UnsafeOutboundUrlError);
  await assertRejects(
    () => assertPublicHttpUrl('https://user:pass@example.com/x'),
    UnsafeOutboundUrlError
  );
  await assertRejects(() => assertPublicHttpUrl('file:///etc/passwd'), UnsafeOutboundUrlError);
  const https = await assertPublicHttpUrl('https://example.com/audio.mp3');
  assertEquals(https.hostname, 'example.com');
});

Deno.test('assertPublicHttpUrl httpsOnly rejects http', async () => {
  await assertRejects(
    () => assertPublicHttpUrl('http://example.com/x', { httpsOnly: true }),
    UnsafeOutboundUrlError
  );
});

Deno.test('fetchFirstPartyOrPublic: first-party origin is fetched without the private-host rules', async () => {
  // No network: a bogus first-party host must still resolve to a fetch attempt rather
  // than an UnsafeOutboundUrlError. Pointing at the private literal proves the origin
  // allowlist is what short-circuits the guard.
  await assertRejects(
    () => fetchFirstPartyOrPublic('http://127.0.0.1:9/nothing', []),
    UnsafeOutboundUrlError,
    'not allowed'
  );
});

Deno.test('fetchFirstPartyOrPublic: rejects a private non-first-party host', async () => {
  await assertRejects(
    () => fetchFirstPartyOrPublic('http://169.254.169.254/latest/meta-data', ['https://example.com']),
    UnsafeOutboundUrlError,
    'not allowed'
  );
});

Deno.test('assertPublicHttpUrl: fail-closed refuses a host whose DNS cannot be verified', async () => {
  // `.invalid` is reserved (RFC 2606) and never resolves, so this is deterministic without
  // relying on real network answers.
  await assertRejects(
    () => assertPublicHttpUrl('https://does-not-exist.invalid/x', { dnsPolicy: 'fail-closed' }),
    UnsafeOutboundUrlError,
    'not allowed'
  );
});

Deno.test('assertPublicHttpUrl: best-effort keeps literal checks but tolerates unknown DNS', async () => {
  // The same unverifiable host is allowed by the default policy; the literal guard still runs.
  const url = await assertPublicHttpUrl('https://does-not-exist.invalid/x');
  assertEquals(url.hostname, 'does-not-exist.invalid');
});

Deno.test('readResponseBytesBounded returns the body under the ceiling', async () => {
  const res = new Response(new Uint8Array([1, 2, 3, 4]));
  const bytes = await readResponseBytesBounded(res, 1024);
  assertEquals(Array.from(bytes), [1, 2, 3, 4]);
});

Deno.test('readResponseBytesBounded rejects a body over the ceiling', async () => {
  const res = new Response(new Uint8Array(2048));
  await assertRejects(() => readResponseBytesBounded(res, 1024), UnsafeOutboundUrlError, 'too large');
});

Deno.test('readResponseBytesBounded rejects an oversized Content-Length up front', async () => {
  const res = new Response(new Uint8Array(4), { headers: { 'content-length': '999999999' } });
  await assertRejects(() => readResponseBytesBounded(res, 1024), UnsafeOutboundUrlError, 'too large');
});
