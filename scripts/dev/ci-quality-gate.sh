#!/usr/bin/env bash
# CI parity — same checks as .github/workflows/ci.yml and cd-dev.yml quality job.
# Run before batch-commit sessions and before pushing to develop/main.
#
# Usage:
#   bun run ci:quality
#   ./scripts/dev/ci-quality-gate.sh
#   ./scripts/dev/ci-quality-gate.sh --skip-install   # when deps already installed

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

SKIP_INSTALL=0
if [[ "${1:-}" == "--skip-install" ]]; then
  SKIP_INSTALL=1
fi

echo "=== CI quality gate (matches GitHub Actions ci.yml + cd-dev quality) ==="

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

run_step "type-check" bun run type-check
# Merge/deploy blocking runs in CI (.github/workflows/ci.yml `merge-guard` job and
# cd-prod.yml), not here: it intentionally fails on the guarded feature branch.
run_step "merge guard self-test" node scripts/dev/check-merge-guard.mjs --self-test
run_step "residence profile edge/UI drift" node scripts/dev/check-residence-profile-drift.mjs
run_step "residence profile snapshot" bun scripts/dev/residence-profile-snapshots.ts --check
run_step "Azure golden set (settings, guest form, PDF fields, emails, titles)" bun run check:azure-golden
run_step "lint (ESLint errors block CD — warnings OK)" bun run lint
run_step "check:filenames" bun run check:filenames
run_step "brand guard (retired product name)" bun scripts/brand/check-brand.ts --check
run_step "AI knowledge coverage" bun run check:ai-knowledge-coverage
run_step "support content format" bun run check:support-content
run_step "support content parser tests" bun run test:support-content
run_step "seo route registry" bun run check:seo-routes
run_step "migration versions" bash scripts/dev/check-migration-versions.sh
run_step "migration security" bash scripts/dev/check-migration-security.sh
run_step "local seed identity" node scripts/dev/check-seed-identity.mjs
# `test:coverage:lib` runs the whole unit suite (node project) and enforces the floor, so a
# separate `bun run test` here was a duplicate pass. The dom project is not covered by v8.
run_step "unit tests + coverage floor (Vitest)" bun run test:coverage:lib
run_step "dom tests (component/hook)" bun run test:dom
run_step "edge type check (Deno)" bun run check:edge-types
run_step "edge unit tests (Deno _shared)" bun run test:edge
run_step "servePublic rate-limit coverage" bash scripts/dev/check-serve-public-rate-limit.sh
run_step "authenticated wrapper log-only rate check" bash scripts/dev/check-authenticated-rate-limit.sh
run_step "unbounded query guard" bash scripts/dev/check-unbounded-select.sh
run_step "posthog is analytics only (observability split P1)" \
  bash scripts/dev/check-posthog-analytics-only.sh
run_step "sentry has one import surface" bash scripts/dev/check-sentry-imports.sh
run_step "cache class guard" bash scripts/dev/check-cache-class.sh
run_step "select('*') guard" bash scripts/dev/check-select-star.sh
run_step "public static asset size" bash scripts/dev/check-public-asset-size.sh
run_step "e2e auth storage key (one definition)" node scripts/dev/check-e2e-auth-key.mjs
run_step "page coverage manifests" bun scripts/dev/check-test-coverage.ts
run_step "playwright lane tags (one tag per spec)" node scripts/dev/check-e2e-lane-tags.mjs
run_step "flaky quarantine discipline" node scripts/dev/check-flaky-quarantine.mjs
run_step "unit test quality (no new export-only tests)" node scripts/dev/check-unit-test-quality.mjs
run_step "edge handler coverage ratchet" node scripts/dev/check-edge-test-coverage.mjs
run_step "route guides point at real specs" node scripts/dev/check-guide-spec-refs.mjs
run_step "migration versions do not collide" bash scripts/dev/check-migration-version-collisions.sh
run_step "vercel cache/security headers" bash scripts/dev/check-vercel-headers.sh
run_step "CSP theme script hash (production-readiness doc 22)" bash scripts/dev/check-csp-theme-hash.sh
run_step "storage upload cacheControl" node scripts/dev/check-storage-cache-control.mjs
run_step "edge serve-wrapper allowlist" node scripts/dev/audit-edge-functions.mjs --check
run_step "AI gateway guard" node scripts/dev/check-ai-gateway.mjs
run_step "auth matrix — zero-authz-signal guard (production-readiness doc 21)" \
  node scripts/dev/audit-auth-matrix.mjs --check
run_step "edge handler tests (Deno)" bun run test:edge:handlers
run_step "playwright smoke (@smoke)" bun run test:e2e:smoke
run_step "playwright page and journey specs (@ci)" bun run test:e2e:ci
run_step "build UI" bun run build
run_step "assert image optimizer stays lazy (plan §10.6)" \
  node scripts/media/assert-lazy-optimizer.mjs
run_step "bundle budgets + chunk-graph leak check (production-readiness doc 00/01)" \
  bun run check:budgets
run_step "landing chunk is module-preloaded (app-speed 2.1)" \
  bun run check:landing-preload
run_step "no public source maps (production-readiness doc 02)" \
  node scripts/performance/assert-no-sourcemaps.mjs
run_step "no render-blocking scripts in index.html (production-readiness doc 04)" \
  node scripts/performance/assert-no-blocking-scripts.mjs

echo ""
echo "OK — quality gate passed (safe to push for CI/CD quality job)."
