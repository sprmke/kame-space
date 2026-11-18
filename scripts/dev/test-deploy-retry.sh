#!/usr/bin/env bash
# Self-test for scripts/deploy/retry-lib.sh. No network, no Supabase: stub commands only.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=scripts/deploy/retry-lib.sh
source "$ROOT/scripts/deploy/retry-lib.sh"

export DEPLOY_RETRY_DELAY=0
fail=0
state="$(mktemp)"
trap 'rm -f "$state"' EXIT

check() {
  local name="$1" expected_rc="$2" expected_calls="$3"
  shift 3
  : >"$state"
  set +e
  "$@" >/dev/null 2>&1
  local rc=$?
  set -e
  local calls
  calls="$(wc -l <"$state" | tr -d ' ')"
  if [[ "$rc" != "$expected_rc" || "$calls" != "$expected_calls" ]]; then
    echo "FAIL $name: rc=$rc (want $expected_rc), calls=$calls (want $expected_calls)"
    fail=1
  else
    echo "ok   $name"
  fi
}

flaky() { # fails with $1 on the first $2 calls, then succeeds
  echo x >>"$state"
  local n
  n="$(wc -l <"$state" | tr -d ' ')"
  if (( n <= $2 )); then echo "$1" >&2; return 1; fi
  return 0
}

set -e
check "succeeds first time"                      0 1 deploy_retry_transient flaky "x" 0
check "retries a connection reset, then passes"  0 3 deploy_retry_transient flaky "error sending request ... connection reset" 2
check "retries the esm.sh graph failure"         0 2 deploy_retry_transient flaky "Error: failed to create the graph: https://esm.sh/@supabase/supabase-js connection error" 1
check "gives up after the attempt limit"         1 3 deploy_retry_transient flaky "connection reset by peer" 99
check "does NOT retry a real error"              1 1 deploy_retry_transient flaky "TypeError: x is not a function" 99
check "does NOT retry an auth error"             1 1 deploy_retry_transient flaky "Unauthorized: invalid access token" 99
DEPLOY_RETRY_ATTEMPTS=2 check "honours DEPLOY_RETRY_ATTEMPTS" 1 2 deploy_retry_transient flaky "timed out" 99

if [[ "$fail" -ne 0 ]]; then exit 1; fi
echo "test-deploy-retry: OK"
