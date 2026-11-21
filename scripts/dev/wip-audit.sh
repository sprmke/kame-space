#!/usr/bin/env bash
# Read-only audit of uncommitted work: stashes and dirty worktrees.
#
# Usage: bun run wip:audit
#        bash scripts/dev/wip-audit.sh [--strict]
#
# Exit 1 with --strict when anything is found, so a cleanup step can gate on it.

set -uo pipefail

strict=0
[[ "${1:-}" == "--strict" ]] && strict=1

root=$(git rev-parse --show-toplevel)
cd "$root"

found=0

echo "Repository: $root"
echo

echo "== Stashes =="
stash_lines=$(git stash list --format='%gd|%ci|%gs' 2>/dev/null || true)
if [[ -z "$stash_lines" ]]; then
  echo "  none"
else
  while IFS='|' read -r ref date subject; do
    [[ -n "$ref" ]] || continue
    files=$(git stash show --name-only "$ref" 2>/dev/null | wc -l | tr -d ' ')
    printf '  %-12s %s  %s files  %s\n' "$ref" "$date" "$files" "$subject"
    found=1
  done <<< "$stash_lines"
fi
echo

echo "== Worktrees with uncommitted changes =="
path=""
branch=""
dirty_any=0
flush_worktree() {
  if [[ -n "$path" ]] && [[ -d "$path" ]]; then
    local count
    count=$(git -C "$path" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
    if [[ "$count" -gt 0 ]]; then
      printf '  %s  [%s]  %s files\n' "$path" "${branch:-detached}" "$count"
      git -C "$path" status --porcelain 2>/dev/null | head -5 | sed 's/^/      /'
      dirty_any=1
    fi
  fi
  path=""
  branch=""
}

while IFS= read -r line; do
  case "$line" in
    "worktree "*) flush_worktree; path="${line#worktree }" ;;
    "branch refs/heads/"*) branch="${line#branch refs/heads/}" ;;
    "detached") branch="(detached)" ;;
    "") flush_worktree ;;
  esac
done < <(git worktree list --porcelain 2>/dev/null; printf '\n')
flush_worktree

if [[ "$dirty_any" -eq 0 ]]; then
  echo "  none"
else
  found=1
fi
echo

echo "== Reminder =="
echo "  Preserve changes before stashing or closing a branch/worktree:"
echo "    bun run wip:save <short-name>"
echo "  A stash is not storage. Mirror it to a wip/ branch in the same session."
echo

if [[ "$strict" -eq 1 && "$found" -eq 1 ]]; then
  echo "STRICT: uncommitted work or stashes found. Preserve before cleanup." >&2
  exit 1
fi

exit 0
