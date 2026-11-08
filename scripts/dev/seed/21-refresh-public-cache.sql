-- 21 — Public listing cache.
--
-- Seeded properties, parkings, developments and reviews fire the listing-search
-- triggers, but bumping the catalog version guarantees cached public reads see
-- the new dataset immediately.
--
-- Safe to re-run. One DO block so `supabase db query -f` sees a single statement.

DO $$
DECLARE
  v_rows integer;
BEGIN
  UPDATE public.public_listing_catalog_version
  SET version = version + 1,
      updated_at = now()
  WHERE family IN ('property', 'development', 'parking');

  SELECT count(*) INTO v_rows FROM public.public_listing_search;
  IF v_rows = 0 THEN
    RAISE WARNING 'local seed: public_listing_search is empty — check the listing triggers';
  ELSE
    RAISE NOTICE 'local seed: public listing cache refreshed (% rows)', v_rows;
  END IF;
END $$;
