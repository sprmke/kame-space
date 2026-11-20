#!/usr/bin/env bash
# Orca worktree setup: install deps and seed local env files from the repo root.
# Does not start Docker. Does not start Vite (defaultTabs runs bun run ui).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

export PATH="/usr/local/bin:/opt/homebrew/bin:${HOME}/.bun/bin:${PATH}"

# Orca sets ORCA_ROOT_PATH (and CONDUCTOR_ROOT_PATH for backcompat) to the main checkout.
SOURCE_ROOT="${ORCA_ROOT_PATH:-${CONDUCTOR_ROOT_PATH:-}}"

copy_if_missing() {
  local rel="$1"
  local dest="$ROOT/$rel"
  local src=""
  if [[ -n "$SOURCE_ROOT" && -f "$SOURCE_ROOT/$rel" ]]; then
    src="$SOURCE_ROOT/$rel"
  fi
  if [[ -f "$dest" ]]; then
    echo "keep $rel"
    return 0
  fi
  if [[ -n "$src" ]]; then
    mkdir -p "$(dirname "$dest")"
    cp "$src" "$dest"
    echo "copied $rel from ORCA_ROOT_PATH"
    return 0
  fi
  echo "missing $rel (create from *.example or copy from main checkout)"
}

echo "Worktree setup in $ROOT"
bun install

copy_if_missing "ui/.env.development"
copy_if_missing "ui/.env.development.local"
copy_if_missing "ui/.env.development.dev"
copy_if_missing "supabase/.env.local"

PORT="$("$ROOT/scripts/dev/ui-worktree.sh" --print-port)"
echo "Sticky UI port for this worktree: $PORT (http://127.0.0.1:${PORT}/)"
echo "Setup complete. Shared Supabase stays on :54321; start it once with ./dev.sh if needed."
