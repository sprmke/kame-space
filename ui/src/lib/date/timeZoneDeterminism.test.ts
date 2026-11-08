import { describe, expect, it } from 'vitest';

/**
 * Guards the test-timezone contract set in `ui/vitest.setup.ts`.
 *
 * Every user-visible time in Kame Space is Asia/Manila. Without a pinned test
 * timezone, a date-boundary test passes on one machine and fails on another, and the
 * failure looks like a product bug. This test fails loudly instead.
 */
describe('test timezone determinism', () => {
  it('runs in Asia/Manila', () => {
    expect(process.env.TZ).toBe('Asia/Manila');
  });

  it('renders a Manila midnight on the correct calendar day', () => {
    // 16:00 UTC is 00:00 the next day in Manila (UTC+8, no DST).
    const instant = new Date('2026-11-08T16:00:00.000Z');

    expect(instant.getDate()).toBe(9);
    expect(instant.getHours()).toBe(0);
  });

  it('keeps the offset at +08:00 all year, because Manila has no DST', () => {
    for (const iso of ['2026-01-15T00:00:00.000Z', '2026-07-15T00:00:00.000Z']) {
      expect(new Date(iso).getTimezoneOffset()).toBe(-480);
    }
  });
});
