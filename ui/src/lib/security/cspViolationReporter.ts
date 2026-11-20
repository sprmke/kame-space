import { captureAppEvent } from '@/lib/posthog/capture';

/**
 * Reports Content-Security-Policy violations from real visitors (production readiness PR-012).
 *
 * The policy is enforced from `ui/vercel.json`. A blocked request no longer shows up anywhere
 * but the visitor's console, so a new third-party embed or a changed CDN would fail silently.
 * This listens for the browser's `securitypolicyviolation` event and sends one small PostHog
 * event per distinct directive and origin, capped per page load.
 *
 * Privacy: only the blocked **origin** is sent, never a path, query string or sample, because
 * a blocked URL can carry a signed token or a guest id.
 */

const MAX_REPORTS_PER_PAGE = 10;

/** The part of a blocked URI that is safe to keep. */
export function blockedOriginOf(blockedURI: string): string {
  if (!blockedURI) return 'inline';
  if (blockedURI === 'inline' || blockedURI === 'eval' || blockedURI === 'wasm-eval') {
    return blockedURI;
  }
  if (blockedURI.startsWith('data:')) return 'data';
  if (blockedURI.startsWith('blob:')) return 'blob';
  try {
    return new URL(blockedURI).origin;
  } catch {
    return 'unknown';
  }
}

type ViolationLike = Pick<
  SecurityPolicyViolationEvent,
  'effectiveDirective' | 'blockedURI' | 'disposition'
>;

type ReportProperties = { directive: string; blocked: string; disposition: string };

function reportToAnalytics(properties: ReportProperties): void {
  captureAppEvent('csp_violation', properties);
}

export function installCspViolationReporter(
  target: Pick<EventTarget, 'addEventListener'> = document,
  report: (properties: ReportProperties) => void = reportToAnalytics
): void {
  const seen = new Set<string>();

  target.addEventListener('securitypolicyviolation', (event) => {
    if (seen.size >= MAX_REPORTS_PER_PAGE) return;
    const violation = event as unknown as ViolationLike;
    const directive = violation.effectiveDirective || 'unknown';
    const blocked = blockedOriginOf(violation.blockedURI);
    const key = `${directive}|${blocked}`;
    if (seen.has(key)) return;
    seen.add(key);
    report({ directive, blocked, disposition: violation.disposition });
  });
}
