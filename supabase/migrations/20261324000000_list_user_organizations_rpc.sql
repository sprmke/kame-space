-- One round trip for `list-organizations`.
--
-- The handler used to run up to seven sequential PostgREST queries (owned orgs, active
-- property memberships, plan-limited inactive ones, the properties behind both, org-hub
-- memberships, then one or two more organization reads). Measured in production on
-- 2026-11-09 the handler took 601 to 917 ms warm while the database's index and table cache
-- hit rates were both 1.00, so the cost was round trips, not query work.
--
-- This returns the same rows in one statement. Access-kind and plan-limited decisions stay
-- expressed exactly as the handler expressed them; the TypeScript side still serializes the
-- rows, so the response shape is unchanged.
--
-- Semantics preserved deliberately:
-- - A user sees an org if they own it, have an ACTIVE property membership in it, hold an
--   active org-hub role, or hold a plan-limited membership/role that still needs to render.
-- - An org-hub role is `ADMIN` or a custom UUID role id, matching `isOrgHubMemberRoleId`.
-- - `plan_limited` is true only when the user neither owns nor administers the org.

CREATE OR REPLACE FUNCTION public.list_user_organizations(
  p_user_id uuid,
  p_platform_admin boolean DEFAULT false
)
RETURNS TABLE (
  id uuid,
  owner_id uuid,
  name text,
  slug text,
  description text,
  logo_url text,
  settings jsonb,
  host_modes text[],
  created_at timestamptz,
  updated_at timestamptz,
  access_kind text,
  plan_limited boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH
  owned AS (
    SELECT o.id AS organization_id
    FROM public.organizations o
    WHERE o.owner_id = p_user_id
  ),
  active_property AS (
    SELECT pm.property_id
    FROM public.property_members pm
    WHERE pm.user_id = p_user_id
      AND pm.status = 'active'
  ),
  limited_property AS (
    SELECT pm.property_id
    FROM public.property_members pm
    WHERE pm.user_id = p_user_id
      AND pm.status = 'inactive'
      AND pm.plan_limited IS TRUE
  ),
  member_org AS (
    SELECT DISTINCT p.organization_id
    FROM public.properties p
    WHERE p.id IN (SELECT property_id FROM active_property)
  ),
  limited_property_org AS (
    SELECT DISTINCT p.organization_id
    FROM public.properties p
    WHERE p.id IN (SELECT property_id FROM limited_property)
  ),
  hub_member AS (
    SELECT om.organization_id, om.status, om.plan_limited
    FROM public.organization_members om
    WHERE om.user_id = p_user_id
      AND (
        upper(btrim(om.role_id)) = 'ADMIN'
        OR btrim(om.role_id) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      )
  ),
  org_admin AS (
    SELECT DISTINCT organization_id FROM hub_member WHERE status = 'active'
  ),
  limited_admin AS (
    SELECT DISTINCT organization_id
    FROM hub_member
    WHERE status = 'inactive' AND plan_limited IS TRUE
  ),
  eligible AS (
    SELECT organization_id FROM owned
    UNION SELECT organization_id FROM member_org
    UNION SELECT organization_id FROM org_admin
    UNION SELECT organization_id FROM limited_property_org
    UNION SELECT organization_id FROM limited_admin
  )
SELECT
  o.id,
  o.owner_id,
  o.name,
  o.slug,
  o.description,
  o.logo_url,
  o.settings,
  o.host_modes,
  o.created_at,
  o.updated_at,
  CASE
    WHEN p_platform_admin THEN 'platform_admin'
    WHEN o.id IN (SELECT organization_id FROM owned) THEN 'owner'
    WHEN o.id IN (SELECT organization_id FROM org_admin) THEN 'org_admin'
    ELSE 'property_member'
  END AS access_kind,
  CASE
    WHEN o.id IN (SELECT organization_id FROM owned) THEN false
    WHEN o.id IN (SELECT organization_id FROM org_admin) THEN false
    WHEN o.id IN (SELECT organization_id FROM limited_admin) THEN true
    WHEN o.id IN (SELECT organization_id FROM limited_property_org)
      AND o.id NOT IN (SELECT organization_id FROM member_org) THEN true
    ELSE false
  END AS plan_limited
FROM public.organizations o
WHERE o.id IN (SELECT organization_id FROM eligible)
ORDER BY o.name;
$$;

COMMENT ON FUNCTION public.list_user_organizations(uuid, boolean) IS
  'The orgs a user owns, administers, or reaches through an active or plan-limited membership. One round trip; see docs/architecture/edge-functions.md.';

REVOKE ALL ON FUNCTION public.list_user_organizations(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_user_organizations(uuid, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.list_all_organizations_for_platform_admin()
RETURNS TABLE (
  id uuid,
  owner_id uuid,
  name text,
  slug text,
  description text,
  logo_url text,
  settings jsonb,
  host_modes text[],
  created_at timestamptz,
  updated_at timestamptz,
  access_kind text,
  plan_limited boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
SELECT
  o.id, o.owner_id, o.name, o.slug, o.description, o.logo_url, o.settings,
  o.host_modes, o.created_at, o.updated_at,
  'platform_admin'::text AS access_kind,
  false AS plan_limited
FROM public.organizations o
ORDER BY o.name;
$$;

COMMENT ON FUNCTION public.list_all_organizations_for_platform_admin() IS
  'Every org for a super admin. One round trip; replaces a full-table select through PostgREST.';

REVOKE ALL ON FUNCTION public.list_all_organizations_for_platform_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_all_organizations_for_platform_admin() TO service_role;
