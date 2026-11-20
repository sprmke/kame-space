/**
 * Format and join summary-strip segments ("3 action required · 2 pending docs").
 * Pure so list screens and tests share one ruleset.
 */

export type SummaryStripSegment = {
  /** Count shown first (omitted when null/undefined). */
  count?: number | null;
  /** Noun phrase after the count, e.g. "action required". */
  label: string;
  /** Optional filter key the strip caller uses on tap. */
  filterKey?: string;
};

const JOINER = ' · ';

export function formatSummarySegment(segment: SummaryStripSegment): string {
  const label = segment.label.trim();
  if (segment.count == null) return label;
  return `${segment.count} ${label}`;
}

export function formatSummaryStrip(segments: SummaryStripSegment[]): string {
  return segments
    .map(formatSummarySegment)
    .filter((s) => s.length > 0)
    .join(JOINER);
}

/** Soft wrap hint: prefer breaking after the joiner when over `maxChars`. */
export function summaryStripNeedsWrap(segments: SummaryStripSegment[], maxChars = 42): boolean {
  return formatSummaryStrip(segments).length > maxChars;
}
