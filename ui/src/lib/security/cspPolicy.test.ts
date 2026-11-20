import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { CDN_BASE, MODEL_URL } from '@/features/verification/lib/faceLandmarker';

/**
 * The deployed policy is `ui/vercel.json`. These tests pin it, because a CSP is only as good
 * as the last person who loosened it to make something load (production readiness PR-012).
 * The browser-level contract lives in `ui/e2e/features/security/cspEnforced.spec.ts`.
 */

const VERCEL = resolve(import.meta.dirname, '../../../vercel.json');
type HeaderRule = { source: string; headers: { key: string; value: string }[] };
const config = JSON.parse(readFileSync(VERCEL, 'utf8')) as { headers: HeaderRule[] };

function readCspFromVercelConfig(source: { headers: HeaderRule[] }): string {
  const rule = source.headers.find((entry) => entry.source === '/(.*)')!;
  return rule.headers.find((header) => header.key === 'Content-Security-Policy')!.value;
}

function directives(policy: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const part of policy.split(';')) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) map.set(name, values);
  }
  return map;
}

const policy = directives(readCspFromVercelConfig(config));

describe('deployed Content-Security-Policy', () => {
  it('is enforcing, not report-only', () => {
    const rule = config.headers.find((entry) => entry.source === '/(.*)')!;
    const keys = rule.headers.map((header) => header.key);
    expect(keys).toContain('Content-Security-Policy');
    expect(keys).not.toContain('Content-Security-Policy-Report-Only');
  });

  it('locks down the directives that stop injection', () => {
    expect(policy.get('default-src')).toEqual(["'self'"]);
    expect(policy.get('object-src')).toEqual(["'none'"]);
    expect(policy.get('base-uri')).toEqual(["'self'"]);
    expect(policy.get('form-action')).toEqual(["'self'"]);
    expect(policy.get('frame-ancestors')).toEqual(["'self'"]);
    expect(policy.has('upgrade-insecure-requests')).toBe(true);
  });

  it('never allows inline or eval script, and never a wildcard script source', () => {
    const scripts = policy.get('script-src') ?? [];
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
    expect(scripts).not.toContain('*');
    expect(scripts).not.toContain('https:');
    expect(scripts).not.toContain('data:');
  });

  it('does not open connect, frame or worker sources to every host', () => {
    for (const name of ['connect-src', 'frame-src', 'worker-src', 'default-src']) {
      const values = policy.get(name) ?? [];
      expect(values, name).not.toContain('*');
      expect(values, name).not.toContain('https:');
    }
  });

  it('keeps the two deliberate loosenings explicit', () => {
    // Tailwind, Radix and Konva set style attributes at runtime.
    expect(policy.get('style-src')).toContain("'unsafe-inline'");
    // Listing, avatar and marketing images come from many CDNs; images cannot run code.
    expect(policy.get('img-src')).toContain('https:');
  });

  it('allows the origins the app loads, so an enforcing policy does not break a feature', () => {
    const allows = (directive: string, source: string) =>
      expect(policy.get(directive), `${directive} should allow ${source}`).toContain(source);

    // Signed Supabase Storage PDFs shown in booking and verification preview iframes.
    allows('frame-src', 'https://*.supabase.co');
    allows('frame-src', 'https://challenges.cloudflare.com');
    allows('frame-src', 'https://www.google.com');
    allows('frame-src', 'https://www.openstreetmap.org');
    // The service worker and the Polotno editor fetch Google Fonts CSS and files.
    allows('connect-src', 'https://fonts.googleapis.com');
    allows('connect-src', 'https://fonts.gstatic.com');
    allows('connect-src', 'https://*.supabase.co');
    allows('connect-src', 'wss://*.supabase.co');
    allows('connect-src', 'https://us.i.posthog.com');
    allows('script-src', 'https://challenges.cloudflare.com');
    allows('script-src', 'https://maps.googleapis.com');
    allows('worker-src', 'blob:');
    allows('font-src', 'https://fonts.gstatic.com');
    allows('style-src', 'https://fonts.googleapis.com');
  });
});

describe('MediaPipe liveness assets under the policy', () => {
  /** A source expression with a path matches every URL that starts with it. */
  const allowedBy = (directive: string, url: string) =>
    (policy.get(directive) ?? []).some((source) => {
      if (!source.startsWith('https://')) return false;
      return source.endsWith('/') ? url.startsWith(source) : url === source;
    });

  it('allows the pinned bundle, wasm and model, so liveness is not silently skipped', () => {
    expect(allowedBy('script-src', `${CDN_BASE}/vision_bundle.mjs`)).toBe(true);
    expect(allowedBy('script-src', `${CDN_BASE}/wasm/vision_wasm_internal.js`)).toBe(true);
    expect(allowedBy('connect-src', `${CDN_BASE}/wasm/vision_wasm_internal.wasm`)).toBe(true);
    expect(allowedBy('connect-src', MODEL_URL)).toBe(true);
    // WebAssembly compilation needs this; it does not permit eval of strings.
    expect(policy.get('script-src')).toContain("'wasm-unsafe-eval'");
  });

  it('never opens the whole CDN, only the pinned package path', () => {
    for (const name of ['script-src', 'connect-src']) {
      const sources = policy.get(name) ?? [];
      expect(sources, name).not.toContain('https://cdn.jsdelivr.net');
      expect(sources, name).not.toContain('https://storage.googleapis.com');
    }
    expect(allowedBy('script-src', 'https://cdn.jsdelivr.net/npm/evil-package@1.0.0/x.js')).toBe(
      false
    );
    expect(
      allowedBy('script-src', 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@9.9.9/x.js')
    ).toBe(false);
  });
});

describe('deployed Permissions-Policy', () => {
  it('lets the app use the camera for live ID capture and the microphone for voice', () => {
    const rule = config.headers.find((entry) => entry.source === '/(.*)')!;
    const value = rule.headers.find((header) => header.key === 'Permissions-Policy')!.value;
    expect(value).toContain('camera=(self)');
    expect(value).toContain('microphone=(self)');
    expect(value).toContain('payment=()');
  });
});
