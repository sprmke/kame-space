/**
 * Typed Meta Graph error.
 *
 * Meta reports the same failure with different prose depending on the surface, so operator
 * copy is derived from `code` and `error_subcode`, never from the message text. Substring
 * matching cannot express "code 10 with subcode 2018300", which is Meta Business AI owning
 * the chat, and that is exactly how a missing-permission message was being shown for it.
 */

/** Meta error code: the app lacks permission for the object or action. */
export const META_ERROR_PERMISSION = 10;
/** Meta error code: the Page access token is invalid or expired. */
export const META_ERROR_INVALID_TOKEN = 190;
/** Meta error code: the recipient is not available for messaging. */
export const META_ERROR_PERSON_UNAVAILABLE = 551;
/** Meta error code: the API call rate limit was hit. */
export const META_ERROR_RATE_LIMIT = 4;
/** Meta error code: the message is outside the messaging window. */
export const META_ERROR_OUTSIDE_WINDOW = 2018065;
/** Meta error subcode: another app (Meta Business AI) owns the conversation. */
export const META_SUBCODE_BUSINESS_AI_OWNED = 2018300;

export type MetaGraphErrorInit = {
  code?: number | null;
  errorSubcode?: number | null;
  httpStatus?: number | null;
};

export class MetaGraphError extends Error {
  readonly code: number | null;
  readonly errorSubcode: number | null;
  readonly httpStatus: number | null;

  constructor(message: string, init?: MetaGraphErrorInit) {
    super(message);
    this.name = 'MetaGraphError';
    this.code = init?.code ?? null;
    this.errorSubcode = init?.errorSubcode ?? null;
    this.httpStatus = init?.httpStatus ?? null;
  }
}

/** True for a Meta Graph error, including one that crossed a module boundary. */
export function isMetaGraphError(error: unknown): error is MetaGraphError {
  if (error instanceof MetaGraphError) return true;
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'MetaGraphError' &&
    'code' in error
  );
}

/** `(#190)` in the message body. Meta often only puts the code in the prose. */
export function parseMetaErrorCodeFromMessage(message: string): number | null {
  const match = /\(#(\d+)\)/.exec(message);
  if (!match) return null;
  const code = Number.parseInt(match[1]!, 10);
  return Number.isNaN(code) ? null : code;
}

/**
 * Build a `MetaGraphError` from a Graph error body.
 *
 * Prefers the structured `error.code` and `error.error_subcode`. Falls back to the
 * `(#code)` in the message when the body has no structured code.
 */
export function metaGraphErrorFromResponse(
  json: Record<string, unknown> | null | undefined,
  httpStatus: number | null,
  fallbackMessage: string
): MetaGraphError {
  const error = (json?.error ?? null) as
    | { message?: string; code?: number; error_subcode?: number }
    | null;
  const message = error?.message?.trim() || fallbackMessage;
  const structuredCode = typeof error?.code === 'number' ? error.code : null;
  const structuredSubcode = typeof error?.error_subcode === 'number' ? error.error_subcode : null;
  const code = structuredCode ?? parseMetaErrorCodeFromMessage(message);
  return new MetaGraphError(message, {
    code,
    errorSubcode: structuredSubcode,
    httpStatus,
  });
}

/** True when Meta says the Page access token is no longer valid. */
export function isInvalidMetaTokenError(error: unknown): boolean {
  if (!isMetaGraphError(error)) return false;
  if (error.code === META_ERROR_INVALID_TOKEN) return true;
  return /access token|session has expired/i.test(error.message);
}

/** True when another app (Meta Business AI) owns the conversation. */
export function isBusinessAiOwnedError(error: unknown): boolean {
  if (!isMetaGraphError(error)) return false;
  if (error.errorSubcode === META_SUBCODE_BUSINESS_AI_OWNED) return true;
  return error.code === META_ERROR_PERMISSION && /business ?ai|routing|another app/i.test(error.message);
}

/** True when Meta asked us to slow down. */
export function isMetaRateLimitError(error: unknown): boolean {
  if (!isMetaGraphError(error)) return false;
  return error.code === META_ERROR_RATE_LIMIT || error.httpStatus === 429;
}
