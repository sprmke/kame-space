import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const captureError = vi.fn();

vi.mock('@/lib/sentry/capture', () => ({ captureError }));

const { reportEdgeFailure } = await import('@/lib/api/reportEdgeFailure');

function lastCapture() {
  const call = captureError.mock.calls.at(-1);
  if (!call) throw new Error('captureError was not called');
  return {
    error: call[0] as Error,
    options: call[1] as {
      level?: string;
      tags?: Record<string, string>;
      extra?: Record<string, unknown>;
      fingerprint?: string[];
    },
  };
}

describe('reportEdgeFailure', () => {
  beforeEach(() => {
    captureError.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports a 5xx as a fault tagged with the edge function', () => {
    reportEdgeFailure({ path: '/submit-form?x=1', status: 500, method: 'POST', requestId: 'r1' });

    const { error, options } = lastCapture();
    expect(error.message).toBe('Edge call failed: submit-form (HTTP 500)');
    expect(options.level).toBe('error');
    expect(options.tags).toMatchObject({
      fn: 'submit-form',
      http_status: '500',
      request_id: 'r1',
    });
    expect(options.extra).toEqual({ edge_path: '/submit-form', method: 'POST' });
    expect(options.fingerprint).toEqual(['edge', 'submit-form', '5xx']);
  });

  it('ignores 4xx responses, which are the handler answering correctly', () => {
    for (const status of [400, 401, 403, 404, 409, 429]) {
      reportEdgeFailure({ path: 'submit-form', status });
    }
    expect(captureError).not.toHaveBeenCalled();
  });

  it('reports a transport failure while the browser believes it is online', () => {
    vi.stubGlobal('navigator', { onLine: true });

    reportEdgeFailure({ path: 'submit-form', status: 0 });

    const { error, options } = lastCapture();
    expect(error.message).toBe('Edge call failed: submit-form (network failure)');
    expect(options.fingerprint).toEqual(['edge', 'submit-form', 'network']);
    expect(options.tags).not.toHaveProperty('request_id');
  });

  it('stays silent when the browser is offline', () => {
    vi.stubGlobal('navigator', { onLine: false });

    reportEdgeFailure({ path: 'submit-form', status: 0 });

    expect(captureError).not.toHaveBeenCalled();
  });

  it('reads the function name out of an absolute functions URL', () => {
    reportEdgeFailure({
      path: 'https://project.supabase.co/functions/v1/submit-form?x=1',
      status: 502,
    });

    expect(lastCapture().options.tags).toMatchObject({ fn: 'submit-form' });
  });

  it('drops a path with no usable function segment', () => {
    reportEdgeFailure({ path: 'https://example.test/', status: 500 });

    expect(captureError).not.toHaveBeenCalled();
  });
});
