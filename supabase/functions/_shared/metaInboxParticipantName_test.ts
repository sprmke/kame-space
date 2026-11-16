import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { formatMetaParticipantDisplayName } from './metaInboxGraph.ts';

Deno.test('formatMetaParticipantDisplayName: prefers full name', () => {
  assertEquals(
    formatMetaParticipantDisplayName({
      name: 'Maria Santos',
      firstName: 'Maria',
      lastName: 'Santos',
      username: 'maria',
    }),
    'Maria Santos'
  );
});

Deno.test('formatMetaParticipantDisplayName: composes first + last when name is empty', () => {
  assertEquals(
    formatMetaParticipantDisplayName({
      firstName: 'Maria',
      lastName: 'Santos',
    }),
    'Maria Santos'
  );
});

Deno.test('formatMetaParticipantDisplayName: Instagram username falls back with @', () => {
  assertEquals(formatMetaParticipantDisplayName({ username: 'kame.guest' }), '@kame.guest');
  assertEquals(formatMetaParticipantDisplayName({ username: '@kame.guest' }), '@kame.guest');
});

Deno.test('formatMetaParticipantDisplayName: empty inputs stay null (UI shows Guest)', () => {
  assertEquals(formatMetaParticipantDisplayName({}), null);
  assertEquals(formatMetaParticipantDisplayName({ name: '  ', username: '' }), null);
});
