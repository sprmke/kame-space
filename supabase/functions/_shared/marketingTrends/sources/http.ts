/**
 * Marketing Trends — shared HTTP helper for the source adapters.
 *
 * Every adapter gets the same timeout, the same descriptive User-Agent and the
 * same failure shape. A source that fails never fails the run; it returns
 * `{ ok: false, error }` and the pipeline decides whether there is enough left.
 */

import type { TrendSourceId, TrendSourceResult } from '../types.ts';

/** Wikimedia asks for a descriptive User-Agent. So does every polite crawler. */
export const TRENDS_USER_AGENT = 'KameSpaceTrends/1.0 (+https://kamespace.com/contact)';

/** Per-source fetch budget. The whole daily run has a 55 s budget. */
export const SOURCE_TIMEOUT_MS = 8_000;

/** The weekly Netflix download is 33 MB, so it gets its own budget. */
export const WEEKLY_TIMEOUT_MS = 120_000;

export class SourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SourceError';
  }
}

/** Fetch text with a timeout. Throws `SourceError` on any failure. */
export async function fetchText(
  url: string,
  options: { timeoutMs?: number; headers?: Record<string, string> } = {}
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? SOURCE_TIMEOUT_MS;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': TRENDS_USER_AGENT,
        Accept: '*/*',
        ...(options.headers ?? {}),
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new SourceError(`request failed: ${reason}`);
  }
  if (!response.ok) {
    throw new SourceError(`http ${response.status}`);
  }
  return response.text();
}

/** Fetch JSON with a timeout. Throws `SourceError` on any failure. */
export async function fetchJson<T>(url: string, options: { timeoutMs?: number } = {}): Promise<T> {
  const text = await fetchText(url, { ...options, headers: { Accept: 'application/json' } });
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new SourceError('response was not valid JSON');
  }
}

/** An empty result, used when an adapter has nothing to offer. */
export function emptyResult(source: TrendSourceId, ms: number, error: string | null): TrendSourceResult {
  return { source, ok: error === null, items: [], ms, error };
}

/** Wrap an adapter so a throw becomes a failed result instead of a broken run. */
export async function runSource(
  source: TrendSourceId,
  fetchAndParse: () => Promise<TrendSourceResult>
): Promise<TrendSourceResult> {
  const startedAt = Date.now();
  try {
    const result = await fetchAndParse();
    return { ...result, ms: Date.now() - startedAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return emptyResult(source, Date.now() - startedAt, message);
  }
}
