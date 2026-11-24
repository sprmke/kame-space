/**
 * SSRF guard for user-supplied (or untrusted) outbound HTTP(S) URLs.
 * Shared by marketing remote-audio import, generated-video download, email QR/inline image
 * fetches and pet/GAF signature downloads.
 * Calendar iCal fetch keeps its own hop/allowlist logic in calendarSyncService.ts
 * (provider host allowlists + webcal://) but uses the same private-IP rules.
 *
 * Production-readiness doc 22 Phase 22.5.
 */

export class UnsafeOutboundUrlError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'UnsafeOutboundUrlError';
    this.code = code;
  }
}

/** Parse a dotted-quad IPv4 literal; null when the value is not a valid literal. */
function parseIpv4(host: string): [number, number, number, number] | null {
  const parts = host.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : NaN));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return nums as [number, number, number, number];
}

function isPrivateIpv4(host: string): boolean {
  const parsed = parseIpv4(host);
  if (!parsed) return false;
  const [a, b] = parsed;
  if (a === 0 || a === 10 || a === 127) return true; // this-network / RFC1918 / loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 169 && b === 254) return true; // link-local (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a >= 224) return true; // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved + broadcast
  return false;
}

export function isPrivateIpLiteral(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '');
  if (parseIpv4(h)) return isPrivateIpv4(h);
  if (h.includes(':')) {
    const lower = h.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (/^fe[89ab]/.test(lower)) return true; // fe80::/10 link-local
    if (/^f[cd]/.test(lower)) return true; // fc00::/7 unique-local
    if (/^ff/.test(lower)) return true; // ff00::/8 multicast
    const mapped = /::ffff:(\d{1,3}(\.\d{1,3}){3})$/.exec(lower);
    if (mapped) return isPrivateIpv4(mapped[1]);
  }
  return false;
}

/**
 * How to treat a hostname whose DNS records cannot be resolved.
 *
 * - `best-effort` (default): keep the literal/hostname checks and let `fetch` fail naturally.
 *   Used by marketing audio import where a blurry DNS answer must not block a legitimate host.
 * - `fail-closed`: refuse the URL when the host cannot be resolved. Used by QR/inline-image
 *   fetches where a DNS-rebinding attempt must not be able to reach a private address.
 */
export type DnsPolicy = 'best-effort' | 'fail-closed';

export type AssertPublicHttpUrlOptions = {
  /** Default false — marketing audio historically allowed http://. */
  httpsOnly?: boolean;
  /** Default `best-effort`. */
  dnsPolicy?: DnsPolicy;
};

/**
 * Shape + private-host checks. Does not fetch. DNS is best-effort unless `dnsPolicy` is
 * `fail-closed`; literal + hostname checks always run.
 */
export async function assertPublicHttpUrl(
  raw: string,
  options: AssertPublicHttpUrlOptions = {}
): Promise<URL> {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new UnsafeOutboundUrlError('Enter a valid URL', 'bad_url');
  }

  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    throw new UnsafeOutboundUrlError('Enter a valid URL', 'bad_url');
  }

  if (options.httpsOnly) {
    if (u.protocol !== 'https:') {
      throw new UnsafeOutboundUrlError('URL must start with https://', 'not_https');
    }
  } else if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    throw new UnsafeOutboundUrlError('URL must start with http:// or https://', 'not_http');
  }

  if (u.username || u.password) {
    throw new UnsafeOutboundUrlError('URL must not contain credentials', 'has_credentials');
  }

  await assertHostNotPrivate(u.hostname, options.dnsPolicy ?? 'best-effort');
  return u;
}

