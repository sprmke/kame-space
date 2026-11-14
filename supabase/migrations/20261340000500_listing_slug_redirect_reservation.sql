-- Reserve historical listing slugs so another listing cannot claim them while a redirect exists.
-- Complements SEO-17.2: allocate* skips reserved slugs in app code; this trigger is the DB backstop
-- for any path that writes slug without going through allocate (e.g. update-development body.slug).

CREATE OR REPLACE FUNCTION public.assert_listing_slug_not_redirect_reserved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  family text := TG_ARGV[0];
  next_slug text := NEW.slug;
  holder uuid;
BEGIN
  IF next_slug IS NULL OR btrim(next_slug) = '' THEN
    RETURN NEW;
  END IF;

  SELECT r.listing_id
    INTO holder
    FROM public.listing_slug_redirects r
   WHERE r.family = family
     AND r.old_slug = next_slug
   LIMIT 1;

  IF holder IS NOT NULL AND holder IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'slug "%" is reserved by a listing redirect', next_slug
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.assert_listing_slug_not_redirect_reserved() IS
  'BEFORE INSERT/UPDATE OF slug: block taking another listing''s historical public slug while its redirect still exists.';

DROP TRIGGER IF EXISTS assert_slug_not_redirect_reserved ON public.properties;
CREATE TRIGGER assert_slug_not_redirect_reserved
  BEFORE INSERT OR UPDATE OF slug ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.assert_listing_slug_not_redirect_reserved('property');

DROP TRIGGER IF EXISTS assert_slug_not_redirect_reserved ON public.parkings;
CREATE TRIGGER assert_slug_not_redirect_reserved
  BEFORE INSERT OR UPDATE OF slug ON public.parkings
  FOR EACH ROW EXECUTE FUNCTION public.assert_listing_slug_not_redirect_reserved('parking');

DROP TRIGGER IF EXISTS assert_slug_not_redirect_reserved ON public.developments;
CREATE TRIGGER assert_slug_not_redirect_reserved
  BEFORE INSERT OR UPDATE OF slug ON public.developments
  FOR EACH ROW EXECUTE FUNCTION public.assert_listing_slug_not_redirect_reserved('development');

REVOKE ALL ON FUNCTION public.assert_listing_slug_not_redirect_reserved() FROM PUBLIC, anon, authenticated;
