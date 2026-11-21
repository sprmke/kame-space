import { describe, expect, it } from 'vitest';

import {
  isValidBlockIdentity,
  normaliseBlockIdentity,
} from '@/features/dashboard/super-admin/lib/rateLimitIdentity';

describe('normaliseBlockIdentity', () => {
  it('keeps an explicit user prefix', () => {
    expect(normaliseBlockIdentity('u:2f1c0b9e-1a2b')).toBe('u:2f1c0b9e-1a2b');
  });

  it('lowercases an explicit prefix', () => {
    expect(normaliseBlockIdentity('IP:203.0.113.5')).toBe('ip:203.0.113.5');
    expect(normaliseBlockIdentity('U:abc123')).toBe('u:abc123');
  });

  it('adds the user prefix to a bare user id', () => {
    expect(normaliseBlockIdentity('abc123')).toBe('u:abc123');
  });

  it('detects an IPv4 address', () => {
    expect(normaliseBlockIdentity('203.0.113.5')).toBe('ip:203.0.113.5');
  });

  it('detects an IPv6 address', () => {
    expect(normaliseBlockIdentity('2001:db8::1')).toBe('ip:2001:db8::1');
  });

  it('trims whitespace and handles empty input', () => {
    expect(normaliseBlockIdentity('  abc123  ')).toBe('u:abc123');
    expect(normaliseBlockIdentity('   ')).toBe('');
  });
});

describe('isValidBlockIdentity', () => {
  it('accepts a normalised user id or IP', () => {
    expect(isValidBlockIdentity('abc123')).toBe(true);
    expect(isValidBlockIdentity('203.0.113.5')).toBe(true);
  });

  it('rejects empty input', () => {
    expect(isValidBlockIdentity('')).toBe(false);
    expect(isValidBlockIdentity('   ')).toBe(false);
  });
});
