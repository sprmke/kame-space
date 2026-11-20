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

  it('falls back to the first super admin, then the allow list', () => {
    expect(resolveHostTestEmail({ VITE_SUPER_ADMIN_EMAILS: 'super@example.com,other@example.com' })).toBe(
      'super@example.com',
    );
    expect(
      resolveHostTestEmail({ VITE_SUPER_ADMIN_EMAILS: '', VITE_ADMIN_ALLOWED_EMAILS: 'admin@example.com' }),
    ).toBe('admin@example.com');
    expect(resolveHostTestEmail({})).toBe('');
  });

  it('uses the seeded guest account unless overridden', () => {
    expect(resolveGuestTestEmail({})).toBe('guest.demo@example.com');
    expect(resolveGuestTestEmail({ VITE_LOCAL_GUEST_EMAIL: 'guest2@example.com' })).toBe(
      'guest2@example.com',
    );
  });
});
