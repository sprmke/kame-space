import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  guestLoginPath,
  guestOAuthRedirectTo,
  GUEST_LOGIN_PATH,
} from '@/features/guest/auth/lib/guestAuthPaths';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubOrigin(origin = 'https://kamespace.com') {
  vi.stubGlobal('window', { location: { origin } });
}

describe('guestLoginPath', () => {
  it('returns the bare login path when there is no redirect', () => {
    expect(guestLoginPath()).toBe('/for-guests/login');
  });

  it('treats the explore home as no redirect', () => {
    expect(guestLoginPath('/')).toBe('/for-guests/login');
  });

  it('encodes a real redirect target', () => {
    expect(guestLoginPath('/account/stays')).toBe('/for-guests/login?redirect=%2Faccount%2Fstays');
  });
});

describe('guestOAuthRedirectTo', () => {
  it('returns an absolute same-origin URL', () => {
    stubOrigin();
    expect(guestOAuthRedirectTo('/account/favorites')).toBe(
      'https://kamespace.com/account/favorites'
    );
  });

  it('falls back to home for an unsafe target', () => {
    stubOrigin();
    expect(guestOAuthRedirectTo('//evil.com')).toBe('https://kamespace.com/');
  });
});

describe('GUEST_LOGIN_PATH', () => {
  it('is the guest sign-in route', () => {
    expect(GUEST_LOGIN_PATH).toBe('/for-guests/login');
  });
});
