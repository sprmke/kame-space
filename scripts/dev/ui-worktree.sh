#!/usr/bin/env bash
# Per-worktree Vite UI on a sticky local port (5173-5199).
# Shares one Docker Supabase stack (guest-form-management on :54321).
#
# Usage:
#   bun run ui
#   ./scripts/dev/ui-worktree.sh
#   ./scripts/dev/ui-worktree.sh --env local
#   ./scripts/dev/ui-worktree.sh --env dev
#   ./scripts/dev/ui-worktree.sh --print-port   # resolve/print sticky port only
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

export PATH="/usr/local/bin:/opt/homebrew/bin:${HOME}/.bun/bin:${PATH}"

PORT_MIN=5173
PORT_MAX=5199
LOCAL_DIR="$ROOT/.local"
PORT_FILE="$LOCAL_DIR/vite-port"

ENV_PROFILE=""
PRINT_PORT_ONLY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      ENV_PROFILE="${2:?--env requires local or dev}"
      shift 2
      ;;
    --print-port)
      PRINT_PORT_ONLY=1
      shift
      ;;
    -h|--help)
      sed -n '2,11p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

mkdir -p "$LOCAL_DIR"

port_listening() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

listener_pid() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | head -1 || true
}

# True when the process listening on $1 has cwd under this worktree.
listener_is_ours() {
  local port="$1"
  local pid cwd
  pid="$(listener_pid "$port")"
  [[ -n "$pid" ]] || return 1
  cwd="$(lsof -a -p "$pid" -d cwd 2>/dev/null | awk 'NR==2 { print $NF; exit }')"
  [[ -n "$cwd" ]] || return 1
  [[ "$cwd" == "$ROOT" || "$cwd" == "$ROOT"/* ]]
}

preferred_port() {
  local hash
  hash="$(printf '%s' "$ROOT" | cksum | awk '{ print $1 }')"
  echo $((PORT_MIN + (hash % (PORT_MAX - PORT_MIN + 1))))
}

# Pick a sticky free port for this worktree. Reuse .local/vite-port when possible.
resolve_port() {
  local preferred candidate tried
  preferred="$(preferred_port)"

  if [[ -f "$PORT_FILE" ]]; then
    candidate="$(tr -d '[:space:]' <"$PORT_FILE" || true)"
    if [[ "$candidate" =~ ^[0-9]+$ ]] &&
      ((candidate >= PORT_MIN && candidate <= PORT_MAX)); then
      if ! port_listening "$candidate" || listener_is_ours "$candidate"; then
        echo "$candidate"
        return 0
      fi
    fi
  fi

  candidate="$preferred"
  tried=0
  while ((tried <= PORT_MAX - PORT_MIN)); do
    if ! port_listening "$candidate" || listener_is_ours "$candidate"; then
      echo "$candidate"
      return 0
    fi
    candidate=$((candidate + 1))
    if ((candidate > PORT_MAX)); then
      candidate=$PORT_MIN
    fi
    tried=$((tried + 1))
  done

  echo "ERROR: no free Vite port in ${PORT_MIN}-${PORT_MAX}" >&2
  return 1
}

PORT="$(resolve_port)"
printf '%s\n' "$PORT" >"$PORT_FILE"

if [[ "$PRINT_PORT_ONLY" == "1" ]]; then
  echo "$PORT"
  exit 0
fi

if port_listening "$PORT" && listener_is_ours "$PORT"; then
  echo "UI already running for this worktree."
  echo "Local: http://127.0.0.1:${PORT}/"
  exit 0
fi

health_code="$(
  curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 1 --max-time 2 \
    'http://127.0.0.1:54321/functions/v1/get-health' 2>/dev/null || echo '000'
)"
if [[ "$health_code" != "200" ]]; then
  echo "Shared local Supabase edge get-health: ${health_code} (expected 200)."
  echo "  Start the shared stack once from any worktree: ./dev.sh"
  echo "  Or UI against hosted: bun run ui -- --env dev"
  echo "  Continuing UI startup anyway (API calls will fail until the stack is up)."
fi

echo "Worktree UI port ${PORT} (sticky in .local/vite-port)"
echo "Local: http://127.0.0.1:${PORT}/"

resolve_vite() {
  if [[ -x "$ROOT/node_modules/.bin/vite" ]]; then
    echo "$ROOT/node_modules/.bin/vite"
  elif [[ -x "$ROOT/ui/node_modules/.bin/vite" ]]; then
    echo "$ROOT/ui/node_modules/.bin/vite"
  else
    echo ""
  fi
}

VITE_BIN="$(resolve_vite)"
if [[ -z "$VITE_BIN" ]]; then
  # Orca starts defaultTabs in parallel with scripts.setup, so a fresh worktree can
  # reach this point before `bun install` finishes. Wait for setup instead of failing.
  echo "Waiting for setup to install dependencies..."
  for _ in $(seq 1 180); do
    VITE_BIN="$(resolve_vite)"
    [[ -n "$VITE_BIN" ]] && break
    sleep 1
  done
fi

if [[ -z "$VITE_BIN" ]]; then
  echo "Dependencies missing; running bun install..."
  bun install
  VITE_BIN="$(resolve_vite)"
fi

if [[ -z "$VITE_BIN" ]]; then
  echo "ERROR: vite not found after bun install." >&2
  exit 1
fi

# Setup copies env files after bun install; give it a moment so Vite reads them.
if [[ ! -f "$ROOT/ui/.env.development" ]]; then
  for _ in $(seq 1 5); do
    [[ -f "$ROOT/ui/.env.development" ]] && break
    sleep 1
  done
fi

case "$ENV_PROFILE" in
  "")
    cd "$ROOT/ui"
    exec "$VITE_BIN" --host 127.0.0.1 --port "$PORT" --strictPort
    ;;
  local)
    if [[ ! -f "$ROOT/ui/.env.development.local" ]]; then
      echo "Missing ui/.env.development.local" >&2
      echo "Copy ui/.env.development.local.example → ui/.env.development.local" >&2
      exit 1
    fi
    cd "$ROOT/ui"
    exec "$VITE_BIN" --mode development.local --host 127.0.0.1 --port "$PORT" --strictPort
    ;;
  dev)
    if [[ ! -f "$ROOT/ui/.env.development.dev" ]]; then
      echo "Missing ui/.env.development.dev" >&2
      echo "Copy ui/.env.development.dev.example → ui/.env.development.dev" >&2
      exit 1
    fi
    cd "$ROOT/ui"
    exec "$VITE_BIN" --mode development.dev --host 127.0.0.1 --port "$PORT" --strictPort
    ;;
  *)
    echo "ERROR: Unknown --env profile: $ENV_PROFILE (use local or dev)" >&2
    exit 1
    ;;
esac
