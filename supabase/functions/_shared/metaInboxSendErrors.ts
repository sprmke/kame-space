/**
 * Map Meta Graph send errors to operator-friendly messages.
 *
 * The copy is derived from the Graph error code and subcode, not from the message text.
 * Meta describes the same failure differently on different surfaces, and substring matching
 * reported "missing Meta permission" for a chat that Meta Business AI owns.
 */

import {
  isBusinessAiOwnedError,
  isInvalidMetaTokenError,
  isMetaGraphError,
  isMetaRateLimitError,
  META_ERROR_OUTSIDE_WINDOW,
  META_ERROR_PERSON_UNAVAILABLE,
  META_ERROR_PERMISSION,
  META_ERROR_RATE_LIMIT,
  MetaGraphError,
  parseMetaErrorCodeFromMessage,
} from './metaInboxGraphError.ts';

const WINDOW_COPY =
  'Messaging window expired - guest must message again before you can reply.';
const TOKEN_COPY = 'Meta session expired - reconnect Facebook in Channels.';
const RATE_LIMIT_COPY = 'Meta rate limit - wait a moment and try again.';
const UNAVAILABLE_COPY = 'This person is not available to receive messages.';
const RECIPIENT_COPY = 'Invalid recipient - try syncing conversations from Channels.';
const PERMISSION_COPY = 'Missing Meta permission - reconnect the Page or complete App Review.';
const BUSINESS_AI_COPY =
  'Meta Business AI is answering this chat. Take over in Business Suite to reply here.';

function friendlyFromCode(error: MetaGraphError): string {
  if (isBusinessAiOwnedError(error)) return BUSINESS_AI_COPY;
  if (isInvalidMetaTokenError(error)) return TOKEN_COPY;
  if (error.code === META_ERROR_OUTSIDE_WINDOW) return WINDOW_COPY;
  if (isMetaRateLimitError(error) || error.code === META_ERROR_RATE_LIMIT) return RATE_LIMIT_COPY;
  if (error.code === META_ERROR_PERSON_UNAVAILABLE) return UNAVAILABLE_COPY;
  if (error.code === 100 && /recipient/i.test(error.message)) return RECIPIENT_COPY;
  if (error.code === META_ERROR_PERMISSION) return PERMISSION_COPY;
  return error.message;
}

/** Map a Meta Graph send error to operator-friendly copy. */
export function friendlyMetaSendError(error: unknown): string {
  if (isMetaGraphError(error)) return friendlyFromCode(error);

  const raw =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : String(error ?? '');

  const code = parseMetaErrorCodeFromMessage(raw);
  if (code !== null) return friendlyFromCode(new MetaGraphError(raw, { code }));

  // Text fallback. Meta omits the code from some messages.
  if (/outside the allowed window|messaging window/i.test(raw)) return WINDOW_COPY;
  if (/access token|session has expired/i.test(raw)) return TOKEN_COPY;
  if (/rate limit/i.test(raw)) return RATE_LIMIT_COPY;
  if (/\(#551\)|person is not available/i.test(raw)) return UNAVAILABLE_COPY;
  if (/\(#100\)/.test(raw) && /recipient/i.test(raw)) return RECIPIENT_COPY;
  if (/\(#10\)|does not have permission/i.test(raw)) return PERMISSION_COPY;

  return raw;
}
