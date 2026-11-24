import { describe, expect, it } from 'vitest';

import { MUSIC_GROUPS, DEFAULT_MUSIC_GROUP } from './musicTypes';
import { MUSIC_GROUPS as SERVER_GROUPS } from '../../../../../../../supabase/functions/_shared/musicGroups';

describe('music groups: UI mirrors the server list', () => {
  it('has the same slugs, labels and kinds in the same order', () => {
    expect(MUSIC_GROUPS.map(({ slug, label, kind }) => ({ slug, label, kind }))).toEqual(
      SERVER_GROUPS.map(({ slug, label, kind }) => ({ slug, label, kind }))
    );
  });

  it('defaults to a group the server knows', () => {
    expect(SERVER_GROUPS.some((g) => g.slug === DEFAULT_MUSIC_GROUP)).toBe(true);
  });
});
