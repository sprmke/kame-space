import { describe, expect, it } from 'vitest';

import { inboxMockHostAllowed } from './inboxMockMode';

describe('inboxMockHostAllowed', () => {
  it('allows local and preview hosts', () => {
    for (const host of ['localhost', '127.0.0.1', 'app.localhost', 'kame-homes.vercel.app']) {
      expect(inboxMockHostAllowed(host)).toBe(true);
    }
  });

  it('blocks the production host', () => {
    for (const host of ['kamespace.com', 'www.kamespace.com']) {
      expect(inboxMockHostAllowed(host)).toBe(false);
    }
  });
});
