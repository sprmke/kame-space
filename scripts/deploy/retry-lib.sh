#!/usr/bin/env bash
# Retry a command only when it fails on a transient network error.
#
# Bundling edge functions fetches remote modules (esm.sh, deno.land, jsr.io) at deploy time, and
# a connection reset there fails the whole deploy even though nothing is wrong with the code
# (three times on 2026-11-18, PR-098). A deploy is idempotent, so re-running it is safe; a real
# failure (type error, bad config, auth) must NOT be retried, so only known network signatures
# qualify.
#
#   deploy_retry_transient <command...>
#     DEPLOY_RETRY_ATTEMPTS  total attempts (default 3)
#     DEPLOY_RETRY_DELAY     seconds before a retry, multiplied by the attempt number (default 20)

# Signatures that mean "the network blipped", never "the code is wrong".
DEPLOY_TRANSIENT_PATTERN='connection reset|connection error|error sending request|timed out|ETIMEDOUT|ECONNRESET|EAI_AGAIN|temporary failure in name resolution|502 Bad Gateway|503 Service Unavailable|504 Gateway Timeout|failed to create the graph.*(esm\.sh|deno\.land|jsr\.io|npm)'

deploy_retry_transient() {
  local attempts="${DEPLOY_RETRY_ATTEMPTS:-3}"
  local delay="${DEPLOY_RETRY_DELAY:-20}"
  local attempt=1
  local log rc
  # Leave the caller's shell options exactly as found (errexit included).
  local had_errexit=0
  [[ $- == *e* ]] && had_errexit=1

  while true; do
    log="$(mktemp)"
    set +e
    "$@" 2>&1 | tee "$log"
    rc="${PIPESTATUS[0]}"
    if (( had_errexit )); then set -e; fi

    if [[ "$rc" -eq 0 ]]; then
      rm -f "$log"
      return 0
    fi

    if (( attempt >= attempts )) || ! grep -Eqi "$DEPLOY_TRANSIENT_PATTERN" "$log"; then
      if (( attempt > 1 )); then
        echo "✖ giving up after ${attempt} attempt(s)." >&2
      fi
      rm -f "$log"
      return "$rc"
    fi

    echo "⚠️  attempt ${attempt}/${attempts} failed on a transient network error; retrying in $((delay * attempt))s." >&2
    rm -f "$log"
    sleep $((delay * attempt))
    attempt=$((attempt + 1))
  done
}
