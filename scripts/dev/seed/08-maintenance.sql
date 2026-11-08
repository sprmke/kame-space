-- 08 — Maintenance.
--
-- 20 items: overdue, due soon, upcoming and completed, with priorities implied by
-- category/notes and a mix of recurring schedules.
--
-- Safe to re-run: replaces rows tagged created_by = 'local_seed'.


DO $$
DECLARE
  v_prop uuid := 'e5555555-5555-4555-8555-555555555501';
BEGIN
  DELETE FROM public.maintenance_items WHERE created_by = 'local_seed';

  INSERT INTO public.maintenance_items (
    id, label, category, scheduled_on, notes, completed_at, created_by, property_id,
    recurrence_interval, telegram_reminder_enabled
  )
  SELECT
    format('5eed3000-0000-4000-8000-%s', lpad(g.i::text, 12, '0'))::uuid,
    (ARRAY[
      'Deep clean living area','Replace aircon filter','Check water heater','Test smoke alarms',
      'Clean balcony railing','Repaint kitchen wall','Service refrigerator','Descale kettle',
      'Inspect plumbing under sink','Replace shower head','Clean pool deck furniture','Pest control',
      'Wash curtains','Polish floor tiles','Check door locks','Replace light bulbs',
      'Clean exhaust fan','Inspect window seals','Sanitize remote controls','Restock first aid kit'
    ])[g.i + 1],
    (ARRAY['Cleaning','HVAC','Plumbing','Safety','Repairs','Appliances','General'])[1 + (g.i % 7)],
    CURRENT_DATE + (CASE WHEN g.i < 7 THEN -(g.i + 1) WHEN g.i < 14 THEN g.i - 6 ELSE 5 + (g.i % 10) END),
    'Local demo maintenance task',
    CASE WHEN g.i >= 14 THEN now() - ((g.i - 10) || ' days')::interval END,
    'local_seed',
    v_prop,
    CASE WHEN g.i % 4 = 0 THEN 'monthly' WHEN g.i % 5 = 0 THEN 'quarterly' END,
    (g.i % 3 = 0)
  FROM generate_series(0, 19) AS g(i);

  RAISE NOTICE 'local seed: % maintenance items', (SELECT count(*) FROM public.maintenance_items WHERE created_by = 'local_seed');
END $$;

