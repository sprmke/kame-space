import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  isBusinessAiOwnedError,
  isInvalidMetaTokenError,
  isMetaGraphError,
  isMetaRateLimitError,
  metaGraphErrorFromResponse,
  MetaGraphError,
  parseMetaErrorCodeFromMessage,
} from './metaInboxGraphError.ts';

Deno.test('metaGraphErrorFromResponse: reads the structured code and subcode', () => {
  const error = metaGraphErrorFromResponse(
    { error: { message: 'Permission denied', code: 10, error_subcode: 2018300 } },
    400,
    'fallback'
  );
  assertEquals(error.code, 10);
  assertEquals(error.errorSubcode, 2018300);
  assertEquals(error.message, 'Permission denied');
});

Deno.test('metaGraphErrorFromResponse: falls back to the code in the message', () => {
  const error = metaGraphErrorFromResponse(
    { error: { message: 'Invalid OAuth access token. (#190)' } },
    400,
    'fallback'
  );
  assertEquals(error.code, 190);
  assertEquals(error.errorSubcode, null);
});

Deno.test('metaGraphErrorFromResponse: keeps the fallback when the body has no error', () => {
  const error = metaGraphErrorFromResponse(null, 500, 'Meta API error (500)');
  assertEquals(error.message, 'Meta API error (500)');
  assertEquals(error.code, null);
});

Deno.test('isBusinessAiOwnedError: code 10 with subcode 2018300 is Business AI', () => {
  const error = new MetaGraphError('Permission denied', { code: 10, errorSubcode: 2018300 });
  assertEquals(isBusinessAiOwnedError(error), true);
  // Plain code 10 is a missing permission, not a routing conflict.
  assertEquals(isBusinessAiOwnedError(new MetaGraphError('Permission denied', { code: 10 })), false);
});

Deno.test('isInvalidMetaTokenError: code 190 and an expired session', () => {
  assertEquals(isInvalidMetaTokenError(new MetaGraphError('nope', { code: 190 })), true);
  assertEquals(
    isInvalidMetaTokenError(new MetaGraphError('Session has expired on Monday')),
    true
  );
  assertEquals(isInvalidMetaTokenError(new MetaGraphError('nope', { code: 10 })), false);
});

Deno.test('isMetaRateLimitError: code 4 and HTTP 429', () => {
  assertEquals(isMetaRateLimitError(new MetaGraphError('slow down', { code: 4 })), true);
  assertEquals(isMetaRateLimitError(new MetaGraphError('slow down', { httpStatus: 429 })), true);
  assertEquals(isMetaRateLimitError(new MetaGraphError('other', { code: 10 })), false);
});

Deno.test('isMetaGraphError: recognises an error that crossed a module boundary', () => {
  assertEquals(isMetaGraphError(new MetaGraphError('x')), true);
  assertEquals(isMetaGraphError({ name: 'MetaGraphError', code: 190 }), true);
  assertEquals(isMetaGraphError(new Error('x')), false);
  assertEquals(isMetaGraphError(null), false);
});

Deno.test('parseMetaErrorCodeFromMessage: reads the (#code) marker', () => {
  assertEquals(parseMetaErrorCodeFromMessage('Message failed (#551)'), 551);
  assertEquals(parseMetaErrorCodeFromMessage('no code here'), null);
});
