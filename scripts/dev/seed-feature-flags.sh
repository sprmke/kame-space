#!/usr/bin/env bash
# Insert or remove demo feature-availability overrides.
#
#   ./scripts/dev/seed-feature-flags.sh apply    # disable two features with banners
#   ./scripts/dev/seed-feature-flags.sh remove   # restore everything to enabled
#
# The canonical seed leaves every feature enabled. Apply only when you want to
# test the super-admin toggle UI and the host-facing disabled state.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

MODE="${1:-apply}"
KEYS="'marketing.ai_studio','analytics.ai_review.regenerate'"

if [[ "$MODE" != "apply" && "$MODE" != "remove" ]]; then
  echo "Usage: ./scripts/dev/seed-feature-flags.sh apply|remove" >&2
  exit 1
fi

TMP_SQL="$(mktemp "${TMPDIR:-/tmp}/seed-feature-flags.XXXXXX.sql")"
trap 'rm -f "$TMP_SQL"' EXIT

if [[ "$MODE" == "remove" ]]; then
  cat >"$TMP_SQL" <<SQL
DO \$\$
BEGIN
  DELETE FROM public.feature_availability_overrides WHERE feature_key IN ($KEYS);
  RAISE NOTICE 'Demo feature overrides removed; all features enabled';
END \$\$;
SQL
else
  cat >"$TMP_SQL" <<SQL
DO \$\$
BEGIN
  INSERT INTO public.feature_availability_overrides (
    feature_key, is_enabled, reason, message, expected_back_at, auto_restore,
    show_banner, super_admin_bypass, disabled_at, updated_at
  )
  VALUES (
    'marketing.ai_studio', false, 'coming_soon',
    'AI Studio is paused for a local demo.', NULL, false, true, true, now(), now()
  )
  ON CONFLICT (feature_key) DO UPDATE SET
    is_enabled = EXCLUDED.is_enabled,
    reason = EXCLUDED.reason,
    message = EXCLUDED.message,
    expected_back_at = EXCLUDED.expected_back_at,
    auto_restore = EXCLUDED.auto_restore,
    show_banner = EXCLUDED.show_banner,
    super_admin_bypass = EXCLUDED.super_admin_bypass,
    disabled_at = EXCLUDED.disabled_at,
    updated_at = now();

  INSERT INTO public.feature_availability_overrides (
    feature_key, is_enabled, reason, message, expected_back_at, auto_restore,
    show_banner, super_admin_bypass, disabled_at, updated_at
  )
  VALUES (
    'analytics.ai_review.regenerate', false, 'maintenance',
    'Regeneration is paused while we refresh the model.', now() + interval '2 hours', true,
    true, true, now(), now()
  )
  ON CONFLICT (feature_key) DO UPDATE SET
    is_enabled = EXCLUDED.is_enabled,
    reason = EXCLUDED.reason,
    message = EXCLUDED.message,
    expected_back_at = EXCLUDED.expected_back_at,
    auto_restore = EXCLUDED.auto_restore,
    show_banner = EXCLUDED.show_banner,
    super_admin_bypass = EXCLUDED.super_admin_bypass,
    disabled_at = EXCLUDED.disabled_at,
    updated_at = now();

  RAISE NOTICE 'Demo feature overrides applied (marketing.ai_studio, analytics.ai_review.regenerate)';
END \$\$;
SQL
fi

./scripts/dev/run-with-ui-dev-env.sh ./scripts/dev/bunx --bun supabase@latest db query --local -f "$TMP_SQL"
