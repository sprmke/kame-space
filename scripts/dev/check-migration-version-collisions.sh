#!/usr/bin/env bash
# A migration version must mean exactly one file, in the branch AND in its base.
#
# Supabase records only the version number in `supabase_migrations.schema_migrations`.
# If two different files share a version, whichever deploys first wins and the other's DDL
# is silently treated as already applied, on every later deploy. Nothing in the database
# tells you it happened.
#
# This compares the branch against its base branch, which is the only place the collision
# can be caught before it reaches production.
#
# Portable to bash 3.2 (macOS): no associative arrays.
#
# Usage:
#   ./scripts/dev/check-migration-version-collisions.sh
#   MIGRATION_BASE_REF=origin/main ./scripts/dev/check-migration-version-collisions.sh
#   ./scripts/dev/check-migration-version-collisions.sh --base origin/develop --head origin/my-branch
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

BASE="${MIGRATION_BASE_REF:-origin/develop}"
HEAD_REF=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base) BASE="$2"; shift 2 ;;
    --head) HEAD_REF="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 1 ;;
  esac
done

# A shallow CI checkout may not have the base ref yet.
if ! git rev-parse --verify --quiet "$BASE" >/dev/null; then
  base_branch="${BASE#origin/}"
  git fetch --no-tags --depth=1 origin "$base_branch" >/dev/null 2>&1 || true
fi

if ! git rev-parse --verify --quiet "$BASE" >/dev/null; then
  echo "migration versions: cannot resolve $BASE, skipping the cross-branch check." >&2
  exit 0
fi

list_ref() {
  git ls-tree --name-only "$1" supabase/migrations/ 2>/dev/null || true
}

list_head() {
  if [[ -n "$HEAD_REF" ]]; then
    list_ref "$HEAD_REF"
  else
    ls supabase/migrations/*.sql 2>/dev/null || true
  fi
}

{
  list_ref "$BASE" | while IFS= read -r file; do
    [[ -n "$file" ]] || continue
    base_name="$(basename "$file")"
    version="${base_name%%_*}"
    [[ "$version" =~ ^[0-9]+$ ]] || continue
    printf 'B\t%s\t%s\n' "$version" "$base_name"
  done

  list_head | while IFS= read -r file; do
    [[ -n "$file" ]] || continue
    name="$(basename "$file")"
    version="${name%%_*}"
    [[ "$version" =~ ^[0-9]+$ ]] || continue
    printf 'H\t%s\t%s\n' "$version" "$name"
  done
} | awk -F'\t' -v base="$BASE" '
  $1 == "B" { base_name[$2] = $3; next }
  $1 == "H" {
    version = $2
    name = $3
    if ((version in seen) && seen[version] != name) {
      printf "VIOLATION: version %s is used by two files: %s and %s\n", version, seen[version], name
      problems++
    }
    seen[version] = name
    if ((version in base_name) && base_name[version] != name) {
      printf "VIOLATION: version %s already means %s on %s, but this branch has %s\n", version, base_name[version], base, name
      problems++
    }
    total++
  }
  END {
    if (problems > 0) {
      printf "\nRename the new migration to a free timestamp (date -u +%%Y%%m%%d%%H%%M%%S).\n"
      printf "Supabase records only the version, so a duplicate means one file never runs.\n"
      exit 1
    }
    printf "migration versions: %d versions, no collision with %s.\n", total, base
  }
'
