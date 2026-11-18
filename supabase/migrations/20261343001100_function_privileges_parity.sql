-- Make every environment's function privileges match hosted production (PR-096).
--
-- Hosted production already has restrictive defaults: functions created by `postgres` in `public`
-- are owner-only, and of its 123 SECURITY DEFINER functions `anon` can run none and `authenticated`
-- only the two below. Standard Supabase defaults (the local stack, CI replays, any new project)
-- instead grant EXECUTE on every new public function to `anon` and `authenticated`, so those
-- environments exposed ~60 definer functions through /rest/v1/rpc that production never did.
--
-- This migration brings them to parity and is a no-op on production:
--   1. future functions created by postgres in public no longer get an explicit anon or
--      authenticated grant by default (a function that needs a caller grants it, as the billing
--      functions do). PostgreSQL's built-in PUBLIC default is deliberately left alone, exactly
--      as on production: revoking it globally would break ordinary functions the app calls as
--      anon or authenticated. For SECURITY DEFINER functions the PUBLIC revoke is enforced by
--      scripts/dev/check-migration-security.sh;
--   2. every existing SECURITY DEFINER function in public is revoked from PUBLIC, anon and
--      authenticated, except the two that signed-in users call and that check the caller;
--   3. service_role is untouched.
-- Plan: docs/workflow/done/plans-billing-lifecycle-hardening.md (PR-096).

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prokind = 'f'
      AND pg_get_userbyid(p.proowner) = current_user
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.signature);
  END LOOP;
END
$$;

-- The only definer functions a signed-in user may call. Both check the caller themselves:
-- the first rejects anyone who is not a platform super admin, the second only answers true for
-- members of the org named in the realtime topic.
GRANT EXECUTE ON FUNCTION public.admin_set_cancellation_policy_snapshot(UUID, JSONB, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_read_inbox_broadcast(TEXT) TO authenticated;
