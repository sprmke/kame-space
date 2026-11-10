-- SEO-17.1 / SEO-17.2 — diacritic-safe slugs + slug history
--
-- Problem 1: `pls_slugify_name` lowercased and stripped non-ASCII before normalizing, so
-- `Parañaque Loft` became `para-aque-loft`. The TypeScript slugifier produced the same
-- broken result. `ñ` must become `n`, not a dangling hyphen.
--
-- Problem 2: renaming a listing changed its public URL with no redirect, so every inbound
-- link, share and ranking died. This table records the old slug, and the trigger below fills
-- it on rename.
--
-- Existing slugs are deliberately untouched (SEO-17.4): only new slugs and future renames use
-- the new rule, so no live URL moves because of this migration.

-- ---------------------------------------------------------------------------
-- 1. Diacritic-safe slugifier
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pls_slugify_name(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT COALESCE(
    NULLIF(
      left(
        regexp_replace(
          regexp_replace(
            -- NFD splits `ñ` into `n` + U+0303, then the translate drops every combining
            -- mark in the U+0300..U+036F block, so accented letters survive as their base.
            translate(
              normalize(lower(public.pls_trim(COALESCE(value, ''))), NFD),
              (SELECT string_agg(chr(code), '') FROM generate_series(768, 879) AS code),
              ''
            ),
            '[^a-z0-9]+', '-', 'g'
          ),
          '^-+|-+$', '', 'g'
        ),
        64
      ),
      ''
    ),
    'item'
  );
$$;

COMMENT ON FUNCTION public.pls_slugify_name(text) IS
  'URL slug from a display name. Strips diacritics (NFD + combining-mark removal) so Paranaque keeps its n. Mirrors slugifyName in supabase/functions/_shared/slugUtils.ts.';

-- ---------------------------------------------------------------------------
-- 2. Slug history
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.listing_slug_redirects (
  family text NOT NULL CHECK (family IN ('property', 'parking', 'development')),
  old_slug text NOT NULL,
  listing_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (family, old_slug)
);

COMMENT ON TABLE public.listing_slug_redirects IS
  'Previous public slugs per listing family. Read by get-public-property / get-public-parking / list-public-developments to answer a 301 instead of a 404 after a rename.';

-- Service-role only, like every other public-listing read surface: guests reach it through
-- the edge functions, never through PostgREST.
ALTER TABLE public.listing_slug_redirects ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.record_listing_slug_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  family text := TG_ARGV[0];
  next_slug text := NEW.slug;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;
  IF OLD.slug IS NOT DISTINCT FROM next_slug THEN
    RETURN NEW;
  END IF;
  IF next_slug IS NULL OR btrim(next_slug) = '' THEN
    RETURN NEW;
  END IF;

  -- A slug can only point at one listing. Reclaiming a slug for this listing must clear any
  -- older redirect that claims it, otherwise the redirect would send guests to a stranger.
  DELETE FROM public.listing_slug_redirects
   WHERE family = family AND old_slug = next_slug;

  IF OLD.slug IS NOT NULL AND btrim(OLD.slug) <> '' THEN
    INSERT INTO public.listing_slug_redirects (family, old_slug, listing_id)
    VALUES (family, OLD.slug, NEW.id)
    ON CONFLICT (family, old_slug)
    DO UPDATE SET listing_id = EXCLUDED.listing_id, created_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS record_slug_change ON public.properties;
CREATE TRIGGER record_slug_change
  AFTER UPDATE OF slug ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.record_listing_slug_change('property');

DROP TRIGGER IF EXISTS record_slug_change ON public.parkings;
CREATE TRIGGER record_slug_change
  AFTER UPDATE OF slug ON public.parkings
  FOR EACH ROW EXECUTE FUNCTION public.record_listing_slug_change('parking');

DROP TRIGGER IF EXISTS record_slug_change ON public.developments;
CREATE TRIGGER record_slug_change
  AFTER UPDATE OF slug ON public.developments
  FOR EACH ROW EXECUTE FUNCTION public.record_listing_slug_change('development');

-- ---------------------------------------------------------------------------
-- 3. Read helper used by the public edge functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resolve_listing_slug_redirect(
  p_family text,
  p_slug text
)
RETURNS TABLE (slug text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT l.slug
    FROM public.listing_slug_redirects r
    JOIN public.public_listing_search l
      ON l.id = r.listing_id
     AND l.family = r.family
   WHERE r.family = p_family
     AND r.old_slug = p_slug
   LIMIT 1;
$$;

COMMENT ON FUNCTION public.resolve_listing_slug_redirect(text, text) IS
  'Current slug for a renamed listing, or no row when the slug is not a known redirect.';

-- Both functions are SECURITY DEFINER: the trigger writes slug history regardless of the
-- caller's grants, and the resolver reads a service-role-only table. Nothing but the edge
-- functions may call them.
REVOKE ALL ON FUNCTION public.record_listing_slug_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_listing_slug_redirect(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_listing_slug_redirect(text, text) TO service_role;
