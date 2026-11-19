#!/usr/bin/env bash
# Stop only this worktree's Vite UI. Never touches shared Docker / Supabase.
# Used by orca.yaml scripts.archive.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT_FILE="$ROOT/.local/vite-port"
PORT_MIN=5173
PORT_MAX=5199

if [[ ! -f "$PORT_FILE" ]]; then
  echo "No .local/vite-port for this worktree; nothing to stop."
  exit 0
fi

PORT="$(tr -d '[:space:]' <"$PORT_FILE" || true)"
if [[ ! "$PORT" =~ ^[0-9]+$ ]] || ((PORT < PORT_MIN || PORT > PORT_MAX)); then
  echo "Invalid sticky port in .local/vite-port; leaving processes alone."
  exit 0
fi

pids="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null || true)"
if [[ -z "$pids" ]]; then
  echo "No listener on :$PORT."
  exit 0
fi

stopped=0
for pid in $pids; do
  cwd="$(lsof -a -p "$pid" -d cwd 2>/dev/null | awk 'NR==2 { print $NF; exit }')"
  if [[ -n "$cwd" && ( "$cwd" == "$ROOT" || "$cwd" == "$ROOT"/* ) ]]; then
    echo "Stopping worktree UI pid $pid on :$PORT (cwd $cwd)"
    kill "$pid" 2>/dev/null || true
    stopped=1
  else
    echo "Listener pid $pid on :$PORT belongs to another cwd ($cwd); not killing."
  fi
done

if [[ "$stopped" == "1" ]]; then
  echo "Stopped UI for this worktree."
else
  echo "No UI process owned by this worktree on :$PORT."
fi
