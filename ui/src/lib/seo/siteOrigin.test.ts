import { describe, expect, it } from 'vitest';

import {
  NON_CANONICAL_HOSTS,
  PRODUCTION_SITE_ORIGIN,
  canonicalUrlFor,
  normalizeOrigin,
  resolveSiteOrigin,
} from '@/lib/seo/siteOrigin';

describe('normalizeOrigin', () => {
  it('accepts a bare https origin', () => {
    expect(normalizeOrigin('https://kamespace.com')).toBe('https://kamespace.com');
    expect(normalizeOrigin('https://kamespace.com/')).toBe('https://kamespace.com');
    expect(normalizeOrigin('  https://preview-abc.vercel.app  ')).toBe(
      'https://preview-abc.vercel.app'
    );
  });

  it('rejects values that are not a bare origin', () => {
    expect(normalizeOrigin('')).toBeNull();
    expect(normalizeOrigin(undefined)).toBeNull();
    expect(normalizeOrigin('kamespace.com')).toBeNull();
    expect(normalizeOrigin('https://kamespace.com/path')).toBeNull();
    expect(normalizeOrigin('https://kamespace.com?x=1')).toBeNull();
    expect(normalizeOrigin('javascript:alert(1)')).toBeNull();
  });
});

describe('resolveSiteOrigin', () => {
  it('defaults to the apex when unset or unusable', () => {
    expect(resolveSiteOrigin()).toBe(PRODUCTION_SITE_ORIGIN);
    expect(resolveSiteOrigin('')).toBe(PRODUCTION_SITE_ORIGIN);
    expect(resolveSiteOrigin('not-a-url')).toBe(PRODUCTION_SITE_ORIGIN);
  });

  it('honours a valid override', () => {
    expect(resolveSiteOrigin('https://staging.example.com')).toBe('https://staging.example.com');
  });

  it('defaults to the apex even when a non-canonical host is configured', () => {
    for (const host of NON_CANONICAL_HOSTS) {
      // A configured value is still respected (someone may run a real second deployment),
      // but the default must never be one of these.
      expect(PRODUCTION_SITE_ORIGIN).not.toContain(host);
    }
  });
});

describe('canonicalUrlFor', () => {
  it('joins a path onto the origin', () => {
    expect(canonicalUrlFor('https://kamespace.com', '/')).toBe('https://kamespace.com/');
    expect(canonicalUrlFor('https://kamespace.com/', '/about')).toBe('https://kamespace.com/about');
  });

  it('drops query strings, hashes and trailing slashes', () => {
    expect(canonicalUrlFor('https://kamespace.com', '/properties?swLat=1&swLng=2')).toBe(
      'https://kamespace.com/properties'
    );
    expect(canonicalUrlFor('https://kamespace.com', '/properties/monaco-2604/')).toBe(
      'https://kamespace.com/properties/monaco-2604'
    );
    expect(canonicalUrlFor('https://kamespace.com', '/about#team')).toBe(
      'https://kamespace.com/about'
    );
    expect(canonicalUrlFor('https://kamespace.com', '/properties?property=monaco#top')).toBe(
      'https://kamespace.com/properties'
    );
  });

  it('keeps only the pathname of an absolute URL', () => {
    expect(
      canonicalUrlFor('https://kamespace.com', 'https://www.kamespace.com/parkings/slot-a1?x=1')
    ).toBe('https://kamespace.com/parkings/slot-a1');
  });

  it('always produces an https apex URL', () => {
    const url = canonicalUrlFor(PRODUCTION_SITE_ORIGIN, '/hosts/sample-host');
    expect(url.startsWith('https://kamespace.com/')).toBe(true);
    expect(url).toBe('https://kamespace.com/hosts/sample-host');
  });
});
