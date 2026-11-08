#!/usr/bin/env bash
# Switch the canonical local org between plans without editing seed files.
#
#   ./scripts/dev/seed-plan.sh --plan=free
#   ./scripts/dev/seed-plan.sh --plan=growth
#   ./scripts/dev/seed-plan.sh --plan=pro
#
# Updates org_subscriptions and writes an org_subscription_events row so the
# change is auditable, mirroring what the super-admin path records.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

PLAN=""
for arg in "$@"; do
  case "$arg" in
    --plan=*) PLAN="${arg#*=}" ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done

case "$PLAN" in
  free|starter|growth|pro|managed) ;;
  *)
    echo "Usage: ./scripts/dev/seed-plan.sh --plan=free|starter|growth|pro|managed" >&2
    exit 1
    ;;
esac

TMP_SQL="$(mktemp "${TMPDIR:-/tmp}/seed-plan.XXXXXX.sql")"
trap 'rm -f "$TMP_SQL"' EXIT

cat >"$TMP_SQL" <<SQL
DO \$\$
DECLARE
  v_org uuid := '405ea07f-cc21-4bcc-b540-28729be79f0d';
  v_plan uuid;
  v_old_plan uuid;
  v_old_status text;
  v_sub uuid;
BEGIN
  SELECT id INTO v_plan FROM public.pricing_plans WHERE code = '${PLAN}' AND is_active LIMIT 1;
  IF v_plan IS NULL THEN
    RAISE EXCEPTION 'Plan % not found or inactive', '${PLAN}';
  END IF;

  SELECT id, plan_id, status INTO v_sub, v_old_plan, v_old_status
  FROM public.org_subscriptions
  WHERE organization_id = v_org AND status IN ('active', 'trialing', 'past_due')
  LIMIT 1;

  IF v_sub IS NULL THEN
    INSERT INTO public.org_subscriptions (
      organization_id, plan_id, pricing_model, status, current_period_start,
      current_period_end, source
    )
    VALUES (v_org, v_plan, 'subscription', 'active', date_trunc('day', now()),
            date_trunc('day', now()) + interval '1 year', 'admin')
    RETURNING id INTO v_sub;

    INSERT INTO public.org_subscription_events (
      org_subscription_id, event_type, new_plan_id, new_status, note
    )
    VALUES (v_sub, 'plan_changed', v_plan, 'active', 'Local seed plan switch');
  ELSE
    UPDATE public.org_subscriptions
    SET plan_id = v_plan,
        status = 'active',
        price_php_snapshot = (SELECT price_php FROM public.pricing_plans WHERE id = v_plan),
        current_period_start = coalesce(current_period_start, date_trunc('day', now())),
        current_period_end = greatest(
          coalesce(current_period_end, date_trunc('day', now())),
          date_trunc('day', now()) + interval '1 month'
        ),
        grace_period_ends_at = NULL,
        updated_at = now()
    WHERE id = v_sub;

    IF v_old_plan IS DISTINCT FROM v_plan OR v_old_status IS DISTINCT FROM 'active' THEN
      INSERT INTO public.org_subscription_events (
        org_subscription_id, event_type, previous_plan_id, new_plan_id,
        previous_status, new_status, note
      )
      VALUES (v_sub, 'plan_changed', v_old_plan, v_plan, v_old_status, 'active',
              'Local seed plan switch');
    END IF;
  END IF;

  RAISE NOTICE 'kame-homes is now on plan %', '${PLAN}';
END \$\$;
SQL

./scripts/dev/run-with-ui-dev-env.sh ./scripts/dev/bunx --bun supabase@latest db query --local -f "$TMP_SQL"
