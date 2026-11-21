#!/usr/bin/env bash
# Preserve the current working tree on a named WIP branch, then return to the
# original branch so work can continue or the branch/worktree can be closed.
#
# Usage: bun run wip:save <short-name>
#        bash scripts/dev/wip-save.sh <short-name>

set -euo pipefail

raw_slug="${1:-wip}"
slug=$(printf '%s' "$raw_slug" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]\+/-/g; s/^-//; s/-$//')
[[ -n "$slug" ]] || slug="wip"

root=$(git rev-parse --show-toplevel)
cd "$root"

if [[ -n "$(git status --porcelain)" ]]; then
  if [[ -f "$(git rev-parse --git-dir)/MERGE_HEAD" ]]; then
    echo "Refusing: a merge is in progress. Finish or abort the merge first." >&2
    exit 1
  fi
  if [[ -d "$(git rev-parse --git-dir)/rebase-merge" || -d "$(git rev-parse --git-dir)/rebase-apply" ]]; then
    echo "Refusing: a rebase is in progress. Finish or abort the rebase first." >&2
    exit 1
  fi
else
  echo "Nothing to save: the working tree is clean."
  exit 0
fi

original=$(git symbolic-ref --short -q HEAD || true)
stamp=$(date +%Y%m%d-%H%M%S)
branch="wip/${stamp}-${slug}"

git checkout -b "$branch"
git add -A
git commit -m "wip: preserve ${raw_slug} (${stamp})"

echo
echo "Preserved on ${branch}"
echo "  $(git rev-parse --short HEAD) $(git log -1 --format=%s)"

if [[ -n "$original" ]]; then
  git checkout "$original"
  echo "Returned to ${original}. The changes now live on ${branch}."
else
  echo "You were on a detached HEAD, so the WIP branch stays checked out."
fi

echo
echo "Restore later with: git checkout ${branch}"
echo "Delete only after the work is merged: git branch -d ${branch}"
