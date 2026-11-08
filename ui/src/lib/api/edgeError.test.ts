import { describe, expect, it } from 'vitest';

import { EdgeResponseError } from '@/lib/api/edgeError';

describe('EdgeResponseError', () => {
  it('carries the HTTP status the reporter uses for fault vs outcome', () => {
    const error = new EdgeResponseError('Booking not found', 404);
    expect(error.status).toBe(404);
    expect(error.message).toBe('Booking not found');
  });

  it('is a real Error with a stable name', () => {
    const error = new EdgeResponseError('Invalid date range', 400);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('EdgeResponseError');
  });

  it('keeps a 4xx status distinguishable from a transport failure', () => {
    expect(new EdgeResponseError('nope', 429).status).toBeLessThan(500);
    expect(new EdgeResponseError('boom', 503).status).toBeGreaterThanOrEqual(500);
  });
});
