#!/usr/bin/env bash
# Report which external integrations the local environment can actually run,
# and turn on the DB-side switches that are safe to enable.
#
#   ./scripts/dev/seed-integrations.sh                # report + safe enable
#   ./scripts/dev/seed-integrations.sh --force-meta   # also mark Meta channels connected
#
# Nothing here adds credentials. Integrations that need a key stay inactive and
# are listed as missing.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

FORCE_META=0
FORCE_META_SQL=false
for arg in "$@"; do
  case "$arg" in
    --force-meta) FORCE_META=1; FORCE_META_SQL=true ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done

if [[ -f supabase/.env.local ]]; then
  # shellcheck disable=SC1090
  set -a && source supabase/.env.local && set +a
fi

has() { [[ -n "${!1:-}" ]]; }

echo "External integration readiness"
echo "--------------------------------"
printf '%-22s %s\n' "Gemini (AI)" "$(has GEMINI_API_KEY || has GEMINI_API_KEYS && echo ready || echo 'missing GEMINI_API_KEY')"
printf '%-22s %s\n' "Meta app" "$(has META_APP_ID && has META_APP_SECRET && echo ready || echo 'missing META_APP_ID / META_APP_SECRET')"
printf '%-22s %s\n' "Meta token key" "$(has META_INBOX_TOKEN_ENCRYPTION_KEY && echo ready || echo 'missing META_INBOX_TOKEN_ENCRYPTION_KEY')"
printf '%-22s %s\n' "Telegram bot" "$(has TELEGRAM_BOT_TOKEN && echo ready || echo 'missing TELEGRAM_BOT_TOKEN (set it through the settings UI)')"
printf '%-22s %s\n' "PayMongo" "$(has PAYMONGO_SECRET_KEY && has PAYMONGO_WEBHOOK_SECRET && echo ready || echo 'missing PAYMONGO_SECRET_KEY / PAYMONGO_WEBHOOK_SECRET')"
printf '%-22s %s\n' "Resend email" "$(has RESEND_API_KEY && echo ready || echo 'missing RESEND_API_KEY')"
echo

TMP_SQL="$(mktemp "${TMPDIR:-/tmp}/seed-integrations.XXXXXX.sql")"
trap 'rm -f "$TMP_SQL"' EXIT

cat >"$TMP_SQL" <<SQL
DO \$\$
DECLARE
  v_org uuid := '405ea07f-cc21-4bcc-b540-28729be79f0d';
  v_prop uuid := 'e5555555-5555-4555-8555-555555555501';
  v_park uuid := 'c3333333-3333-4333-8333-333333333301';
  v_telegram_token text;
  v_ai boolean;
BEGIN
  SELECT telegram_global_bot_token_encrypted INTO v_telegram_token
  FROM public.app_settings WHERE property_id = v_prop LIMIT 1;

  IF v_telegram_token IS NOT NULL THEN
    UPDATE public.telegram_admin_settings SET enabled = true WHERE property_id = v_prop;
    UPDATE public.telegram_chat_settings SET enabled = true WHERE property_id = v_prop;
    UPDATE public.telegram_finance_settings SET enabled = true WHERE property_id = v_prop;
    UPDATE public.telegram_maintenance_settings SET enabled = true WHERE property_id = v_prop;
    UPDATE public.telegram_marketing_settings SET enabled = true WHERE property_id = v_prop;
    UPDATE public.telegram_staff_settings SET enabled = true WHERE property_id = v_prop;
    UPDATE public.telegram_parking_settings SET enabled = true WHERE parking_id = v_park;
    RAISE NOTICE 'Telegram: enabled (a bot token is configured)';
  ELSE
    RAISE NOTICE 'Telegram: left disabled (no bot token configured)';
  END IF;

  SELECT enabled INTO v_ai FROM public.ai_platform_org_settings WHERE organization_id = v_org;
  RAISE NOTICE 'AI org settings enabled = %', coalesce(v_ai, false);

  IF ${FORCE_META_SQL} THEN
    UPDATE public.social_channel_connections
    SET status = 'connected', updated_at = now()
    WHERE organization_id = v_org AND platform IN ('facebook', 'instagram');
    RAISE NOTICE 'Meta channels marked connected (forced; sending may still fail without a token)';
  ELSE
    RAISE NOTICE 'Meta channels left as seeded; reconnect from Inbox to get a real token';
  END IF;
END \$\$;
SQL

./scripts/dev/run-with-ui-dev-env.sh ./scripts/dev/bunx --bun supabase@latest db query --local -f "$TMP_SQL"
