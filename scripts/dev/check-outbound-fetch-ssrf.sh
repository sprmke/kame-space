#!/usr/bin/env bash
# SSRF regression guard (OWASP A10:2025 / API7, plan finding S-2).
#
# Two properties are enforced:
#   1. No untrusted outbound fetch follows redirects automatically. `redirect: 'follow'`
#      lets a public URL bounce the request onto a private address between the URL check
#      and the socket connect.
#   2. The two handlers that fetch host-supplied media URLs (payment QR image, poster photos)
#      keep using the shared `fetchFirstPartyOrPublic` + `readResponseBytesBounded` guard.
#
# A new outbound fetch of a variable URL should either go through `_shared/safeOutboundUrl.ts`
# or be added here with a reason. Run in CI via scripts/dev/ci-quality-gate.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

fail=0

echo "== 1. no automatic redirect following on outbound fetches =="
while IFS= read -r hit; do
  [[ -z "$hit" ]] && continue
  file="${hit%%:*}"
  # The guard's own doc comment and tests are allowed.
  [[ "$file" == *"_shared/safeOutboundUrl.ts" ]] && continue
  echo "DISALLOWED redirect: 'follow' — $hit" >&2
  echo "  Use fetchPublicHttp/fetchFirstPartyOrPublic (manual redirects + per-hop checks)." >&2
  fail=1
done < <(grep -rn "redirect:[[:space:]]*['\"]follow['\"]" supabase/functions --include='*.ts' 2>/dev/null | grep -v '/tests/' || true)

echo "== 2. host-supplied media fetches keep the shared guard =="
require() {
  local file="$1" needle="$2" why="$3"
  if ! grep -q "$needle" "$file"; then
    echo "MISSING $needle in $file — $why" >&2
    fail=1
  fi
}

require "supabase/functions/_shared/emailService.ts" "fetchFirstPartyOrPublic" \
  "payment QR images are host-supplied URLs"
require "supabase/functions/_shared/emailService.ts" "readResponseBytesBounded" \
  "payment QR downloads must be byte-capped"
require "supabase/functions/_shared/marketingPosterDirector.ts" "fetchFirstPartyOrPublic" \
  "poster photos are host-stored URLs"

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi
echo "OK — outbound fetches use the shared SSRF guard and never auto-follow redirects."
