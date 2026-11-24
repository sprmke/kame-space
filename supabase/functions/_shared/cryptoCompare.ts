/**
 * Constant-time secret comparison (OWASP A04:2025 / A07:2025).
 *
 * Webhook and cron secrets, feed tokens and internal fan-out headers were compared with `===`
 * or a length-first `safeEqual`, which leaks how much of the guess matched and, for the
 * length-first variant, the secret length itself. Both helpers below compare every byte.
 *
 * - {@link constantTimeEqual}: async, hashes both inputs with SHA-256 first. Use in request
 *   handlers where an `await` is free. Hashing defeats the length leak because both digests are
 *   always 32 bytes.
 * - {@link constantTimeEqualSync}: sync, for `verifyCronSecret` and other call sites that cannot
 *   become async without changing every cron wrapper. It burns the same number of iterations for
 *   any pair of inputs.
 */

const encoder = new TextEncoder();

export async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ]);
  const ba = new Uint8Array(ha);
  const bb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < ba.length; i++) {
    diff |= ba[i]! ^ bb[i]!;
  }
  return diff === 0;
}

export function constantTimeEqualSync(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  // Length difference is folded into the accumulator instead of short-circuiting.
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    diff |= ca ^ cb;
  }
  return diff === 0;
}
