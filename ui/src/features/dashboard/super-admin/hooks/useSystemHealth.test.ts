import { describe, expect, it } from 'vitest';

import { dedupeByKey } from '@/features/dashboard/super-admin/hooks/useSystemHealth';

describe('dedupeByKey', () => {
  it('keeps the first item for each key', () => {
    const rows = [
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
      { id: 'a', value: 3 },
    ];
    expect(dedupeByKey(rows, (row) => row.id)).toEqual([
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
    ]);
  });

  it('returns an empty array for empty input', () => {
    expect(dedupeByKey([], (row: { id: string }) => row.id)).toEqual([]);
  });

  it('preserves order otherwise', () => {
    const rows = [{ id: 'z' }, { id: 'a' }, { id: 'm' }];
    expect(dedupeByKey(rows, (row) => row.id).map((row) => row.id)).toEqual(['z', 'a', 'm']);
  });
});