async function assertHostNotPrivate(
  host: string,
  dnsPolicy: DnsPolicy = 'best-effort'
): Promise<void> {
  if (isPrivateIpLiteral(host)) {
    throw new UnsafeOutboundUrlError(`That host is not allowed`, 'private_host');
  }
  const bare = host.toLowerCase();
  if (
    bare === 'localhost' ||
    bare.endsWith('.localhost') ||
    bare.endsWith('.internal') ||
    bare.endsWith('.local')
  ) {
    throw new UnsafeOutboundUrlError('That host is not allowed', 'private_host');
  }

  const [a, aaaa] = await Promise.allSettled([
    Deno.resolveDns(host, 'A'),
    Deno.resolveDns(host, 'AAAA'),
  ]);
  const addrs = [
    ...(a.status === 'fulfilled' ? a.value : []),
    ...(aaaa.status === 'fulfilled' ? aaaa.value : []),
  ];

  if (dnsPolicy === 'fail-closed' && addrs.length === 0) {
    // Both lookups failed or returned nothing: we cannot prove the host is public.
    throw new UnsafeOutboundUrlError('That host is not allowed', 'dns_unverified');
  }

  for (const addr of addrs) {
    if (isPrivateIpLiteral(addr)) {
      throw new UnsafeOutboundUrlError('That host is not allowed', 'private_host');
    }
  }
}

export type FetchPublicHttpOptions = AssertPublicHttpUrlOptions & {
  maxHops?: number;
  timeoutMs?: number;
};

/**
 * Fetch a URL with hop-by-hop revalidation. Never uses `redirect: 'follow'`
 * so a public host cannot bounce us onto a private address.
 */
export async function fetchPublicHttp(
  raw: string,
  init: RequestInit = {},
  options: FetchPublicHttpOptions = {}
): Promise<Response> {
  const maxHops = options.maxHops ?? 4;
  const timeoutMs = options.timeoutMs ?? 15_000;
  let current = await assertPublicHttpUrl(raw, options);

  for (let hop = 0; hop < maxHops; hop++) {
    const signal = init.signal ?? AbortSignal.timeout(timeoutMs);
    const res = await fetch(current.toString(), {
      ...init,
      redirect: 'manual',
      signal,
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) {
        throw new UnsafeOutboundUrlError('Redirect missing Location', 'bad_redirect');
      }
      current = await assertPublicHttpUrl(new URL(location, current).toString(), options);
      continue;
    }

    return res;
  }

  throw new UnsafeOutboundUrlError('Too many redirects', 'too_many_redirects');
}

/**
 * Fetch a URL that may point at our own Supabase project (public storage asset)
 * or at a third party. First-party origins are trusted as-is — they are often
 * `http://127.0.0.1:54321` locally, which the private-host rules intentionally
 * reject — everything else goes through {@link fetchPublicHttp}.
 */
export async function fetchFirstPartyOrPublic(
  raw: string,
  firstPartyOrigins: string[],
  init: RequestInit = {},
  options: FetchPublicHttpOptions = {}
): Promise<Response> {
  let origin = '';
  try {
    origin = new URL(raw.trim()).origin;
  } catch {
    throw new UnsafeOutboundUrlError('Enter a valid URL', 'bad_url');
  }
  if (firstPartyOrigins.includes(origin)) {
    return await fetch(raw.trim(), { ...init, redirect: 'manual' });
  }
  return await fetchPublicHttp(raw, init, options);
}

/**
 * Read a response body with a hard byte ceiling. Screenshots, QR codes, inline email images
 * and downloaded audio all come from hosts we do not control, so an unbounded
 * `arrayBuffer()` is a memory-exhaustion vector (OWASP A10 / resource exhaustion).
 */
export async function readResponseBytesBounded(
  res: Response,
  maxBytes: number
): Promise<Uint8Array> {
  const declared = Number(res.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new UnsafeOutboundUrlError('Response too large', 'too_large');
  }
  if (!res.body) return new Uint8Array(0);

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        throw new UnsafeOutboundUrlError('Response too large', 'too_large');
      }
      chunks.push(value);
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* already closed */
    }
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** Origins that belong to this Supabase project (public asset storage). */
export function firstPartySupabaseOrigins(): string[] {
  const raw = (Deno.env.get('SUPABASE_URL') ?? '').trim();
  if (!raw) return [];
  try {
    return [new URL(raw).origin];
  } catch {
    return [];
  }
}
