/**
 * HMAC verification for the ops alert ingest endpoint (PR-027 Phase 1).
 *
 * GitHub Actions probes and the Sentry relay call `ops-alert-ingest` with an
 * `X-Ops-Signature: sha256=<hex>` header over the raw body. Verification never throws.
 */

async function hmacHex(secret: string, rawBody: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyOpsAlertSignature(
  rawBody: string,
  header: string | null | undefined,
  secret: string | null | undefined
): Promise<boolean> {
  if (!secret || !header) return false;
  const provided = header
    .trim()
    .replace(/^sha256=/i, '')
    .toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(provided)) return false;
  try {
    const expected = await hmacHex(secret, rawBody);
    return timingSafeEqual(provided, expected);
  } catch {
    return false;
  }
}

export async function signOpsAlertBody(rawBody: string, secret: string): Promise<string> {
  return `sha256=${await hmacHex(secret, rawBody)}`;
}
