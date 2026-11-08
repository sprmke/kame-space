import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  hostLoginPath,
  hostGoogleOAuthRedirectTo,
  HOST_LOGIN_PATH,
} from '@/features/guest/auth/lib/hostAuthPaths';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('hostLoginPath', () => {
  it('returns the bare login path when there is no redirect', () => {
    expect(hostLoginPath()).toBe('/for-hosts/login');
  });

  it('treats the dashboard default as no redirect', () => {
    expect(hostLoginPath('/dashboard')).toBe('/for-hosts/login');
  });

  it('encodes a real redirect target', () => {
    expect(hostLoginPath('/org/acme/bookings')).toBe(
      '/for-hosts/login?redirect=%2Forg%2Facme%2Fbookings'
    );
  });
});

describe('hostGoogleOAuthRedirectTo', () => {
  it('returns to the auth page with the redirect preserved', () => {
    vi.stubGlobal('window', { location: { origin: 'https://kamespace.com' } });
    expect(hostGoogleOAuthRedirectTo(HOST_LOGIN_PATH, '/onboarding')).toBe(
      'https://kamespace.com/for-hosts/login?redirect=%2Fonboarding'
    );
  });
});

describe('HOST_LOGIN_PATH', () => {
  it('is the host sign-in route', () => {
    expect(HOST_LOGIN_PATH).toBe('/for-hosts/login');
  });
});
