import { describe, expect, it } from 'vitest';

import { buildDonutPoints, DONUT_MAX_SLICES } from '@/features/dashboard/analytics/lib/donutSlices';

function slice(key: string, count: number) {
  return { key, label: key, count, color: '#000000' };
}

describe('buildDonutPoints', () => {
  it('folds the tail into Others so the legend stays short', () => {
    const points = buildDonutPoints([
      slice('a', 9),
      slice('b', 8),
      slice('c', 7),
      slice('d', 6),
      slice('e', 5),
      slice('f', 4),
      slice('g', 3),
    ]);

    expect(points).toHaveLength(DONUT_MAX_SLICES);
    expect(points.at(-1)?.label).toBe('Others');
    expect(points.at(-1)?.count).toBe(7);
    expect(points.reduce((sum, point) => sum + point.count, 0)).toBe(42);
  });

  it('keeps a short list as-is, ranked by count', () => {
    const points = buildDonutPoints([slice('small', 2), slice('big', 8)]);

    expect(points.map((point) => point.label)).toEqual(['big', 'small']);
    expect(points[0].pct).toBe(80);
    expect(points[1].pct).toBe(20);
  });

  it('drops empty slices and returns nothing for an empty period', () => {
    expect(buildDonutPoints([slice('none', 0)])).toEqual([]);
    expect(buildDonutPoints([])).toEqual([]);
  });

  it('uses the caller colour for the Others row', () => {
    const points = buildDonutPoints([slice('a', 1), slice('b', 1), slice('c', 1)], {
      maxSlices: 2,
      othersColor: '#abcdef',
    });

    expect(points).toHaveLength(2);
    expect(points[1]).toMatchObject({ label: 'Others', color: '#abcdef', count: 2 });
  });
});
