-- 22 — Marketing Trends.
--
-- One published run with today's list and the week window, so the host UI and
-- the super-admin moderation page work offline without waiting for the cron.
--
-- The rows are marked with a stable id prefix so a re-run replaces them instead
-- of stacking another day of history.
--
-- Safe to re-run.

DO $$
DECLARE
  v_run_date date := (now() AT TIME ZONE 'Asia/Manila')::date;
  v_run_id uuid := '5eedc001-0000-4000-8000-000000000001';
  v_now_iso text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
BEGIN
  DELETE FROM public.marketing_trend_topics WHERE run_id = v_run_id;
  DELETE FROM public.marketing_trend_runs WHERE id = v_run_id;

  INSERT INTO public.marketing_trend_runs (
    id, run_date, status, trigger, source_stats, ai_provider, ai_model,
    candidate_count, topic_count, started_at, finished_at
  ) VALUES (
    v_run_id,
    v_run_date,
    'published',
    'cron',
    jsonb_build_object(
      'google_trends', jsonb_build_object('ok', true, 'count', 10, 'ms', 420, 'error', NULL),
      'wikimedia_ph', jsonb_build_object('ok', true, 'count', 20, 'ms', 310, 'error', NULL),
      'wikimedia_tl', jsonb_build_object('ok', true, 'count', 20, 'ms', 280, 'error', NULL),
      'apple_music', jsonb_build_object('ok', true, 'count', 25, 'ms', 640, 'error', NULL),
      'netflix', jsonb_build_object('ok', false, 'count', 0, 'ms', 0, 'error', 'cached rows are stale')
    ),
    'gemini',
    'gemini-3.1-flash-lite',
    34,
    6,
    v_now_iso,
    v_now_iso
  );

  INSERT INTO public.marketing_trend_topics (
    id, run_id, run_date, window, rank, topic_key, title, summary, category,
    stay_fit, score, momentum, days_trending, first_seen, sources, angles,
    caption_idea, hashtags, brand_guard, pinned, manual
  ) VALUES
  (
    '5eedc002-0000-4000-8000-000000000001', v_run_id, v_run_date, 'today', 1,
    'pinoy-big-brother-collab-3-0', 'PBB Collab 3.0',
    'Fans are following the new housemates this week.',
    'tv_film', 3, 2.1843, 'new', 1, v_run_date,
    jsonb_build_array(
      jsonb_build_object('source', 'google_trends', 'rank', 2, 'traffic', '500+', 'views', NULL, 'newsHeadlines', jsonb_build_array()),
      jsonb_build_object('source', 'wikimedia_ph', 'rank', 6, 'traffic', NULL, 'views', 5100, 'newsHeadlines', jsonb_build_array())
    ),
    jsonb_build_array(
      jsonb_build_object('title', 'Watch party staycation', 'hook', 'Big night on screen, better from a proper stay.', 'output', 'post', 'goal', 'vibe', 'format', 'instagram-portrait', 'prompt', 'A cozy living room with the TV on and snacks out. No logos, no real people.'),
      jsonb_build_object('title', 'Game night staycation', 'hook', 'A group night in, with the group to stay over.', 'output', 'image', 'goal', 'vibe', 'format', '1:1', 'prompt', 'A warm living room set for a group night in, low light, no text, no logos.'),
      jsonb_build_object('title', 'Late night clip', 'hook', 'The night ends at the screen, not at the door.', 'output', 'video', 'goal', 'vibe', 'format', '9:16', 'prompt', 'A slow vertical clip of a room at night: TV glow, curtains, a cup on the table. No people.')
    ),
    'Tonight is a staycation kind of night. Who is watching?',
    ARRAY['#Staycation', '#PBB'], ARRAY['no_likeness', 'no_logo', 'no_endorsement'], false, false
  ),
  (
    '5eedc002-0000-4000-8000-000000000002', v_run_id, v_run_date, 'today', 2,
    'alexandra-eala', 'Alexandra Eala',
    'Another big performance for the Filipino athlete.',
    'sports', 2, 1.4201, 'rising', 2, v_run_date - 1,
    jsonb_build_array(
      jsonb_build_object('source', 'wikimedia_ph', 'rank', 5, 'traffic', NULL, 'views', 5200, 'newsHeadlines', jsonb_build_array())
    ),
    jsonb_build_array(
      jsonb_build_object('title', 'Game night staycation', 'hook', 'A game night is better with a room to stay in.', 'output', 'post', 'goal', 'vibe', 'format', 'instagram-portrait', 'prompt', 'A sports-fan mood board for a rental: a screen, a sofa, team colors that are not a brand. No logos.'),
      jsonb_build_object('title', 'Long weekend post', 'hook', 'The season runs long. Stay for the whole thing.', 'output', 'post', 'goal', 'promo', 'format', 'facebook-post', 'prompt', 'A wide banner for a weekend stay near the action. No team logos, no names.')
    ),
    'The season is not over yet. Book the weekend and watch it somewhere comfortable.',
    ARRAY['#Staycation', '#SportsPH'], ARRAY['no_likeness', 'no_logo', 'no_endorsement'], false, false
  ),
  (
    '5eedc002-0000-4000-8000-000000000003', v_run_id, v_run_date, 'today', 3,
    'christmas-long-weekend', 'Christmas long weekend',
    'The December holidays start, and so does the long weekend.',
    'holiday_event', 3, 1.2876, 'steady', 3, v_run_date - 2,
    jsonb_build_array(
      jsonb_build_object('source', 'google_trends', 'rank', 4, 'traffic', '1K+', 'views', NULL, 'newsHeadlines', jsonb_build_array())
    ),
    jsonb_build_array(
      jsonb_build_object('title', 'Holiday table', 'hook', 'The best part of the season is eating well.', 'output', 'post', 'goal', 'amenity-spotlight', 'format', 'instagram-square', 'prompt', 'A holiday meal in a bright rental kitchen: a long table, home cooking, warm colours. No brand names.'),
      jsonb_build_object('title', 'Gift guide card', 'hook', 'A small gift, a big stay.', 'output', 'post', 'goal', 'promo', 'format', 'instagram-portrait', 'prompt', 'A gift-guide style card with a wrapped box and a warm room behind it. No logos.')
    ),
    'Long weekend, one address, and nobody has to drive home.',
    ARRAY['#Christmas', '#Staycation'], ARRAY[]::text[], false, false
  ),
  (
    '5eedc002-0000-4000-8000-000000000004', v_run_id, v_run_date, 'today', 4,
    'na-para-bang', 'Na Para Bang',
    'The OPM hit on top of the Philippine music chart.',
    'music', 1, 0.9812, 'new', 1, v_run_date,
    jsonb_build_array(
      jsonb_build_object('source', 'apple_music', 'rank', 1, 'traffic', NULL, 'views', NULL, 'newsHeadlines', jsonb_build_array())
    ),
    jsonb_build_array(
      jsonb_build_object('title', 'Music night staycation', 'hook', 'One song on repeat and nowhere to rush.', 'output', 'post', 'goal', 'vibe', 'format', 'instagram-portrait', 'prompt', 'A music-mood living room: a speaker, low light, a balcony. No track names, no faces.')
    ),
    'One song on repeat, one night booked, no reason to leave the room.',
    ARRAY['#Staycation', '#OPM'], ARRAY['no_likeness', 'no_logo', 'no_endorsement'], false, false
  ),
  (
    '5eedc002-0000-4000-8000-000000000005', v_run_id, v_run_date, 'today', 5,
    'sinulog-season', 'Sinulog season',
    'The festival season in Cebu is on.',
    'holiday_event', 2, 0.8432, 'steady', 5, v_run_date - 4,
    jsonb_build_array(
      jsonb_build_object('source', 'wikimedia_tl', 'rank', 9, 'traffic', NULL, 'views', 106, 'newsHeadlines', jsonb_build_array())
    ),
    jsonb_build_array(
      jsonb_build_object('title', 'Festival weekend', 'hook', 'The drums start early. Stay close.', 'output', 'post', 'goal', 'promo', 'format', 'facebook-post', 'prompt', 'A festival-weekend banner for a city stay: warm lights, a street at dawn, no religious imagery, no logos.')
    ),
    'Festival season, and the room is closer than the crowd.',
    ARRAY['#Sinulog', '#TravelPH'], ARRAY[]::text[], false, false
  ),
  (
    '5eedc002-0000-4000-8000-000000000006', v_run_id, v_run_date, 'today', 6,
    'nintendo-switch-update', 'Nintendo update',
    'A new console update is what people are searching for.',
    'gaming', 1, 0.7215, 'new', 1, v_run_date,
    jsonb_build_array(
      jsonb_build_object('source', 'google_trends', 'rank', 1, 'traffic', '200+', 'views', NULL, 'newsHeadlines', jsonb_build_array())
    ),
    jsonb_build_array(
      jsonb_build_object('title', 'Game night staycation', 'hook', 'Bring the console, stay the night.', 'output', 'post', 'goal', 'vibe', 'format', 'instagram-square', 'prompt', 'A game-night room with a TV and a sofa. No console branding, no screens with logos.')
    ),
    'Bring the console. The rest of the night is the stay.',
    ARRAY['#Staycation', '#GameNight'], ARRAY['no_logo'], false, false
  );

  -- The week window reuses the same topics, scored by their run.
  INSERT INTO public.marketing_trend_topics (
    id, run_id, run_date, window, rank, topic_key, title, summary, category,
    stay_fit, score, momentum, days_trending, first_seen, sources, angles,
    caption_idea, hashtags, brand_guard, pinned, manual
  )
  SELECT
    '5eedc003-0000-4000-8000-' || lpad((row_number() OVER (ORDER BY t.score DESC))::text, 12, '0'),
    v_run_id, v_run_date, 'week', (row_number() OVER (ORDER BY t.score DESC))::int,
    t.topic_key, t.title, t.summary, t.category, t.stay_fit, t.score, t.momentum,
    t.days_trending, t.first_seen, t.sources, t.angles, t.caption_idea, t.hashtags,
    t.brand_guard, t.pinned, t.manual
  FROM public.marketing_trend_topics t
  WHERE t.run_id = v_run_id AND t.window = 'today';
END $$;
