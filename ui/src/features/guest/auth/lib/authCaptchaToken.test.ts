import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/security/turnstileLoader', () => ({
  isTurnstileConfigured: vi.fn(),
}));

import { isTurnstileConfigured } from '@/components/security/turnstileLoader';

import { isAuthCaptchaTokenMissing } from './authCaptchaToken';

const configured = vi.mocked(isTurnstileConfigured);

afterEach(() => {
  configured.mockReset();
});

describe('isAuthCaptchaTokenMissing', () => {
  it('is false when Turnstile is not configured', () => {
    configured.mockReturnValue(false);
    expect(isAuthCaptchaTokenMissing('')).toBe(false);
    expect(isAuthCaptchaTokenMissing(undefined)).toBe(false);
  });

  it('is false when a token is present', () => {
    configured.mockReturnValue(true);
    expect(isAuthCaptchaTokenMissing('tok_abc')).toBe(false);
  });

  it('is true when configured and the token is empty', () => {
    configured.mockReturnValue(true);
    expect(isAuthCaptchaTokenMissing('')).toBe(true);
    expect(isAuthCaptchaTokenMissing(undefined)).toBe(true);
  });
});
