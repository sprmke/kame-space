#!/usr/bin/env bash
# Production deploy gate — the last check before cd-prod touches the live project.
#
# Why this is not `ci-quality-gate.sh` any more:
#
# `develop` is protected, and the required `quality` check on a PR already runs the full
# Playwright `@smoke` (3 viewports) and `@ci` (4 shards) suites. Re-running both inside the
# deploy job added 31 minutes to every backend deploy for no extra signal — measured on run
# 42529655784: smoke 12.2 min + @ci 18.9 min of a 39.3 min gate.
#
# What still runs here, and why:
#   - every static guard (seconds, catches config and convention drift);
#   - type-check, lint, unit + coverage floor, edge unit and handler tests (fast, high signal);
#   - the production build and its budgets (the artifact we are about to ship);
#   - the `@critical` journeys on desktop: guest intake, booking transitions, cancellation,
#     parking request, auth/tenancy redirects, RBAC, plan gates, feature kill switches.
#
# What does not, and where it is covered:
#   - full `@smoke` on 3 viewports and `@ci`: required status check on every PR to `develop`.
#   - `@live` against a real stack: manual/nightly, never a deploy gate.
#
# If you need full parity before a deploy, run `bun run ci:quality` locally.
#
# Usage: ./scripts/dev/ci-deploy-gate.sh [--skip-install]

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

SKIP_INSTALL=0
if [[ "${1:-}" == "--skip-install" ]]; then
  SKIP_INSTALL=1
fi

echo "=== Deploy gate (static + logic + build + @critical journeys) ==="

if [[ "$SKIP_INSTALL" -eq 0 ]]; then
  echo "→ bun install --frozen-lockfile"
  bun install --frozen-lockfile
fi

run_step() {
  local label="$1"
  shift
  echo ""
  echo "→ $label"
  "$@"
}

# --- static guards: seconds each, and they guard the artifact we are about to ship ---
run_step "check:filenames" bun run check:filenames
run_step "playwright lane tags" node scripts/dev/check-e2e-lane-tags.mjs
run_step "flaky quarantine discipline" node scripts/dev/check-flaky-quarantine.mjs
run_step "unit test quality" node scripts/dev/check-unit-test-quality.mjs
run_step "edge handler coverage ratchet" node scripts/dev/check-edge-test-coverage.mjs
run_step "route guides point at real specs" node scripts/dev/check-guide-spec-refs.mjs
run_step "migration versions do not collide" bash scripts/dev/check-migration-version-collisions.sh
run_step "brand guard" bun scripts/brand/check-brand.ts --check
run_step "support content" bash -c 'bun run check:ai-knowledge-coverage && bun run check:support-content'
run_step "migration versions and security" bash -c \
  'bash scripts/dev/check-migration-versions.sh && bash scripts/dev/check-migration-security.sh'
run_step "servePublic rate-limit coverage" bash scripts/dev/check-serve-public-rate-limit.sh
run_step "authenticated wrapper rate check" bash scripts/dev/check-authenticated-rate-limit.sh
run_step "unbounded query guard" bash scripts/dev/check-unbounded-select.sh
run_step "posthog is analytics only" bash scripts/dev/check-posthog-analytics-only.sh
run_step "sentry import surface" bash scripts/dev/check-sentry-imports.sh
run_step "cache class guard" bash scripts/dev/check-cache-class.sh
run_step "select('*') guard" bash scripts/dev/check-select-star.sh
run_step "public static asset size" bash scripts/dev/check-public-asset-size.sh
run_step "vercel cache and security headers" bash scripts/dev/check-vercel-headers.sh
run_step "CSP theme script hash" bash scripts/dev/check-csp-theme-hash.sh
run_step "storage upload cacheControl" node scripts/dev/check-storage-cache-control.mjs
run_step "edge serve-wrapper allowlist" node scripts/dev/audit-edge-functions.mjs --check
run_step "AI gateway guard" node scripts/dev/check-ai-gateway.mjs
run_step "auth matrix" node scripts/dev/audit-auth-matrix.mjs --check

# --- logic: types, lint, unit with the coverage floor in ONE run ---
# `test:coverage:lib` runs the whole unit suite; running `test` first as well was a
# duplicate 1.4 min on every deploy.
run_step "type-check" bun run type-check
run_step "lint (errors block CD)" bun run lint
run_step "unit tests + coverage floor" bun run test:coverage:lib
run_step "dom tests (component/hook)" bun run test:dom
run_step "edge type check (Deno)" bun run check:edge-types
run_step "edge unit tests (Deno _shared)" bun run test:edge
run_step "edge handler tests (Deno)" bun run test:edge:handlers

# --- the artifact we are about to ship ---
run_step "build UI" bun run build
run_step "assert image optimizer stays lazy" node scripts/media/assert-lazy-optimizer.mjs
run_step "bundle budgets + chunk graph" bun run check:budgets
run_step "no public source maps" node scripts/performance/assert-no-sourcemaps.mjs
run_step "no render-blocking scripts" node scripts/performance/assert-no-blocking-scripts.mjs

# --- critical journeys: money, tenancy, workflow. Desktop only by design. ---
run_step "playwright @critical journeys (desktop)" bun run test:e2e:critical

echo ""
echo "OK — deploy gate passed."
