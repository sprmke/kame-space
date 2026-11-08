import type { AnalyticsAppTrack, AnalyticsEnvironment } from '@/lib/posthog/types';

export function detectAnalyticsEnvironment(): AnalyticsEnvironment {
  if (import.meta.env.DEV) return 'local';
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  // A production build served locally (`vite preview`, a Playwright run) is still local.
  // Tagging it "production" sends test traffic into the real project.
  if (isLoopbackHost(host)) return 'local';
  if (host.includes('dev.kamespace.com') || host.includes('vercel.app')) return 'preview';
  return 'production';
}

/** `localhost`, `127.0.0.1`, `[::1]`, and mDNS `*.local` names are developer machines. */
export function isLoopbackHost(host: string): boolean {
  const normalized = host
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '');
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local')
  );
}

/** Multi-tenant track — legacy prod uses `legacy` when explicitly flagged. */
export function detectAppTrack(): AnalyticsAppTrack {
  const flag = (import.meta.env.VITE_APP_TRACK as string | undefined)?.trim().toLowerCase();
  if (flag === 'legacy') return 'legacy';
  return 'mt';
}

export function resolvePostHogApiHost(): string | undefined {
  const ingestPath = (import.meta.env.VITE_POSTHOG_INGEST_PATH as string | undefined)?.trim();
  const absoluteHost = (import.meta.env.VITE_POSTHOG_HOST as string | undefined)?.trim();
  if (import.meta.env.PROD && ingestPath) return ingestPath;
  return absoluteHost;
}
