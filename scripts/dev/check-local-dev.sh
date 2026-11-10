#!/usr/bin/env bash
# Check that the local dev stack is actually usable.
#
#   bun run dev:check
#
# Catches the classic "signed in but the app says not authenticated" cause:
# `supabase start` alone does not run the edge functions, so every admin API
# call fails and the app treats you as signed out.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

read_env() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 0
  grep -E "^${key}=" "$file" | tail -1 | cut -d= -f2- | tr -d "'\""
}

SUPABASE_URL="$(read_env ui/.env.development VITE_SUPABASE_URL)"
SUPABASE_URL="${SUPABASE_URL%/functions/v1}"
SUPABASE_URL="${SUPABASE_URL%/}"
ANON_KEY="$(read_env ui/.env.development VITE_SUPABASE_ANON_KEY)"
SUPER_ADMIN_EMAIL="$(read_env ui/.env.development VITE_SUPER_ADMIN_EMAILS | cut -d',' -f1 | tr -d '[:space:]')"

FAIL=0
ok() { printf '  OK    %s\n' "$1"; }
bad() { printf '  FAIL  %s\n' "$1"; FAIL=1; }

echo "Local dev health"
echo "----------------"

AUTH_CODE="$(curl -s -o /dev/null -w '%{http_code}' "$SUPABASE_URL/auth/v1/health")"
[[ "$AUTH_CODE" == "200" ]] && ok "auth is reachable" || bad "auth returned $AUTH_CODE (run ./dev.sh)"

FN_CODE="$(curl -s -o /dev/null -w '%{http_code}' "$SUPABASE_URL/functions/v1/list-public-pricing-plans" -H "apikey: $ANON_KEY")"
if [[ "$FN_CODE" == "200" ]]; then
  ok "edge functions are reachable"
else
  bad "edge functions returned $FN_CODE. Run 'bun run dev:api' or restart with './dev.sh'."
fi

if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^supabase_db_guest-form-management$'; then
  ok "local database container is running"
  COUNTS="$(docker exec supabase_db_guest-form-management psql -U postgres -d postgres -Atc \
    "select (select count(*) from organizations) || ' org, ' ||
            (select count(*) from properties where status='ACTIVE') || ' property, ' ||
            (select count(*) from parkings where status='ACTIVE') || ' parking';" 2>/dev/null)"
  if [[ "$COUNTS" == "1 org, 1 property, 1 parking" ]]; then
    ok "canonical seed dataset present ($COUNTS)"
  else
    bad "seed dataset is '$COUNTS'; run 'bun run seed:local' or 'bun run db:reset'"
  fi

  if [[ -n "$SUPER_ADMIN_EMAIL" ]]; then
    ADMIN="$(docker exec supabase_db_guest-form-management psql -U postgres -d postgres -Atc \
      "select count(*) from auth.users where lower(email)=lower('$SUPER_ADMIN_EMAIL');" 2>/dev/null)"
    if [[ "$ADMIN" == "1" ]]; then
      ok "local super-admin account exists ($SUPER_ADMIN_EMAIL)"
    else
      bad "no local auth user for $SUPER_ADMIN_EMAIL; run 'bun run seed:attach-admin'"
    fi
  fi
else
  bad "local database container is not running (run ./dev.sh)"
fi

UI_CODE="$(curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/ 2>/dev/null)"
[[ "$UI_CODE" == "200" ]] && ok "UI dev server is reachable on :5173" || bad "UI dev server is not on :5173 (run ./dev.sh --ui-only)"

echo ""
if [[ "$FAIL" -eq 0 ]]; then
  echo "All checks passed. If the browser still looks signed out, clear localStorage keys"
  echo "'sb-127-auth-token' and 'kame:e2e-admin-session', then sign in again."
  exit 0
fi

echo "Fix the FAIL lines above, then reload the app."
exit 1
