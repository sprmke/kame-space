import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { COPY_LIBRARY, fillCopy, fillTemplate, resolveCopyTemplate } from './marketingCopyLibrary.ts';
import { OPPORTUNITIES } from './marketingPlaybook.ts';

const LANGUAGES = ['en', 'fil', 'taglish'] as const;

Deno.test('copy library: every opportunity has copy in every language', () => {
  for (const type of Object.keys(OPPORTUNITIES) as (keyof typeof OPPORTUNITIES)[]) {
    for (const language of LANGUAGES) {
      const template = COPY_LIBRARY[language][type];
      assert(template, `${type} is missing ${language} copy`);
      assert(template.title.length > 0, `${type}/${language} title is empty`);
      assert(template.hook.length > 0, `${type}/${language} hook is empty`);
      assert(template.cta.length > 0, `${type}/${language} cta is empty`);
    }
  }
});

Deno.test('copy library: no em dashes in host-visible copy', () => {
  for (const language of LANGUAGES) {
    for (const template of Object.values(COPY_LIBRARY[language])) {
      for (const value of Object.values(template)) {
        assert(!value.includes('\u2014'), `em dash in ${language} copy: ${value}`);
      }
    }
  }
});

Deno.test('fillCopy: replaces every placeholder it is given', () => {
  assertEquals(
    fillCopy('{{nightsLeft}} left for {{dates}}.', { nightsLeft: '2 nights', dates: 'Fri and Sat' }),
    '2 nights left for Fri and Sat.'
  );
});

Deno.test('fillCopy: an unknown placeholder never leaks to the host', () => {
  const filled = fillCopy('From {{rate}} a night at {{propertyName}}.', { rate: '3200' });
  assertEquals(filled.includes('{{'), false);
  assertEquals(filled, 'From 3200 a night at .');
});

Deno.test('fillCopy: collapses the space left by an empty variable', () => {
  assertEquals(fillCopy('Open at {{propertyName}} today.', {}), 'Open at today.');
});

Deno.test('fillTemplate: fills title, hook, message and cta together', () => {
  const template = resolveCopyTemplate('weekend_open', 'en');
  const filled = fillTemplate(template, { nightsLeft: '2 nights', dates: 'Fri and Sat' });
  assertEquals(filled.title, 'Open this weekend');
  assertEquals(filled.hook, '2 nights left this weekend.');
  assertEquals(filled.message, 'Fri and Sat are still open at .');
  assertEquals(filled.cta, 'Book the weekend');
});
