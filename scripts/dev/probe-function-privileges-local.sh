#!/usr/bin/env bash
# PR-096 — the database must match hosted production's function privileges after a fresh replay.
#
# Hosted production: functions created by postgres in `public` are owner-only, `anon` can run no
# SECURITY DEFINER function, and `authenticated` only the allowlist below. Standard Supabase
# defaults grant EXECUTE on every new public function to anon and authenticated, so without
# migration 20261342000600 a fresh database exposes dozens of definer functions through
# /rest/v1/rpc. Run after `bun run db:reset` (the migration-replay workflow does).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

container="$(docker ps --format '{{.Names}}' | grep 'supabase_db_' | head -1 || true)"
if [[ -z "$container" ]]; then
  echo "probe-function-privileges-local: no supabase_db_* container, run bun run start:supabase first"
  exit 1
fi

# The only SECURITY DEFINER functions a signed-in user may call (each checks the caller itself).
ALLOWLIST="admin_set_cancellation_policy_snapshot user_can_read_inbox_broadcast"

psql_q() {
  docker exec -i "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -At -c "$1"
}

definer_where="n.nspname = 'public' AND p.prosecdef AND p.prokind = 'f'"
base="FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE ${definer_where}"

fail=0

anon_exposed="$(psql_q "SELECT p.proname ${base} AND has_function_privilege('anon', p.oid, 'execute') ORDER BY 1")"
if [[ -n "$anon_exposed" ]]; then
  echo "probe-function-privileges-local: FAIL anon can execute SECURITY DEFINER functions:" >&2
  echo "$anon_exposed" | sed 's/^/  - /' >&2
  fail=1
else
  echo "probe-function-privileges-local: OK anon can execute no SECURITY DEFINER function"
fi

auth_exposed="$(psql_q "SELECT p.proname ${base} AND has_function_privilege('authenticated', p.oid, 'execute') ORDER BY 1" | tr '\n' ' ')"
auth_exposed="${auth_exposed% }"
expected="$(echo "$ALLOWLIST" | tr ' ' '\n' | sort | tr '\n' ' ')"
expected="${expected% }"
if [[ "$auth_exposed" != "$expected" ]]; then
  echo "probe-function-privileges-local: FAIL authenticated can execute [${auth_exposed}], expected exactly [${expected}]" >&2
  echo "  A new SECURITY DEFINER function must REVOKE ... FROM PUBLIC, anon, authenticated and GRANT to service_role." >&2
  fail=1
else
  echo "probe-function-privileges-local: OK authenticated is limited to the allowlist (${expected})"
fi

# A function created by postgres must not carry an explicit anon/authenticated grant by default.
# (PostgreSQL's built-in PUBLIC default still applies, as on production: that is why every
# SECURITY DEFINER function must REVOKE ... FROM PUBLIC, anon, authenticated; the migration gate
# check-migration-security.sh enforces it. Revoking PUBLIC globally would break ordinary
# functions that the app calls as anon or authenticated.)
new_acl="$(psql_q "BEGIN; CREATE FUNCTION public.zz_privilege_probe() RETURNS int LANGUAGE sql AS 'select 1'; SELECT 'ACL=' || coalesce(proacl::text, 'NULL') FROM pg_proc WHERE proname = 'zz_privilege_probe'; ROLLBACK;" | grep '^ACL=' | head -1)"
if [[ -z "$new_acl" ]]; then
  echo "probe-function-privileges-local: ERROR could not read the ACL of a probe function" >&2
  fail=1
elif [[ "$new_acl" == *"anon="* || "$new_acl" == *"authenticated="* ]]; then
  echo "probe-function-privileges-local: FAIL a new public function defaults to an explicit anon/authenticated grant (${new_acl})" >&2
  fail=1
else
  echo "probe-function-privileges-local: OK a new public function has no explicit anon/authenticated default grant"
fi

exit "$fail"
