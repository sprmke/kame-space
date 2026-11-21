#!/usr/bin/env bash
# SessionStart: surface stashes and dirty worktrees so uncommitted work is not forgotten.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

stashes=$(git -C "$ROOT" stash list 2>/dev/null | wc -l | tr -d ' ')
dirty=0
while IFS= read -r wt; do
  [[ -n "$wt" ]] || continue
  [[ -d "$wt" ]] || continue
  if [[ -n "$(git -C "$wt" status --porcelain 2>/dev/null)" ]]; then
    dirty=$((dirty + 1))
  fi
done < <(git -C "$ROOT" worktree list --porcelain 2>/dev/null | awk '/^worktree /{print substr($0,10)}')

if [[ "$stashes" == "0" && "$dirty" == "0" ]]; then
  status="WIP audit: clean (no stashes, no dirty worktrees)."
else
  status="WIP audit: ${stashes} stash(es), ${dirty} dirty worktree(s). Run 'bun run wip:audit' before any cleanup. Preserve work with 'bun run wip:save <name>' (commits to wip/<date>-<name>). Never stash without a branch; alias the stash to a wip/ branch in the same session."
fi

escape_for_json() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  printf '%s' "$s"
}

escaped=$(escape_for_json "$status")
printf '{\n  "additional_context": "%s"\n}\n' "$escaped"
