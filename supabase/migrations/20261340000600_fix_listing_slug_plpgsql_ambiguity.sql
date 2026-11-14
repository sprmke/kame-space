-- Fix PL/pgSQL variable/column name clashes in listing slug triggers.
-- `family` / `next_slug` collided with listing_slug_redirects columns and broke renames.

CREATE OR REPLACE FUNCTION public.record_listing_slug_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  p_family text := TG_ARGV[0];
  p_next_slug text := NEW.slug;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;
  IF OLD.slug IS NOT DISTINCT FROM p_next_slug THEN
    RETURN NEW;
  END IF;
  IF p_next_slug IS NULL OR btrim(p_next_slug) = '' THEN
    RETURN NEW;
  END IF;

  -- A slug can only point at one listing. Reclaiming a slug for this listing must clear any
  -- older redirect that claims it, otherwise the redirect would send guests to a stranger.
  DELETE FROM public.listing_slug_redirects r
   WHERE r.family = p_family AND r.old_slug = p_next_slug;

  IF OLD.slug IS NOT NULL AND btrim(OLD.slug) <> '' THEN
    INSERT INTO public.listing_slug_redirects (family, old_slug, listing_id)
    VALUES (p_family, OLD.slug, NEW.id)
    ON CONFLICT (family, old_slug)
    DO UPDATE SET listing_id = EXCLUDED.listing_id, created_at = now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_listing_slug_not_redirect_reserved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  p_family text := TG_ARGV[0];
  p_next_slug text := NEW.slug;
  holder uuid;
BEGIN
  IF p_next_slug IS NULL OR btrim(p_next_slug) = '' THEN
    RETURN NEW;
  END IF;

  SELECT r.listing_id
    INTO holder
    FROM public.listing_slug_redirects r
   WHERE r.family = p_family
     AND r.old_slug = p_next_slug
   LIMIT 1;

  IF holder IS NOT NULL AND holder IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'slug "%" is reserved by a listing redirect', p_next_slug
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;
