import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const reportEdgeFailure = vi.fn();

vi.mock('@/lib/api/reportEdgeFailure', () => ({ reportEdgeFailure }));

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

async function loadModule() {
  return import('@/lib/api/publicEdgeFetch');
}

function okResponse(body: unknown = { success: true, data: { ok: true } }): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('publicEdgeFetch', () => {
  beforeEach(() => {
    reportEdgeFailure.mockClear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('joins a relative path onto the functions URL', async () => {
    const { publicEdgeFetch } = await loadModule();
    await publicEdgeFetch('/submit-form');

    expect(fetch).toHaveBeenCalledWith(`${FUNCTIONS_URL}/submit-form`, expect.anything());
  });

  it('leaves an absolute URL alone', async () => {
    const { publicEdgeFetch } = await loadModule();
    await publicEdgeFetch('https://example.test/custom?x=1');

    expect(fetch).toHaveBeenCalledWith('https://example.test/custom?x=1', expect.anything());
  });

  it('sends the anon key and a correlation id on every call', async () => {
    const { publicEdgeFetch } = await loadModule();
    await publicEdgeFetch('submit-form');

    const headers = new Headers((vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).headers);
    expect(headers.get('apikey')).toBe(ANON_KEY);
    expect(headers.get('authorization')).toBe(`Bearer ${ANON_KEY}`);
    expect(headers.get('x-request-id')).toMatch(/[0-9a-f-]{8,}/i);
  });

  it('keeps caller headers and does not force a content type', async () => {
    const { publicEdgeFetch } = await loadModule();
    await publicEdgeFetch('upload', {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data' },
    });

    const init = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(init.method).toBe('POST');
    expect(headers.get('content-type')).toBe('multipart/form-data');
    expect(headers.get('apikey')).toBe(ANON_KEY);
  });

  it('reports a failed status using the server request id when present', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('{}', { status: 503, headers: { 'x-request-id': 'server-123' } })
    );

    const { publicEdgeFetch } = await loadModule();
    await publicEdgeFetch('/submit-form', { method: 'POST' });

    expect(reportEdgeFailure).toHaveBeenCalledWith({
      path: '/submit-form',
      status: 503,
      method: 'POST',
      requestId: 'server-123',
    });
  });

  it('falls back to the local request id when the server sends none', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 500 }));

    const { publicEdgeFetch } = await loadModule();
    await publicEdgeFetch('submit-form');

    const sent = new Headers(
      (vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).headers
    ).get('x-request-id');
    expect(reportEdgeFailure).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: sent })
    );
  });

  it('stays quiet when the caller marks a 5xx as expected', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 500 }));

    const { publicEdgeFetch } = await loadModule();
    const res = await publicEdgeFetch('availability', { quiet: true });

    expect(res.ok).toBe(false);
    expect(reportEdgeFailure).not.toHaveBeenCalled();
  });

  it('reports a transport failure as status 0 and rethrows', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));

    const { publicEdgeFetch } = await loadModule();
    await expect(publicEdgeFetch('submit-form')).rejects.toThrow('Failed to fetch');

    expect(reportEdgeFailure).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'submit-form', status: 0 })
    );
  });
});

describe('publicEdgeFetchJson', () => {
  beforeEach(() => {
    reportEdgeFailure.mockClear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse({ success: true, data: [1, 2] })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('unwraps the shared envelope', async () => {
    const { publicEdgeFetchJson } = await loadModule();
    await expect(publicEdgeFetchJson<number[]>('list', undefined, 'failed')).resolves.toEqual([
      1, 2,
    ]);
  });

  it('throws the server error message when the envelope says failure', async () => {
    vi.mocked(fetch).mockResolvedValue(
      okResponse({ success: false, error: 'Listing is unavailable' })
    );

    const { publicEdgeFetchJson } = await loadModule();
    await expect(publicEdgeFetchJson('list', undefined, 'failed')).rejects.toThrow(
      'Listing is unavailable'
    );
  });

  it('falls back when the server sends no message', async () => {
    vi.mocked(fetch).mockResolvedValue(okResponse({ success: false }));

    const { publicEdgeFetchJson } = await loadModule();
    await expect(publicEdgeFetchJson('list', undefined, 'Could not load')).rejects.toThrow(
      'Could not load'
    );
  });

  it('treats a non-JSON body as a failure instead of crashing', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('not json', { status: 502 }));

    const { publicEdgeFetchJson } = await loadModule();
    await expect(publicEdgeFetchJson('list', undefined, 'Gateway error')).rejects.toThrow(
      'Gateway error'
    );
  });
});
