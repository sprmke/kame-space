#!/usr/bin/env bash
# Shared local-dev lifecycle guard for Cursor + Claude Code shell hooks.
# Source this file; do not execute directly.
#
# Local Supabase (project guest-form-management) is shared across Orca worktrees.
# Agent "helpfulness" that stops/restarts the stack is the main cause of flaky
# local dashboards (edge 503, Vite gone, Access denied). Block stop/kill unless
# the user unlocks the command.

LOCAL_DEV_STOP_UNLOCK_WORD="localstop"

local_dev_stop_is_unlocked() {
  local cmd="$1"
  local lower_cmd
  lower_cmd=$(printf '%s' "$cmd" | tr '[:upper:]' '[:lower:]')
  [[ "$lower_cmd" == *"${LOCAL_DEV_STOP_UNLOCK_WORD}"* ]]
}

# Returns 0 when the command should be blocked as a local stack stop/kill/restart.
local_dev_stop_is_blocked() {
  local cmd="$1"

  if local_dev_stop_is_unlocked "$cmd"; then
    return 1
  fi

  # Nuclear clean already has its own ask path; still treat as stop-class.
  case "$cmd" in
    *stop:supabase:clean*)
      return 0
      ;;
    *stop:supabase*)
      return 0
      ;;
    *"supabase stop"*|*"supabase@latest stop"*)
      return 0
      ;;
  esac

  # Killing the UI / stack starter / listeners that keep the session alive.
  case "$cmd" in
    *pkill*vite*|*pkill*dev.sh*|*pkill*"dev\\.sh"*|*pkill*geoduck*)
      return 0
      ;;
    *killall*vite*|*killall*node*)
      return 0
      ;;
    *lsof*5173*kill*|*kill*5173*|*tiTCP:5173*)
      return 0
      ;;
    *docker*stop*supabase_edge*|*docker*rm*supabase_edge*|*docker*kill*supabase_*)
      return 0
      ;;
  esac

  # stop:supabase / supabase stop above already match stop&&start restart compounds.

  return 1
}

local_dev_stop_block_reason() {
  cat <<EOF
Blocked: this command stops or kills the local Kame Space stack (Supabase / Vite / edge).

Local Docker project guest-form-management is shared across Orca worktrees. Agent restarts
are the usual cause of edge 503, a dead Vite server, and false Access denied screens.

Do not stop or restart the local stack while working an item. Prefer diagnosing against
the running stack (curl health, docker ps, logs).

To authorize a stop/kill/restart for this shell command only, the user must explicitly ask
to stop or restart local, then rerun with the unlock word "${LOCAL_DEV_STOP_UNLOCK_WORD}"
in the command (e.g. LOCALSTOP=${LOCAL_DEV_STOP_UNLOCK_WORD} bun run stop:supabase).

Safe without unlock: read-only checks, bun run start:supabase / ./dev.sh only when the user
asked you to start a stack that is already down (do not bounce a healthy stack).
EOF
}
