#!/usr/bin/env bash
# Start (or reuse) a worktree's local Vite server and open its Orca browser tab.
# Use this for worktrees created before orca.yaml existed, or any time you want
# the preview without recreating the workspace.
#
# Usage:
#   bash scripts/dev/open-worktree-preview.sh [worktree-path] [--split right|left|down|up]
#   bash scripts/dev/open-worktree-preview.sh            # current worktree
#   bash scripts/dev/open-worktree-preview.sh ../cerith  # another worktree
set -euo pipefail

TARGET=""
SPLIT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --split)
      SPLIT="right"
      if [[ -n "${2:-}" && "${2:0:2}" != "--" ]]; then
        SPLIT="$2"
        shift
      fi
      shift
      ;;
    -h|--help)
      sed -n '2,9p' "$0"
      exit 0
      ;;
    *)
      if [[ -z "$TARGET" ]]; then
        TARGET="$1"
        shift
      else
        echo "Unknown argument: $1" >&2
        exit 1
      fi
      ;;
  esac
done

TARGET="$(cd "${TARGET:-$PWD}" && pwd)"
[[ -d "$TARGET/ui" ]] || { echo "Not a worktree root: $TARGET" >&2; exit 1; }

PATH="/usr/local/bin:/opt/homebrew/bin:${HOME}/.bun/bin:${PATH}"
ORCA_BIN="${ORCA_CLI_COMMAND:-$(command -v orca || true)}"
if [[ -z "$ORCA_BIN" ]]; then
  ORCA_BIN="/Applications/Orca.app/Contents/Resources/bin/orca"
fi

PRIMARY="$(dirname "$(git -C "$TARGET" rev-parse --path-format=absolute --git-common-dir)")"

# Env files a worktree needs; copy the primary checkout's copy when missing.
for rel in ui/.env.development ui/.env.development.local ui/.env.development.dev supabase/.env.local; do
  if [[ ! -f "$TARGET/$rel" && -f "$PRIMARY/$rel" ]]; then
    mkdir -p "$TARGET/$(dirname "$rel")"
    cp "$PRIMARY/$rel" "$TARGET/$rel"
    echo "copied $rel from $PRIMARY"
  fi
done

# Dependencies are per worktree.
if [[ ! -x "$TARGET/node_modules/.bin/vite" && ! -x "$TARGET/ui/node_modules/.bin/vite" ]]; then
  echo "Installing dependencies in $TARGET"
  (cd "$TARGET" && bun install)
fi

listener_under_target() {
  local port="$1" pid cwd
  pid="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | head -1 || true)"
  [[ -n "$pid" ]] || return 1
  cwd="$(lsof -a -p "$pid" -d cwd 2>/dev/null | awk 'NR==2 { print $NF; exit }')"
  [[ -n "$cwd" && ( "$cwd" == "$TARGET" || "$cwd" == "$TARGET"/* ) ]]
}

# Prefer the worktree's own launcher: it owns the sticky port and env profiles.
START_CMD=""
if [[ -f "$TARGET/scripts/dev/ui-worktree.sh" ]]; then
  PORT="$(bash "$TARGET/scripts/dev/ui-worktree.sh" --print-port)"
  START_CMD="bash scripts/dev/ui-worktree.sh"
else
  PORT=""
  if [[ -f "$TARGET/.local/vite-port" ]]; then
    candidate="$(tr -d '[:space:]' <"$TARGET/.local/vite-port" || true)"
    if [[ "$candidate" =~ ^[0-9]+$ ]] && ((candidate >= 5173 && candidate <= 5199)); then
      PORT="$candidate"
    fi
  fi
  if [[ -z "$PORT" ]]; then
    hash="$(printf '%s' "$TARGET" | cksum | awk '{ print $1 }')"
    PORT=$((5173 + (hash % 27)))
  fi
  for _ in $(seq 1 27); do
    if ! lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1 || listener_under_target "$PORT"; then
      break
    fi
    PORT=$((PORT + 1))
    ((PORT > 5199)) && PORT=5173
  done
  mkdir -p "$TARGET/.local"
  printf '%s\n' "$PORT" >"$TARGET/.local/vite-port"
  START_CMD="cd ui && ../node_modules/.bin/vite --host 127.0.0.1 --port $PORT --strictPort"
fi

URL="http://127.0.0.1:${PORT}/"

if ! lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Starting UI terminal in $TARGET"
  "$ORCA_BIN" terminal create \
    --worktree "path:$TARGET" \
    --title "UI" \
    --command "$START_CMD" \
    --json >/dev/null
fi

code=000
for _ in $(seq 1 120); do
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 2 "$URL" 2>/dev/null || echo 000)"
  [[ "$code" == "200" ]] && break
  sleep 1
done
if [[ "$code" != "200" ]]; then
  echo "UI did not answer on $URL (last status $code)." >&2
  exit 1
fi

if "$ORCA_BIN" tab list --worktree "path:$TARGET" --json 2>/dev/null | grep -q "\"$URL\""; then
  echo "Preview already open: $URL"
  exit 0
fi

if [[ -n "$SPLIT" ]]; then
  "$ORCA_BIN" tab create --url "$URL" --worktree "path:$TARGET" --split "$SPLIT" --json >/dev/null
else
  "$ORCA_BIN" tab create --url "$URL" --worktree "path:$TARGET" --json >/dev/null
fi
echo "Preview: $URL"
