import { captureSentryMessage } from './sentry.ts';
import { scrubText } from './telemetryScrub.ts';
export function formatTelegramNetworkError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/tls handshake|connect error|connection reset|timed out|dns|network/i.test(message)) {
    return 'Could not reach Telegram. Check your connection and try again.';
  }
  return 'Telegram request failed. Try again.';
}

export async function fetchTelegramJson<T extends Record<string, unknown>>(
  url: string
): Promise<{ ok: true; response: Response; json: T } | { ok: false; error: string }> {
  try {
    const response = await fetch(url);
    const json = (await response.json().catch(() => ({}))) as T;
    return { ok: true, response, json };
  } catch (error) {
    // Deno's fetch error message embeds the full request URL, which contains `bot<token>`.
    // Never log or return the raw message.
    console.error(
      '[telegram/api] fetch failed:',
      scrubText(error instanceof Error ? error.message : String(error))
    );
    return { ok: false, error: formatTelegramNetworkError(error) };
  }
}
