import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { friendlyMetaSendError } from './metaInboxSendErrors.ts';
import { MetaGraphError } from './metaInboxGraphError.ts';

Deno.test('friendlyMetaSendError: expired token asks the host to reconnect', () => {
  assertEquals(
    friendlyMetaSendError(
      'Error validating access token: Session has expired on Monday. (OAuthException code 190)'
    ),
    'Meta session expired - reconnect Facebook in Channels.'
  );
  assertEquals(
    friendlyMetaSendError(new MetaGraphError('Invalid OAuth access token', { code: 190 })),
    'Meta session expired - reconnect Facebook in Channels.'
  );
});

Deno.test('friendlyMetaSendError: permission, window, rate limit and recipient errors', () => {
  assertEquals(
    friendlyMetaSendError('(#10) This page does not have permission'),
    'Missing Meta permission - reconnect the Page or complete App Review.'
  );
  assertEquals(
    friendlyMetaSendError('Message sent outside the allowed window'),
    'Messaging window expired - guest must message again before you can reply.'
  );
  assertEquals(
    friendlyMetaSendError('(#4) Application request limit reached'),
    'Meta rate limit - wait a moment and try again.'
  );
  assertEquals(
    friendlyMetaSendError('(#100) No matching user found for recipient'),
    'Invalid recipient - try syncing conversations from Channels.'
  );
});

Deno.test('friendlyMetaSendError: Business AI ownership is not a missing permission', () => {
  assertEquals(
    friendlyMetaSendError(
      new MetaGraphError('Permission denied', { code: 10, errorSubcode: 2018300 })
    ),
    'Meta Business AI is answering this chat. Take over in Business Suite to reply here.'
  );
  // Code 10 without the routing subcode is still a missing permission.
  assertEquals(
    friendlyMetaSendError(new MetaGraphError('Permission denied', { code: 10 })),
    'Missing Meta permission - reconnect the Page or complete App Review.'
  );
});

Deno.test('friendlyMetaSendError: a closed window is read from the Graph code', () => {
  assertEquals(
    friendlyMetaSendError(
      new MetaGraphError('(#2018065) Message sent outside the allowed window', { code: 2018065 })
    ),
    'Messaging window expired - guest must message again before you can reply.'
  );
});

Deno.test('friendlyMetaSendError: an unavailable recipient is not a permission problem', () => {
  assertEquals(
    friendlyMetaSendError(new MetaGraphError('(#551) Person is not available', { code: 551 })),
    'This person is not available to receive messages.'
  );
});

Deno.test('friendlyMetaSendError: unknown errors pass through unchanged', () => {
  assertEquals(friendlyMetaSendError('Something else'), 'Something else');
});

Deno.test('friendlyMetaSendError: a code 10 closed window is not a permission error', () => {
  // Meta returns code 10 for a closed messaging window as well as for a missing
  // permission, so the text has to decide.
  assertEquals(
    friendlyMetaSendError(new MetaGraphError('(#10) This message is sent outside of allowed window', { code: 10 })),
    'Messaging window expired - guest must message again before you can reply.'
  );
  assertEquals(
    friendlyMetaSendError('(#10) This message is sent outside of allowed window'),
    'Messaging window expired - guest must message again before you can reply.'
  );
});
