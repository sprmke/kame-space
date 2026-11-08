-- 10 — Marketing Studio.
--
-- 3 themes, 6 templates, 12 media assets, 9 publications (draft/scheduled/
-- published/failed) and 2 AI sessions. Media uses remote Unsplash URLs so a
-- reset stays fast; storage prices are zero because nothing is uploaded.
--
-- Safe to re-run.


DO $$
DECLARE
  v_org uuid := '405ea07f-cc21-4bcc-b540-28729be79f0d';
  v_prop uuid := 'e5555555-5555-4555-8555-555555555501';
  v_theme uuid;
  v_conn uuid;
  v_session uuid := '5eed4000-0000-4000-8000-000000000901';
BEGIN
  DELETE FROM public.marketing_publications WHERE organization_id = v_org AND id::text LIKE '5eed4%';
  DELETE FROM public.marketing_media_assets WHERE org_id = v_org AND id::text LIKE '5eed4%';
  DELETE FROM public.marketing_templates WHERE organization_id = v_org AND id::text LIKE '5eed4%';
  DELETE FROM public.marketing_ai_sessions WHERE organization_id = v_org AND id::text LIKE '5eed4%';
  DELETE FROM public.marketing_themes WHERE organization_id = v_org AND id::text LIKE '5eed4%';

  INSERT INTO public.marketing_themes (id, property_id, organization_id, name, tokens, source)
  VALUES
    ('5eed4100-0000-4000-8000-000000000001', v_prop, v_org, 'Quiet Coast',
     '{"background":"#f8f5ef","foreground":"#123c36","accent":"#0f766e","muted":"#d9e8e2","font":"Plus Jakarta Sans"}'::jsonb, 'starter'),
    ('5eed4100-0000-4000-8000-000000000002', v_prop, v_org, 'Lagoon Blue',
     '{"background":"#eef7fb","foreground":"#0b3b53","accent":"#0891b2","muted":"#cfe9f3","font":"Plus Jakarta Sans"}'::jsonb, 'starter'),
    ('5eed4100-0000-4000-8000-000000000003', v_prop, v_org, 'Warm Sand',
     '{"background":"#fdf6ec","foreground":"#4a3419","accent":"#c2751a","muted":"#f1ddc0","font":"Plus Jakarta Sans"}'::jsonb, 'custom')
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    tokens = EXCLUDED.tokens,
    source = EXCLUDED.source,
    updated_at = now();

  INSERT INTO public.marketing_templates (
    id, property_id, organization_id, name, content_type, platform, aspect_preset,
    design_json, theme_key, kind
  )
  VALUES
    ('5eed4200-0000-4000-8000-000000000001', v_prop, v_org, 'Weekend availability', 'design', 'facebook', 'square', '{"version":1,"layers":[]}'::jsonb, 'Quiet Coast', 'template'),
    ('5eed4200-0000-4000-8000-000000000002', v_prop, v_org, 'Last-minute rate', 'design', 'instagram', 'portrait', '{"version":1,"layers":[]}'::jsonb, 'Lagoon Blue', 'template'),
    ('5eed4200-0000-4000-8000-000000000003', v_prop, v_org, 'Guest love quote', 'design', 'instagram', 'square', '{"version":1,"layers":[]}'::jsonb, 'Warm Sand', 'template'),
    ('5eed4200-0000-4000-8000-000000000004', v_prop, v_org, 'Monthly calendar', 'calendar', 'instagram', 'portrait', '{"version":1,"days":[]}'::jsonb, 'Quiet Coast', 'template'),
    ('5eed4200-0000-4000-8000-000000000005', v_prop, v_org, 'Lagoon walkthrough', 'video', 'instagram', 'portrait', '{"version":1,"scenes":[]}'::jsonb, 'Lagoon Blue', 'template'),
    ('5eed4200-0000-4000-8000-000000000006', v_prop, v_org, 'Saved draft post', 'design', 'facebook', 'landscape', '{"version":1,"layers":[]}'::jsonb, 'Warm Sand', 'design')
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    content_type = EXCLUDED.content_type,
    platform = EXCLUDED.platform,
    aspect_preset = EXCLUDED.aspect_preset,
    design_json = EXCLUDED.design_json,
    theme_key = EXCLUDED.theme_key,
    kind = EXCLUDED.kind,
    updated_at = now();

  INSERT INTO public.marketing_media_assets (
    id, org_id, property_id, kind, status, source, bucket, storage_path, file_name,
    mime_type, reserved_bytes, size_bytes, width, height, duration_ms, content_hash, meta,
    created_at
  )
  SELECT
    format('5eed4300-0000-4000-8000-%s', lpad(g.i::text, 12, '0'))::uuid,
    v_org, v_prop,
    (ARRAY['image','image','image','image','image','image','image','image','image','image','video','audio'])[g.i + 1],
    'ready',
    CASE WHEN g.i = 10 THEN 'ai' WHEN g.i = 11 THEN 'music_upload' ELSE 'upload' END,
    'marketing',
    'seed/remote/asset-' || g.i,
    (ARRAY['living-room.jpg','bedroom.jpg','kitchen.jpg','balcony.jpg','lagoon.jpg','lobby.jpg','pool.jpg','night-view.jpg','bathroom.jpg','dining.jpg','walkthrough.mp4','lofi-loop.mp3'])[g.i + 1],
    CASE WHEN g.i = 10 THEN 'video/mp4' WHEN g.i = 11 THEN 'audio/mpeg' ELSE 'image/jpeg' END,
    CASE WHEN g.i = 10 THEN 2500000 WHEN g.i = 11 THEN 900000 ELSE 420000 END,
    CASE WHEN g.i = 10 THEN 2500000 WHEN g.i = 11 THEN 900000 ELSE 420000 END,
    CASE WHEN g.i = 10 THEN 1080 WHEN g.i = 11 THEN NULL ELSE 1200 END,
    CASE WHEN g.i = 10 THEN 1920 WHEN g.i = 11 THEN NULL ELSE 800 END,
    CASE WHEN g.i = 10 THEN 22000 WHEN g.i = 11 THEN 30000 ELSE NULL END,
    'seed-hash-' || g.i,
    jsonb_build_object('url', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=85', 'seed', true),
    now() - ((g.i + 1) || ' days')::interval
  FROM generate_series(0, 11) AS g(i);

  ---------------------------------------------------------------------------
  -- Publications: 4 drafts, 2 scheduled, 3 published, 2 failed
  ---------------------------------------------------------------------------
  INSERT INTO public.social_channel_connections (
    id, organization_id, platform, external_account_id, display_name, status, property_id
  )
  VALUES (
    '5eed5000-0000-4000-8000-000000000001', v_org, 'facebook', 'seed-fb-page-001',
    'Kame Space Demo Page', 'connected', v_prop
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    status = EXCLUDED.status,
    updated_at = now();

  SELECT id INTO v_conn FROM public.social_channel_connections
  WHERE id = '5eed5000-0000-4000-8000-000000000001';

  INSERT INTO public.marketing_publications (
    id, property_id, organization_id, connection_id, platform, publish_type,
    media_url, caption, status, scheduled_at, published_at, error_message
  )
  VALUES
    ('5eed4400-0000-4000-8000-000000000001', v_prop, v_org, v_conn, 'facebook', 'post',
     'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=85',
     'Weekend at Monaco 2604. Lagoon view, fast Wi-Fi, free parking.', 'pending',
     now() + interval '3 days', NULL, NULL),
    ('5eed4400-0000-4000-8000-000000000002', v_prop, v_org, v_conn, 'instagram', 'post',
     'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=85',
     'Two-bedroom comfort for the whole family.', 'pending',
     now() + interval '5 days', NULL, NULL),
    ('5eed4400-0000-4000-8000-000000000003', v_prop, v_org, v_conn, 'facebook', 'post',
     'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=85',
     'Slow mornings in San Fernando.', 'pending', NULL, NULL, NULL),
    ('5eed4400-0000-4000-8000-000000000004', v_prop, v_org, v_conn, 'instagram', 'reel',
     'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=85',
     'Lagoon walkthrough, 20 seconds.', 'pending', NULL, NULL, NULL),
    ('5eed4400-0000-4000-8000-000000000005', v_prop, v_org, v_conn, 'facebook', 'post',
     'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=85',
     'Now open for December stays.', 'published', now() - interval '10 days',
     now() - interval '10 days', NULL),
    ('5eed4400-0000-4000-8000-000000000006', v_prop, v_org, v_conn, 'instagram', 'story',
     'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=85',
     'Pool day. Book the weekend.', 'published', now() - interval '7 days',
     now() - interval '7 days', NULL),
    ('5eed4400-0000-4000-8000-000000000007', v_prop, v_org, v_conn, 'facebook', 'post',
     'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=85',
     'Guest review spotlight.', 'published', now() - interval '2 days',
     now() - interval '2 days', NULL),
    ('5eed4400-0000-4000-8000-000000000008', v_prop, v_org, v_conn, 'instagram', 'post',
     'https://images.unsplash.com/photo-1590674899484-f5649e4292cf?w=1200&q=85',
     'Parking slot now bookable.', 'failed', now() - interval '4 days', NULL,
     'Instagram token expired'),
    ('5eed4400-0000-4000-8000-000000000009', v_prop, v_org, v_conn, 'facebook', 'post',
     'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=85',
     'Holiday dates open.', 'failed', now() - interval '1 day', NULL, 'Media upload failed')
  ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    scheduled_at = EXCLUDED.scheduled_at,
    published_at = EXCLUDED.published_at,
    error_message = EXCLUDED.error_message,
    caption = EXCLUDED.caption;

  INSERT INTO public.marketing_ai_sessions (
    id, organization_id, property_id, output, title, theme_key, created_by
  )
  VALUES
    (v_session, v_org, v_prop, 'post', 'December weekend promo', 'Quiet Coast',
     'd74b9d44-6244-40f0-9160-7c281738e8c0'),
    ('5eed4000-0000-4000-8000-000000000902', v_org, v_prop, 'image', 'Lagoon hero image', 'Lagoon Blue',
     'd74b9d44-6244-40f0-9160-7c281738e8c0')
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    theme_key = EXCLUDED.theme_key,
    updated_at = now();

  RAISE NOTICE 'local seed: marketing seeded (3 themes, 6 templates, 12 media, 9 publications)';
END $$;

