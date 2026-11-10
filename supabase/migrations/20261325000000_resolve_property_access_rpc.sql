-- One read for the whole property-access decision.
--
-- `verifyPropertyAccess` fetched four things in sequence: the property, its organization,
-- the caller's organization_members row, then the caller's property_members row. Every
-- property-scoped endpoint pays that, measured at 250 to 390 ms of handler time in production
-- on 2026-11-09.
--
-- This returns all four in one statement. No permission rule moves: the TypeScript decision
-- tree in `verifyPropertyAccess` still runs on the same rows, in the same order, with the same
-- branches. Only the fetching changes, so a mistake here shows up as a failed lookup, not as a
-- silently different authorisation outcome.

CREATE OR REPLACE FUNCTION public.resolve_property_access(
  p_property_id uuid,
  p_user_id uuid
)
RETURNS TABLE (
  property jsonb,
  org jsonb,
  org_member jsonb,
  property_member jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
SELECT
  to_jsonb(p) AS property,
  to_jsonb(o) AS org,
  (
    SELECT to_jsonb(om)
    FROM public.organization_members om
    WHERE om.organization_id = p.organization_id
      AND om.user_id = p_user_id
    LIMIT 1
  ) AS org_member,
  (
    SELECT to_jsonb(pm)
    FROM public.property_members pm
    WHERE pm.property_id = p.id
      AND pm.user_id = p_user_id
    LIMIT 1
  ) AS property_member
FROM public.properties p
JOIN public.organizations o ON o.id = p.organization_id
WHERE p.id = p_property_id;
$$;

COMMENT ON FUNCTION public.resolve_property_access(uuid, uuid) IS
  'Property, org, org_members row and property_members row for one caller in one read. Authorisation still decided in verifyPropertyAccess.';

REVOKE ALL ON FUNCTION public.resolve_property_access(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_property_access(uuid, uuid) TO service_role;
