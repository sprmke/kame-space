#!/usr/bin/env bash
# Create or attach the local super-admin account to the canonical seed org.
#
#   ./scripts/dev/attach-local-admin.sh                 # first allow-list email
#   ./scripts/dev/attach-local-admin.sh you@example.com
#
# The seed owner (`seed-owner@example.com`) already owns the org. This script is
# for your real Google account: it creates the local auth user if it does not
# exist yet (password `seed-password`), then grants org admin, property Full
# Access, parking MANAGER and the platform super-admin row. Signing in with
# Google later links to the same email.
#
# Emails are read from supabase/.env.local, never hardcoded in the repo.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if [[ -f supabase/.env.local ]]; then
  # shellcheck disable=SC1090
  set -a && source supabase/.env.local && set +a
fi

read_env() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 0
  grep -E "^${key}=" "$file" | tail -1 | cut -d= -f2- | tr -d "'\""
}

SUPABASE_URL="${VITE_SUPABASE_URL:-$(read_env ui/.env.development VITE_SUPABASE_URL)}"
SUPABASE_URL="${SUPABASE_URL%/functions/v1}"
SUPABASE_URL="${SUPABASE_URL%/}"
ANON_KEY="${VITE_SUPABASE_ANON_KEY:-$(read_env ui/.env.development VITE_SUPABASE_ANON_KEY)}"
SUPER_ADMIN_LIST="${VITE_SUPER_ADMIN_EMAILS:-$(read_env ui/.env.development VITE_SUPER_ADMIN_EMAILS)}"

EMAIL="${1:-}"
if [[ -z "$EMAIL" ]]; then
  EMAIL="$(printf '%s' "${ADMIN_ALLOWED_EMAILS:-}" | cut -d',' -f1 | tr -d '[:space:]')"
fi
if [[ -z "$EMAIL" ]]; then
  EMAIL="$(printf '%s' "$SUPER_ADMIN_LIST" | cut -d',' -f1 | tr -d '[:space:]')"
fi
if [[ -z "$EMAIL" ]]; then
  echo "No email given and none found in ADMIN_ALLOWED_EMAILS / VITE_SUPER_ADMIN_EMAILS." >&2
  echo "Run: ./scripts/dev/attach-local-admin.sh you@example.com" >&2
  exit 1
fi

SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
if [[ -z "$SERVICE_ROLE_KEY" ]]; then
  SERVICE_ROLE_KEY="$(./scripts/dev/run-with-ui-dev-env.sh ./scripts/dev/bunx --bun supabase@latest status -o env 2>/dev/null | grep '^SERVICE_ROLE_KEY=' | cut -d= -f2- | tr -d '"')"
fi
if [[ -z "$SUPABASE_URL" || -z "$SERVICE_ROLE_KEY" ]]; then
  echo "Could not resolve the local Supabase URL or service role key. Is the stack running?" >&2
  exit 1
fi

# Create the auth user if it does not exist. GoTrue admin API is local only.
USER_LOOKUP="$(curl -s "$SUPABASE_URL/auth/v1/admin/users?per_page=200" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY")"
if ! printf '%s' "$USER_LOOKUP" | grep -qi "\"email\":\"$EMAIL\""; then
  echo "→ Creating local auth user $EMAIL (password: seed-password)"
  curl -s -X POST "$SUPABASE_URL/auth/v1/admin/users" \
    -H "apikey: $SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"seed-password\",\"email_confirm\":true}" >/dev/null

  # GoTrue writes through its own pool; wait until the row is visible to SQL.
  for _ in $(seq 1 20); do
    if curl -s "$SUPABASE_URL/auth/v1/admin/users?per_page=200" \
      -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
      | grep -qi "\"email\":\"$EMAIL\""; then
      break
    fi
    sleep 0.5
  done
else
  echo "→ Local auth user $EMAIL already exists"
fi

TMP_SQL="$(mktemp "${TMPDIR:-/tmp}/attach-local-admin.XXXXXX.sql")"
trap 'rm -f "$TMP_SQL"' EXIT

cat >"$TMP_SQL" <<SQL
DO \$\$
DECLARE
  v_email text := '${EMAIL}';
  v_uid uuid;
  v_org uuid := '405ea07f-cc21-4bcc-b540-28729be79f0d';
  v_prop uuid := 'e5555555-5555-4555-8555-555555555501';
  v_park uuid := 'c3333333-3333-4333-8333-333333333301';
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(v_email) LIMIT 1;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No auth user for %. Sign in once or create it through the GoTrue admin API.', v_email;
  END IF;

  INSERT INTO public.organization_members (
    organization_id, user_id, role_id, status, display_name, permissions, all_listings
  )
  SELECT v_org, v_uid, 'ADMIN', 'active', split_part(v_email, '@', 1), '[]'::jsonb, true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.organization_members WHERE organization_id = v_org AND user_id = v_uid
  );

  INSERT INTO public.property_members (
    property_id, user_id, role_id, permissions, status, display_name
  )
  SELECT v_prop, v_uid, 'ADMIN', '[]'::jsonb, 'active', split_part(v_email, '@', 1)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.property_members WHERE property_id = v_prop AND user_id = v_uid
  );

  INSERT INTO public.parking_members (
    parking_id, user_id, role_id, permissions, status, display_name
  )
  SELECT v_park, v_uid, 'MANAGER', '[]'::jsonb, 'active', split_part(v_email, '@', 1)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.parking_members WHERE parking_id = v_park AND user_id = v_uid
  );

  INSERT INTO public.platform_super_admins (user_id)
  SELECT v_uid
  WHERE NOT EXISTS (SELECT 1 FROM public.platform_super_admins WHERE user_id = v_uid);

  RAISE NOTICE 'Attached % to kame-homes / kame-home / monaco-level-2-slot-27', v_email;
END \$\$;
SQL

./scripts/dev/run-with-ui-dev-env.sh ./scripts/dev/bunx --bun supabase@latest db query --local -f "$TMP_SQL"

echo ""
echo "Sign in locally with $EMAIL / seed-password, or continue with Google."
echo "Add the email to VITE_SUPER_ADMIN_EMAILS (ui/.env.development) and SUPER_ADMIN_EMAILS"
echo "(supabase/.env.local) if it is not already a super admin."
