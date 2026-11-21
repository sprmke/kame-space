#!/usr/bin/env bash
# Shared WIP-preservation guard for Cursor, Claude Code and OpenCode shell hooks.
# Source this file; do not execute directly.
#
# Purpose: uncommitted work must never be destroyed by a stash, hard reset,
# branch force-delete or forced worktree removal. The safe path is
# `bun run wip:save <slug>`, which commits the changes to a named WIP branch.

WIP_UNLOCK_WORD="wipsafe"

wip_is_unlocked() {
  local cmd="$1"
  local lower
  lower=$(printf '%s' "$cmd" | tr '[:upper:]' '[:lower:]')
  [[ "$lower" == *"${WIP_UNLOCK_WORD}"* ]] && return 0
  [[ "$cmd" == *"WIP_PRESERVED=1"* ]] && return 0
  return 1
}

wip_git_dir_ok() {
  local dir="$1"
  command -v git >/dev/null 2>&1 || return 1
  [[ -n "$dir" ]] || return 1
  git -C "$dir" rev-parse --git-dir >/dev/null 2>&1
}

wip_tree_dirty() {
  local dir="$1"
  wip_git_dir_ok "$dir" || return 1
  [[ -n "$(git -C "$dir" status --porcelain 2>/dev/null)" ]]
}

wip_any_worktree_dirty() {
  local dir="$1"
  local path=""
  wip_git_dir_ok "$dir" || return 1
  while IFS= read -r line; do
    case "$line" in
      "worktree "*)
        path="${line#worktree }"
        if wip_tree_dirty "$path"; then
          return 0
        fi
        ;;
    esac
  done < <(git -C "$dir" worktree list --porcelain 2>/dev/null)
  return 1
}

wip_command_dir() {
  local cmd="$1" fallback="$2"
  if [[ "$cmd" =~ git[[:space:]]+-C[[:space:]]+([^[:space:]]+) ]]; then
    local p="${BASH_REMATCH[1]}"
    p="${p%\"}"; p="${p#\"}"; p="${p%\'}"; p="${p#\'}"
    printf '%s' "$p"
    return 0
  fi
  printf '%s' "$fallback"
}

wip_guard_is_blocked() {
  local cmd="$1" cwd="$2"
  wip_is_unlocked "$cmd" && return 1

  local dir
  dir=$(wip_command_dir "$cmd" "$cwd")

  # Read-only stash inspection and restore are always allowed.
  case "$cmd" in
    *"stash list"*|*"stash show"*|*"stash pop"*|*"stash apply"*|*"stash branch"*)
      return 1
      ;;
  esac

  # Destroying stash commits is never allowed without the override.
  case "$cmd" in
    *"stash drop"*|*"stash clear"*)
      return 0
      ;;
  esac

  # Plain `git stash` / push / save, hard reset, and aggressive clean destroy
  # the current working tree.
  case "$cmd" in
    *"git stash"*|*"git stash push"*|*"git stash save"*|*"reset --hard"*|*"clean -fd"*|*"clean -fdx"*|*"clean -xdf"*|*"checkout -f"*)
      if wip_tree_dirty "$dir"; then
        return 0
      fi
      return 1
      ;;
  esac

  # Deleting a branch can orphan a dirty worktree checked out on it.
  case "$cmd" in
    *"branch -D"*|*"branch --delete --force"*)
      if wip_any_worktree_dirty "$dir"; then
        return 0
      fi
      return 1
      ;;
  esac

  # Forced worktree removal can discard uncommitted work in that worktree.
  case "$cmd" in
    *"worktree remove"*"--force"*|*"worktree remove"*"-f "*)
      if wip_tree_dirty "$dir"; then
        return 0
      fi
      return 1
      ;;
  esac

  return 1
}

wip_guard_reason() {
  cat <<EOF
Blocked: this command can destroy uncommitted work.

Preserve it first, then rerun the command:

  bun run wip:save <short-name>     # commits the changes to wip/<date>-<short-name>
  bun run wip:audit                 # lists stashes and dirty worktrees

Never use a stash as storage. If a stash is unavoidable, mirror it to a branch
in the same session with \`git stash branch wip/<date>-<name> 'stash@{0}'\`.

Owner override for this one command: include ${WIP_UNLOCK_WORD} (or WIP_PRESERVED=1).
EOF
}
