-- Lock the billing database surface to the service role.
--
-- Supabase's default privileges grant EXECUTE on every new public function, and ALL on every new
-- public table, to `anon` and `authenticated`. `REVOKE ... FROM PUBLIC` does not remove those
-- explicit grants, so the SECURITY DEFINER billing functions were callable by anyone with the
-- anon key through /rest/v1/rpc (for example ending any org's plan by subscription id, or
-- reading an org's account credit). Everything billing is reached only through edge functions
-- using the service role.
-- Plan: docs/workflow/in-progress/plans-billing-lifecycle-hardening.md

REVOKE ALL ON FUNCTION public.cancel_org_subscription_to_free(UUID, UUID, TEXT, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.org_billing_balance(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assign_org_payment_receipt(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_platform_billing_cron_job() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.cancel_org_subscription_to_free(UUID, UUID, TEXT, UUID, TEXT, TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.org_billing_balance(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.assign_org_payment_receipt(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_platform_billing_cron_job() TO service_role;

-- RLS is on with no policies (so these were already unreadable); remove the table grants as well.
REVOKE ALL ON TABLE public.org_billing_ledger FROM anon, authenticated;
REVOKE ALL ON TABLE public.org_billing_notifications FROM anon, authenticated;
REVOKE ALL ON TABLE public.org_billing_details FROM anon, authenticated;
REVOKE ALL ON TABLE public.plan_price_migrations FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.org_payment_receipt_seq FROM anon, authenticated;
