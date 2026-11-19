#!/bin/bash
# Local dev: Supabase stack (Docker) + edge functions + Vite UI.
#
# Usage:
#   ./dev.sh                      Full stack (default) + ngrok on :54321 for Meta/webhooks
#   ./dev.sh --ui-only              Vite only — sticky per-worktree port via bun run ui
#   ./dev.sh --ui-only --env dev    Vite only — uses ui/.env.development.dev (hosted)
#   ./dev.sh --ui-only --env local  Vite only — uses ui/.env.development.local
#   SKIP_SUPABASE=1 ./dev.sh        Same as --ui-only
#   SKIP_NGROK=1 ./dev.sh           Full stack without ngrok
#
# Multi-worktree: Docker + edge stay shared (project guest-form-management).
# Each worktree runs its own Vite on a sticky port (5173-5199). See
# docs/guides/testing/multi-worktree-local-preview.md
#
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

export PATH="/usr/local/bin:/opt/homebrew/bin:${HOME}/.bun/bin:${PATH}"
BUNX="$ROOT/scripts/dev/bunx"
UI_LAUNCHER="$ROOT/scripts/dev/ui-worktree.sh"

UI_ONLY=0
ENV_PROFILE=""
prev=""
for arg in "$@"; do
  case "$arg" in
    --ui-only) UI_ONLY=1 ;;
  esac
  if [[ "$prev" == "--env" ]]; then
    ENV_PROFILE="$arg"
  fi
  prev="$arg"
done

if [[ "${SKIP_SUPABASE:-}" == "1" ]]; then
  UI_ONLY=1
fi

start_ui() {
  if [[ -n "$ENV_PROFILE" ]]; then
    exec "$UI_LAUNCHER" --env "$ENV_PROFILE"
  fi
  exec "$UI_LAUNCHER"
}

shared_edge_healthy() {
  local code
  code="$(
    curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 1 --max-time 2 \
      'http://127.0.0.1:54321/functions/v1/get-health' 2>/dev/null || echo '000'
  )"
  [[ "$code" == "200" ]]
}

shared_kong_up() {
  docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^supabase_kong_guest-form-management$'
}

if [[ "$UI_ONLY" == "1" ]]; then
  case "$ENV_PROFILE" in
    dev|local|"")
      if [[ -n "$ENV_PROFILE" ]]; then
        echo "UI-only mode (--env $ENV_PROFILE). Sticky per-worktree Vite port."
      else
        echo "UI-only mode. Sticky per-worktree Vite port (shared API on :54321)."
      fi
      start_ui
      ;;
    *)
      echo "ERROR: Unknown --env profile: $ENV_PROFILE (use local or dev)" >&2
      exit 1
      ;;
  esac
fi

if [[ -n "$ENV_PROFILE" ]]; then
  echo "NOTE: --env is ignored for full-stack mode; using local Docker Supabase." >&2
fi

# If another worktree already owns a healthy shared stack, only start this worktree's UI.
# Never kill functions serve / edge runtime for a sibling worktree.
if shared_kong_up && shared_edge_healthy; then
  echo "Shared local Supabase already healthy on :54321 (reusing; not restarting Docker/edge)."
  echo "Starting this worktree's UI only…"
  start_ui
fi

# Docker Desktop must be running before Supabase can start containers.
if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not running."
  if [[ "$(uname -s)" == "Darwin" ]] && [[ -d /Applications/Docker.app ]]; then
    echo "Starting Docker Desktop…"
    open -a Docker
    for _ in $(seq 1 60); do
      if docker info >/dev/null 2>&1; then
        echo "Docker is ready."
        break
      fi
      sleep 2
    done
  fi
  if ! docker info >/dev/null 2>&1; then
    echo "Cannot connect to Docker. Start Docker Desktop, wait until it is running, then re-run ./dev.sh"
    echo "Or run UI against remote Supabase: ./dev.sh --ui-only --env dev"
    exit 1
  fi
fi

# Invalid tag after `supabase link` breaks storage-api pull (see docs/archive/operations/migration-runbook.md §3.5.5).
STORAGE_VER_FILE="$ROOT/supabase/.temp/storage-version"
if [[ -f "$STORAGE_VER_FILE" ]]; then
  ver="$(tr -d '[:space:]' <"$STORAGE_VER_FILE")"
  if [[ ! "$ver" =~ ^v[0-9]+\.[0-9]+ ]]; then
    echo "Removing invalid supabase/.temp/storage-version ($ver); CLI will use a valid image on start."
    rm -f "$STORAGE_VER_FILE"
  fi
fi

