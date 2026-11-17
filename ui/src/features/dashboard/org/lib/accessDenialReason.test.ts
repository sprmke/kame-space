import { describe, expect, it } from 'vitest';

import type { EdgeCallError } from '@/features/dashboard/org/lib/edgeClient';
import {
  isAccessVerifyUnavailable,
  resolveAccessDenialReason,
} from '@/features/dashboard/org/lib/accessDenialReason';

function edgeError(status: number, message = 'Request failed'): EdgeCallError {
  const error = new Error(message) as EdgeCallError;
  error.status = status;
  return error;
}

describe('resolveAccessDenialReason', () => {
  it('prefers plan_limited when the seat is paused', () => {
    expect(
      resolveAccessDenialReason({
        planLimited: true,
        checkFailed: true,
        error: edgeError(503),
      })
    ).toBe('plan_limited');
  });

  it('uses unavailable for transport and 5xx failures', () => {
    expect(
      resolveAccessDenialReason({ checkFailed: true, error: edgeError(503) })
    ).toBe('unavailable');
    expect(
      resolveAccessDenialReason({
        checkFailed: true,
        error: new TypeError('Failed to fetch'),
      })
    ).toBe('unavailable');
    expect(resolveAccessDenialReason({ checkFailed: true })).toBe('unavailable');
  });

  it('uses default for firm access denies', () => {
    expect(
      resolveAccessDenialReason({ checkFailed: true, error: edgeError(403) })
    ).toBe('default');
    expect(
      resolveAccessDenialReason({
        planLimited: false,
        checkFailed: true,
        error: edgeError(403),
      })
    ).toBe('default');
  });

  it('uses default when the check succeeded but the user has no grant', () => {
    expect(resolveAccessDenialReason({ planLimited: false })).toBe('default');
    expect(resolveAccessDenialReason({})).toBe('default');
  });
});

describe('isAccessVerifyUnavailable', () => {
  it('treats 403 as available (firm deny)', () => {
    expect(isAccessVerifyUnavailable(edgeError(403))).toBe(false);
  });

  it('treats 0 / 5xx / TypeError as unavailable', () => {
    expect(isAccessVerifyUnavailable(edgeError(0))).toBe(true);
    expect(isAccessVerifyUnavailable(edgeError(502))).toBe(true);
    expect(isAccessVerifyUnavailable(new TypeError('Failed to fetch'))).toBe(true);
  });
});
