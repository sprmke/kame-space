import { assertEquals, assertFalse } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { scrubRecord, scrubText } from './telemetryScrub.ts';

const TOKEN = '123456789:AAHfake_token_value_for_tests';

Deno.test('scrubText removes a Telegram bot token from a fetch error message', () => {
  const message = `error sending request for url (https://api.telegram.org/bot${TOKEN}/sendMessage)`;
  const scrubbed = scrubText(message);
  assertFalse(scrubbed.includes(TOKEN));
  assertEquals(scrubbed.includes('/bot[redacted]/sendMessage'), true);
});

Deno.test('scrubText removes a bearer credential', () => {
  const scrubbed = scrubText('Authorization: Bearer abcdef1234567890abcdef');
  assertFalse(scrubbed.includes('abcdef1234567890abcdef'));
  assertEquals(scrubbed.includes('Bearer [redacted]'), true);
});

Deno.test('scrubText redacts token query params that survived into text', () => {
  const scrubbed = scrubText('failed to load https://kamespace.com/sd-form?access=secret-token&tab=review');
  assertFalse(scrubbed.includes('secret-token'));
  assertEquals(scrubbed.includes('tab=review'), true);
});

Deno.test('scrubRecord scrubs credential-shaped strings at any depth', () => {
  const out = scrubRecord({
    nested: {
      reason: `server said url(https://api.telegram.org/bot${TOKEN}/getMe)`,
    },
  });
  const text = JSON.stringify(out);
  assertFalse(text.includes(TOKEN));
});

Deno.test('scrubRecord still drops denied keys', () => {
  const out = scrubRecord({ token: 'secret', email: 'a@b.test', status: 'error' });
  assertEquals(out.token, undefined);
  assertEquals(out.email, undefined);
  assertEquals(out.status, 'error');
});
