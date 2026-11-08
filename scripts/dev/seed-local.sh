#!/usr/bin/env bash
# Apply the canonical local seed to the running local Supabase database.
#
#   ./scripts/dev/seed-local.sh            # apply, then verify
#   ./scripts/dev/seed-local.sh refresh    # purge seed rows first, then apply
#   ./scripts/dev/seed-local.sh verify     # verify only
#
# Never talks to a hosted project: every command is `--local`.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

MODE="${1:-apply}"
SEED_DIR="scripts/dev/seed"

run_sql() {
  local file="$1"
  echo "→ $file"
  ./scripts/dev/run-with-ui-dev-env.sh ./scripts/dev/bunx --bun supabase@latest db query --local -f "$file"
}

if [[ "$MODE" == "verify" ]]; then
  run_sql "$SEED_DIR/99-verify.sql"
  exit 0
fi

if [[ "$MODE" == "refresh" ]]; then
  run_sql "$SEED_DIR/98-purge-local-seed.sql"
elif [[ "$MODE" != "apply" ]]; then
  echo "Unknown mode: $MODE (use apply, refresh, or verify)" >&2
  exit 1
fi

for file in "$SEED_DIR"/*.sql; do
  case "$file" in
    *98-purge-local-seed.sql|*99-verify.sql) continue ;;
  esac
  run_sql "$file"
done

run_sql "$SEED_DIR/99-verify.sql"
