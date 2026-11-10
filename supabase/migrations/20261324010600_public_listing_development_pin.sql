-- Multi-residence Phase 1: the public search pin comes from the development row.
--
-- Before this migration `pls_listing_lat` / `pls_listing_lng` returned the Azure North
-- literal for any listing named "Azure North Residences". A second residence with no pin of
-- its own therefore had no coordinates, and the pin was a code constant rather than data.
--
-- Rather than copy the three large `pls_refresh_*` functions to change two arguments, this
-- keeps a single fill rule: when a search row has no pin, take the coordinates of the
-- development with the same denormalized name. The name is kept in sync on rename
-- (`update-development`), so it stays a reliable join key until Phase 7 retires it.

CREATE OR REPLACE FUNCTION public.pls_fill_development_pin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lat double precision;
  v_lng double precision;
BEGIN
  IF NEW.residence_name IS NULL OR public.pls_trim(NEW.residence_name) = '' THEN
    RETURN NEW;
  END IF;
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    public.pls_try_number(d.settings -> 'latitude'),
    public.pls_try_number(d.settings -> 'longitude')
  INTO v_lat, v_lng
  FROM public.developments d
  WHERE lower(public.pls_trim(d.name)) = lower(public.pls_trim(NEW.residence_name))
  LIMIT 1;

  IF NEW.lat IS NULL THEN
    NEW.lat := v_lat;
  END IF;
  IF NEW.lng IS NULL THEN
    NEW.lng := v_lng;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pls_trg_development_pin ON public.public_listing_search;

CREATE TRIGGER pls_trg_development_pin
  BEFORE INSERT OR UPDATE ON public.public_listing_search
  FOR EACH ROW
  EXECUTE FUNCTION public.pls_fill_development_pin();

-- Backfill rows indexed before the development pin existed.
UPDATE public.public_listing_search t
SET lat = public.pls_try_number(d.settings -> 'latitude'),
    lng = public.pls_try_number(d.settings -> 'longitude')
FROM public.developments d
WHERE t.lat IS NULL
  AND t.residence_name IS NOT NULL
  AND lower(public.pls_trim(d.name)) = lower(public.pls_trim(t.residence_name))
  AND public.pls_try_number(d.settings -> 'latitude') IS NOT NULL
  AND public.pls_try_number(d.settings -> 'longitude') IS NOT NULL;

-- A trigger function is never called by an API role.
REVOKE ALL ON FUNCTION public.pls_fill_development_pin() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.pls_fill_development_pin() IS
  'Fills a missing public search pin from the matching development settings. Runs before insert/update on public_listing_search.';

-- The TypeScript fallback moves to the same rule.
COMMENT ON FUNCTION public.pls_listing_lat(jsonb, text) IS
  'Property settings pin only. Azure North''s literal remains as a last-resort fallback for rows indexed before the development pin; new rows are filled by pls_trg_development_pin.';
