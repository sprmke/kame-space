const GIT_SHA_RE = /^[0-9a-f]{7,40}$/i;
const SEMVER_CORE_RE = /^v?(\d+)\.(\d+)(?:\.(\d+))?/i;

/**
 * Guest/host-facing product version for Profile / App cards.
 *
 * Telemetry (Sentry / PostHog) still uses the raw release id (`VITE_APP_VERSION`).
 * This helper formats what people see: local stays "Development"; shipped builds
 * show a short marketing version (`1.0`, `2.1`, `1.2.3`) from `package.json`,
 * never a full git SHA.
 */
export function formatAppVersionLabel(
  release: string | undefined,
  marketing?: string | undefined
): string {
  const trimmed = release?.trim();
  if (trimmed === 'local' || trimmed === 'dev') return 'Development';

  const fromMarketing = formatMarketingSemver(marketing);
  if (fromMarketing) return fromMarketing;

  if (!trimmed) return 'Unknown';
  if (GIT_SHA_RE.test(trimmed)) return 'Unknown';

  const fromRelease = formatMarketingSemver(trimmed);
  if (fromRelease) return fromRelease;

  return trimmed;
}

/** `1.0.0` → `1.0`, `2.1.3` → `2.1.3`, `v1.3` → `1.3`. */
export function formatMarketingSemver(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const match = trimmed.match(SEMVER_CORE_RE);
  if (!match) return null;
  const major = match[1];
  const minor = match[2];
  const patch = match[3];
  if (patch && patch !== '0') return `${major}.${minor}.${patch}`;
  return `${major}.${minor}`;
}
