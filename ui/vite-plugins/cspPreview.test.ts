import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildPreviewPolicy,
  readCspFromVercelConfig,
  readOtherSecurityHeaders,
} from './cspPreview';

function directives(policy: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const part of policy.split(';')) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) map.set(name, values);
  }
  return map;
}

const vercel = JSON.parse(readFileSync(resolve(__dirname, '../vercel.json'), 'utf8'));

describe('csp preview harness', () => {
  it('adds the local Supabase origin and a report endpoint, and nothing else', () => {
    const base = "default-src 'self'; connect-src 'self' https://a.example; img-src https:";
    const built = directives(
      buildPreviewPolicy(base, { 'connect-src': ['http://127.0.0.1:54321'] }, '/__r')
    );
    expect(built.get('connect-src')).toEqual([
      "'self'",
      'https://a.example',
      'http://127.0.0.1:54321',
    ]);
    expect(built.get('img-src')).toEqual(['https:']);
    expect(built.get('report-uri')).toEqual(['/__r']);
  });

  it('replaces an existing report-uri instead of duplicating it', () => {
    const built = buildPreviewPolicy("default-src 'self'; report-uri /old", {}, '/new');
    expect(built.match(/report-uri/g)).toHaveLength(1);
    expect(built).toContain('report-uri /new');
  });

  it('reads the real policy from vercel.json, enforcing or report-only', () => {
    expect(readCspFromVercelConfig(vercel)).toContain("default-src 'self'");
    expect(
      readCspFromVercelConfig({
        headers: [
          {
            source: '/(.*)',
            headers: [{ key: 'Content-Security-Policy-Report-Only', value: "default-src 'none'" }],
          },
        ],
      })
    ).toBe("default-src 'none'");
    expect(() => readCspFromVercelConfig({ headers: [] })).toThrow();
  });

  it('serves the same non-policy security headers the deploy sends, minus HSTS', () => {
    const names = readOtherSecurityHeaders(vercel).map(([key]) => key);
    expect(names).toContain('Permissions-Policy');
    expect(names).toContain('X-Frame-Options');
    expect(names).not.toContain('Strict-Transport-Security');
    expect(names).not.toContain('Content-Security-Policy');
  });
});
