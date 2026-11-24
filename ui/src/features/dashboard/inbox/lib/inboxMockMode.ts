/**
 * Enable inbox UI preview with mock data.
 * - URL: ?mock=true on /org/:slug/property/:propertySlug/messages
 * - Env: VITE_INBOX_MOCK_DATA=true
 */

/**
 * Preview data must never be reachable on the production host: a host who follows a
 * `?mock=true` link would see a fixture inbox that looks real. Local dev, preview
 * deployments and the E2E server keep it.
 */
export function inboxMockHostAllowed(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]' ||
    host.endsWith('.localhost') ||
    host.endsWith('.vercel.app') ||
    host.endsWith('.local')
  );
}

export function isInboxMockMode(): boolean {
  if (import.meta.env.VITE_INBOX_MOCK_DATA === 'true') return true;
  if (typeof window === 'undefined') return false;
  if (!inboxMockHostAllowed(window.location.hostname)) return false;
  return new URLSearchParams(window.location.search).get('mock') === 'true';
}
