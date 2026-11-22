import { describe, expect, it } from 'vitest';

import { firstEmail, resolveGuestTestEmail, resolveHostTestEmail } from './localTestAuth';

describe('localTestAuth', () => {
  it('takes the first trimmed email from a list', () => {
    expect(firstEmail(' a@example.com , b@example.com ')).toBe('a@example.com');
    expect(firstEmail('')).toBe('');
    expect(firstEmail(undefined)).toBe('');
  });

  it('prefers an explicit host test email', () => {
    expect(
      resolveHostTestEmail({
        VITE_LOCAL_TEST_EMAIL: 'local@example.com',
        VITE_SUPER_ADMIN_EMAILS: 'super@example.com',
      }),
    ).toBe('local@example.com');
  });

  it('defaults to the seeded owner account', () => {
    expect(resolveHostTestEmail({})).toBe('seed-owner@example.com');
    expect(
      resolveHostTestEmail({ VITE_SUPER_ADMIN_EMAILS: 'super@example.com' }),
    ).toBe('seed-owner@example.com');
    expect(
      resolveHostTestEmail({ VITE_ADMIN_ALLOWED_EMAILS: 'admin@example.com' }),
    ).toBe('seed-owner@example.com');
  });

  it('uses the seeded guest account unless overridden', () => {
    expect(resolveGuestTestEmail({})).toBe('guest.demo@example.com');
    expect(resolveGuestTestEmail({ VITE_LOCAL_GUEST_EMAIL: 'guest2@example.com' })).toBe(
      'guest2@example.com',
    );
  });
});