# Load ui/.env.development so GOOGLE_CLIENT_* are set for supabase/config.toml env().
echo "Starting Supabase (DB, Auth, Storage)..."
# Use bunx supabase@latest so Postgres 17 + storage schema order matches migrations.
"$ROOT/scripts/dev/run-with-ui-dev-env.sh" "$BUNX" --bun supabase@latest start

NGROK_PID=""
if [[ "${SKIP_NGROK:-}" != "1" ]]; then
  if command -v ngrok >/dev/null 2>&1; then
    if pgrep -f "ngrok http 54321" >/dev/null 2>&1; then
      echo "Stopping leftover ngrok http 54321…"
      pkill -f "ngrok http 54321" 2>/dev/null || true
      sleep 1
    fi
    echo "Starting ngrok tunnel (http 54321)…"
    ngrok http 54321 --log=stdout >/dev/null 2>&1 &
    NGROK_PID=$!
    for _ in $(seq 1 20); do
      NGROK_HTTPS_URL="$(
        curl -fsS http://127.0.0.1:4040/api/tunnels 2>/dev/null | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    for t in data.get('tunnels', []):
        if t.get('proto') == 'https':
            print(t.get('public_url', ''))
            break
except Exception:
    pass
" 2>/dev/null || true
      )"
      if [[ -n "$NGROK_HTTPS_URL" ]]; then
        echo "ngrok: $NGROK_HTTPS_URL  (set PUBLIC_API_URL in supabase/.env.local for Meta inbox)"
        break
      fi
      sleep 0.5
    done
  else
    echo "ngrok not found on PATH — skipping tunnel (install ngrok for local Meta/webhook HTTPS)."
  fi
fi

# ECR Public rate-limits image pulls. `functions serve` may request a newer edge-runtime
# patch than `supabase start` cached — retag the newest local patch to avoid pull failures.
EDGE_REPO="public.ecr.aws/supabase/edge-runtime"
LOCAL_EDGE="$(docker images --format '{{.Tag}}' "$EDGE_REPO" 2>/dev/null | grep '^v' | sort -V | tail -1 || true)"
if [[ -n "$LOCAL_EDGE" ]]; then
  major_minor="${LOCAL_EDGE%.*}"
  patch="${LOCAL_EDGE##*.}"
  for ((i = 1; i <= 3; i++)); do
    candidate="${major_minor}.$((patch + i))"
    if ! docker image inspect "${EDGE_REPO}:${candidate}" >/dev/null 2>&1; then
      echo "Edge runtime ${candidate} not cached; retagging local ${LOCAL_EDGE} (avoids ECR rate limit)."
      docker tag "${EDGE_REPO}:${LOCAL_EDGE}" "${EDGE_REPO}:${candidate}"
    fi
  done
fi

# Only recycle edge serve when we are cold-starting the shared stack (health was not 200).
# Secondary worktrees never reach this branch while the stack is healthy.
if pgrep -f "supabase.*functions serve.*functions-serve.env" >/dev/null 2>&1; then
  echo "Stopping leftover supabase functions serve…"
  pkill -f "supabase.*functions serve.*functions-serve.env" 2>/dev/null || true
  sleep 1
fi

# Remove the stale edge runtime container if it exists.
docker rm -f supabase_edge_runtime_guest-form-management 2>/dev/null || true

# Start edge functions with secrets from supabase/.env.local.
echo "Starting Supabase Edge Functions (with supabase/.env.local secrets)..."
FUNCS_ENV="$("$ROOT/scripts/dev/build-local-functions-env.sh")"
"$BUNX" --bun supabase@latest functions serve --env-file "$FUNCS_ENV" &
FUNCTIONS_PID=$!

# Kong caches edge-runtime DNS; removing/recreating the container above leaves 503
# ("name resolution failed") until Kong reloads.
KONG_CONTAINER="supabase_kong_guest-form-management"
for _ in $(seq 1 45); do
  if docker ps --format '{{.Names}}' | grep -q "^supabase_edge_runtime_guest-form-management$"; then
    sleep 2
    if docker ps --format '{{.Names}}' | grep -q "^${KONG_CONTAINER}$"; then
      docker restart "$KONG_CONTAINER" >/dev/null
      echo "Reloaded Kong so /functions/v1 routes reach edge runtime."
    fi
    break
  fi
  sleep 1
done

# Leave functions serve running after this UI exits so sibling worktrees keep
# the shared API. Tear down with `LOCALSTOP=localstop bun run stop:supabase` when asked.
cleanup() {
  if [[ -n "$NGROK_PID" ]]; then
    kill "$NGROK_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "Starting this worktree's UI development server…"
# exec so Ctrl-C stops only Vite; shared edge keep serving other worktrees.
if [[ -n "$ENV_PROFILE" ]]; then
  exec "$UI_LAUNCHER" --env "$ENV_PROFILE"
fi
exec "$UI_LAUNCHER"
