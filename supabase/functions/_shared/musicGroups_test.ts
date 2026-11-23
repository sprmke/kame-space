import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  DEFAULT_MUSIC_GROUP,
  findMusicGroup,
  isMusicGroupSlug,
  MUSIC_GROUPS,
} from './musicGroups.ts';

Deno.test('music groups: slugs are unique, lowercase and url safe', () => {
  const slugs = MUSIC_GROUPS.map((g) => g.slug);
  assertEquals(new Set(slugs).size, slugs.length);
  for (const slug of slugs) assert(/^[a-z]+(-[a-z]+)*$/.test(slug), slug);
});

Deno.test('music groups: every kind the picker shows exists', () => {
  const kinds = new Set(MUSIC_GROUPS.map((g) => g.kind));
  for (const kind of ['trending', 'genre', 'mood', 'collection']) assert(kinds.has(kind as never));
});

Deno.test('music groups: the default group exists and is trending', () => {
  assertEquals(findMusicGroup(DEFAULT_MUSIC_GROUP)?.kind, 'trending');
});

Deno.test('music groups: lookups ignore case and padding, and reject unknowns', () => {
  assertEquals(findMusicGroup(' Beach-Day ')?.slug, 'beach-day');
  assertEquals(findMusicGroup('nope'), null);
  assertEquals(findMusicGroup(''), null);
  assertEquals(findMusicGroup(null), null);
  assert(isMusicGroupSlug('jazz'));
  assert(!isMusicGroupSlug('jazz; drop table'));
});

Deno.test('music groups: each group can ask both sources for something', () => {
  for (const group of MUSIC_GROUPS) {
    const jamendoAsks = group.kind === 'trending' || group.jamendo.tags || group.jamendo.fuzzytags;
    assert(jamendoAsks, `${group.slug} has no Jamendo query`);
    const audiusAsks =
      group.kind === 'trending' || group.audius.genre || group.audius.mood || group.audius.query;
    assert(audiusAsks, `${group.slug} has no Audius query`);
  }
});
