-- Test tenant isolation.
--
-- One synthetic organization exists so an AI agent (or a human) can run production
-- measurements and RBAC checks without touching a real host's data. This migration makes
-- "just one" and "never public" database facts rather than conventions.
--
-- Why this needs no changes to any read path:
--
-- Every public surface already keys off the listing being ACTIVE. `stateHasPublicPage()`
-- returns false for anything that is not live or paused, and `public_listing_search` is
-- built from ACTIVE rows only. So a CHECK that forbids an ACTIVE test listing excludes the
-- tenant from listing pages, search, facets, map results and the guest property page at
-- once. Adding `is_test` filters to a dozen endpoints would mean a dozen chances to miss
-- one; this makes a miss impossible.
--
-- Trade-off, deliberate: a test listing can never accept new bookings
-- (`stateAcceptsNewBookings` is true only for live). That is the price of a guarantee, and
-- widening it needs its own reviewed decision, not a quiet status update.

-- Flags ------------------------------------------------------------------------------

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

ALTER TABLE public.parkings
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.organizations.is_test IS
  'Synthetic tenant used for production measurement and RBAC checks. At most one row may be true; immutable after insert. See docs/architecture/test-tenant.md.';
COMMENT ON COLUMN public.properties.is_test IS
  'Mirrors organizations.is_test. A test property may never be ACTIVE, so it can never appear publicly.';
COMMENT ON COLUMN public.parkings.is_test IS
  'Mirrors organizations.is_test. A test parking may never be ACTIVE, so it can never appear publicly.';

-- Exactly one ------------------------------------------------------------------------

-- Partial unique index on the flag itself: a second `is_test = true` row collides on the
-- indexed `true` value. Enforced for every writer, including service-role scripts and SQL
-- run from a dashboard.
CREATE UNIQUE INDEX IF NOT EXISTS organizations_single_test_tenant
  ON public.organizations ((is_test))
  WHERE is_test;

-- Never public -----------------------------------------------------------------------

-- Two-step on purpose: `NOT VALID` takes only a brief catalog lock, then `VALIDATE` scans
-- under SHARE UPDATE EXCLUSIVE, which does not block reads or writes. A plain validated
-- `ADD CONSTRAINT` needs ACCESS EXCLUSIVE for the whole scan and will queue behind live
-- traffic on a production table.
ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_test_never_active;
ALTER TABLE public.properties
  ADD CONSTRAINT properties_test_never_active
  CHECK (NOT is_test OR status <> 'ACTIVE') NOT VALID;

ALTER TABLE public.parkings
  DROP CONSTRAINT IF EXISTS parkings_test_never_active;
ALTER TABLE public.parkings
  ADD CONSTRAINT parkings_test_never_active
  CHECK (NOT is_test OR status <> 'ACTIVE') NOT VALID;

-- Flags stay in lockstep -------------------------------------------------------------

-- The child flag is derived from the org, so a flagged property in a real org (or an
-- unflagged one in the test org) cannot exist. Callers cannot set it by hand.
CREATE OR REPLACE FUNCTION public.sync_test_tenant_flag()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT o.is_test INTO NEW.is_test
  FROM public.organizations o
  WHERE o.id = NEW.organization_id;

  NEW.is_test := COALESCE(NEW.is_test, false);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS properties_sync_test_flag ON public.properties;
CREATE TRIGGER properties_sync_test_flag
  BEFORE INSERT OR UPDATE OF organization_id
  ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_test_tenant_flag();

DROP TRIGGER IF EXISTS parkings_sync_test_flag ON public.parkings;
CREATE TRIGGER parkings_sync_test_flag
  BEFORE INSERT OR UPDATE OF organization_id
  ON public.parkings
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_test_tenant_flag();

-- The org flag is immutable after insert. Flipping it would desynchronise every child row
-- (and could turn a test listing public if its status were ever ACTIVE), so a retype is
-- refused rather than migrated.
CREATE OR REPLACE FUNCTION public.prevent_test_tenant_flag_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_test IS DISTINCT FROM OLD.is_test THEN
    RAISE EXCEPTION
      'organizations.is_test is immutable. Create the single test tenant once; see docs/architecture/test-tenant.md.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizations_test_flag_immutable ON public.organizations;
CREATE TRIGGER organizations_test_flag_immutable
  BEFORE UPDATE OF is_test
  ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_test_tenant_flag_change();

-- Validate separately so the scan never holds an exclusive lock.
ALTER TABLE public.properties VALIDATE CONSTRAINT properties_test_never_active;
ALTER TABLE public.parkings VALIDATE CONSTRAINT parkings_test_never_active;

COMMENT ON INDEX public.organizations_single_test_tenant IS
  'Enforces at most one synthetic test tenant. See docs/architecture/test-tenant.md.';
