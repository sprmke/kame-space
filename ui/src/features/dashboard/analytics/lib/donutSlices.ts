export type DonutSlice = {
  key: string;
  label: string;
  count: number;
  color: string;
};

export type DonutPoint = DonutSlice & { pct: number };

/** Visible legend rows (and ring slices). The tail is folded into "Others". */
export const DONUT_MAX_SLICES = 6;

/**
 * Rank slices, fold the tail into a single "Others" row, and compute integer shares.
 * Both the ring and the legend read from this list, so the visible numbers always match.
 */
export function buildDonutPoints(
  slices: DonutSlice[],
  options: { maxSlices?: number; othersColor?: string } = {}
): DonutPoint[] {
  const maxSlices = Math.max(2, options.maxSlices ?? DONUT_MAX_SLICES);
  const sorted = slices.filter((slice) => slice.count > 0).sort((a, b) => b.count - a.count);

  const visible: DonutSlice[] =
    sorted.length > maxSlices
      ? [
          ...sorted.slice(0, maxSlices - 1),
          {
            key: 'others',
            label: 'Others',
            count: sorted.slice(maxSlices - 1).reduce((sum, slice) => sum + slice.count, 0),
            color: options.othersColor ?? '#64748b',
          },
        ]
      : sorted;

  const total = visible.reduce((sum, slice) => sum + slice.count, 0);
  return visible.map((slice) => ({
    ...slice,
    pct: total > 0 ? Math.round((slice.count / total) * 100) : 0,
  }));
}
