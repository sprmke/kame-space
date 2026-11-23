/**
 * Analytics section tabs live in the URL (`?section=trends`) so Back, reload and a shared
 * link land on the same tab. `overview` is the default and stays out of the URL.
 */

export const ANALYTICS_SECTIONS = ['overview', 'trends', 'guests', 'ai-review'] as const;

export type AnalyticsSection = (typeof ANALYTICS_SECTIONS)[number];

export const ANALYTICS_SECTION_LABELS: Record<AnalyticsSection, string> = {
  overview: 'Overview',
  trends: 'Trends',
  guests: 'Guests',
  'ai-review': 'AI review',
};

export function isAnalyticsSection(value: string | null | undefined): value is AnalyticsSection {
  return Boolean(value) && (ANALYTICS_SECTIONS as readonly string[]).includes(value as string);
}

export function resolveAnalyticsSection(params: URLSearchParams): AnalyticsSection {
  const raw = params.get('section');
  return isAnalyticsSection(raw) ? raw : 'overview';
}

export function writeAnalyticsSectionParam(
  section: AnalyticsSection,
  base?: URLSearchParams
): URLSearchParams {
  const next = new URLSearchParams(base ?? undefined);
  if (section === 'overview') next.delete('section');
  else next.set('section', section);
  return next;
}

export function analyticsTabId(section: AnalyticsSection): string {
  return `analytics-tab-${section}`;
}

export function analyticsPanelId(section: AnalyticsSection): string {
  return `analytics-panel-${section}`;
}
