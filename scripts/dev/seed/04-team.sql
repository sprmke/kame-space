-- 04 — Team and RBAC.
--
-- Seeds one member per seeded template at every level, plus a pending invite and
-- one custom role so the team pages show members, invites and custom roles.
--
-- Safe to re-run.


DO $$
DECLARE
  v_owner uuid := 'd74b9d44-6244-40f0-9160-7c281738e8c0';
  v_org uuid := '405ea07f-cc21-4bcc-b540-28729be79f0d';
  v_prop uuid := 'e5555555-5555-4555-8555-555555555501';
  v_park uuid := 'c3333333-3333-4333-8333-333333333301';
  v_manager uuid := '5eed0000-0000-4000-8000-000000000002';
  v_ops uuid := '5eed0000-0000-4000-8000-000000000003';
  v_viewer uuid := '5eed0000-0000-4000-8000-000000000004';
  v_parking_staff uuid := '5eed0000-0000-4000-8000-000000000005';
  v_custom_prop_role uuid := '5eed0400-0400-4000-8000-000000000001';
  v_custom_park_role uuid := '5eed0400-0400-4000-8000-000000000002';
  v_custom_org_role uuid := '5eed0400-0400-4000-8000-000000000003';
  v_full text[] := ARRAY[
    'activity:view','analytics.aiReview:add','analytics:export','analytics:view','assistant:view',
    'bookings.create:add','bookings.detail.guests:edit','bookings.detail.parking:edit','bookings.detail.pets:edit',
    'bookings.detail.pricing:edit','bookings.detail.stay:edit','bookings.detail.workflow:edit','bookings.import:add','bookings:view',
    'finance.export:view','finance.transactions:add','finance.transactions:delete','finance.transactions:edit','finance:view',
    'inbox.automation:edit','inbox.channels:add','inbox.channels:delete','inbox.messages:edit','inbox.quickReplies:add',
    'inbox.quickReplies:delete','inbox.quickReplies:edit','inbox:view',
    'maintenance.export:view','maintenance.reminders:add','maintenance.reminders:delete','maintenance.reminders:edit','maintenance:view',
    'marketing.content:add','marketing.content:edit','marketing.generate.image:add','marketing.generate.video:add','marketing.generate:add',
    'marketing.media:add','marketing.media:delete','marketing.publish:add','marketing.templates:add','marketing.templates:delete',
    'marketing.templates:edit','marketing:view',
    'notifications.chat:edit','notifications.finance:edit','notifications.maintenance:edit','notifications.marketing:edit',
    'notifications.operations:edit','notifications.staff:edit','notifications:view',
    'pricing.blocks:add','pricing.blocks:delete','pricing.channels:edit','pricing.channels:view','pricing.rates:edit',
    'pricing.smartPricing:edit','pricing:view',
    'publicPages.property:edit','publicPages.showcase:edit','publicPages.stayGuide:edit','publicPages:view',
    'reviews.guests:edit','reviews.responses:edit','reviews:view',
    'settings.amenities:edit','settings.basicInfo:edit','settings.buildingForms:edit','settings.cancellationPolicy:edit',
    'settings.emailAutomations:edit','settings.guestForm:edit','settings.houseRules:edit','settings.integrations:view',
    'settings.listingStatus:edit','settings.location:edit','settings.media:edit','settings.payment:edit',
    'settings.propertyDetails:edit','settings.socials:edit','settings:view',
    'team.customRoles:add','team.customRoles:delete','team.customRoles:edit','team.invitations:add','team.invitations:delete',
    'team.invitations:edit','team.members:delete','team.members:edit','team:view',
    'templates.custom:add','templates.custom:delete','templates.custom:edit','templates.email:edit','templates.standard:edit','templates:view'
  ];
  v_operations text[] := ARRAY[
    'bookings:view','bookings.create:add','bookings.detail.stay:edit','bookings.detail.guests:edit','bookings.detail.parking:edit',
    'bookings.detail.pets:edit','bookings.detail.pricing:edit','bookings.detail.workflow:edit','reviews:view','reviews.guests:edit',
    'reviews.responses:edit','maintenance:view','maintenance.reminders:add','maintenance.reminders:edit','maintenance.reminders:delete',
    'maintenance.export:view','notifications:view','templates:view','publicPages:view','pricing:view','pricing.channels:view',
    'pricing.channels:edit','inbox:view','inbox.messages:edit','marketing:view','marketing.content:add','marketing.content:edit',
    'marketing.templates:add','marketing.templates:edit','marketing.templates:delete','marketing.generate:add','marketing.media:add',
    'marketing.media:delete','marketing.publish:add','analytics:view','assistant:view','activity:view'
  ];
  v_readonly text[] := ARRAY[
    'bookings:view','reviews:view','maintenance:view','notifications:view','templates:view','publicPages:view',
    'pricing:view','pricing.channels:view','team:view','inbox:view','analytics:view','activity:view'
  ];
BEGIN
  ---------------------------------------------------------------------------
  -- Organization team
  ---------------------------------------------------------------------------
  INSERT INTO public.organization_custom_roles (id, organization_id, name, permissions, all_listings)
  VALUES (
    v_custom_org_role, v_org, 'Finance Reviewer',
    '["org.finance:view","org.analytics:view"]'::jsonb, true
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    permissions = EXCLUDED.permissions,
    all_listings = EXCLUDED.all_listings,
    updated_at = now();

  INSERT INTO public.organization_invitations (
    organization_id, email, role_id, token, expires_at, status, sent_by, display_name, permissions, all_listings
  )
  VALUES (
    v_org, 'pending.admin@example.com', 'ADMIN', 'local-seed-org-invite-1',
    now() + interval '14 days', 'pending', v_owner, 'Pending Admin', '[]'::jsonb, true
  )
  ON CONFLICT (organization_id, lower(TRIM(BOTH FROM email))) WHERE status = 'pending' DO NOTHING;

  ---------------------------------------------------------------------------
  -- Property team
  ---------------------------------------------------------------------------
  INSERT INTO public.property_custom_roles (id, property_id, name, permissions)
  VALUES (
    v_custom_prop_role, v_prop, 'Bookings Desk',
    '["bookings:view","bookings.create:add","bookings.detail.workflow:edit","inbox:view"]'::jsonb
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    permissions = EXCLUDED.permissions,
    updated_at = now();

  INSERT INTO public.property_members (
    property_id, user_id, role_id, permissions, status, invited_by, display_name, assigned_via_org
  )
  VALUES
    (v_prop, v_manager, 'ADMIN', to_jsonb(v_full), 'active', v_owner, 'Demo Manager', false),
    (v_prop, v_ops, 'ADMIN', to_jsonb(v_operations), 'active', v_owner, 'Demo Operations', false),
    (v_prop, v_viewer, 'ADMIN', to_jsonb(v_readonly), 'active', v_owner, 'Demo Viewer', false)
  ON CONFLICT (property_id, user_id) DO UPDATE SET
    role_id = EXCLUDED.role_id,
    permissions = EXCLUDED.permissions,
    status = EXCLUDED.status,
    display_name = EXCLUDED.display_name,
    updated_at = now();

  INSERT INTO public.property_invitations (
    property_id, email, role_id, permissions, token, expires_at, status, sent_by, display_name
  )
  VALUES (
    v_prop, 'pending.team@example.com', 'ADMIN', to_jsonb(v_readonly),
    'local-seed-property-invite-1', now() + interval '14 days', 'pending', v_owner, 'Pending Team Member'
  )
  ON CONFLICT (property_id, lower(TRIM(BOTH FROM email))) WHERE status = 'pending' DO NOTHING;

  ---------------------------------------------------------------------------
  -- Parking team
  ---------------------------------------------------------------------------
  INSERT INTO public.parking_custom_roles (id, parking_id, name, permissions)
  VALUES (
    v_custom_park_role, v_park, 'Overnight Attendant',
    '["bookings:view","inbox:view"]'::jsonb
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    permissions = EXCLUDED.permissions,
    updated_at = now();

  INSERT INTO public.parking_members (
    parking_id, user_id, role_id, permissions, status, invited_by, display_name
  )
  VALUES
    (v_park, v_manager, 'MANAGER', '[]'::jsonb, 'active', v_owner, 'Demo Manager'),
    (v_park, v_parking_staff, 'STAFF', '[]'::jsonb, 'active', v_owner, 'Demo Parking Staff'),
    (v_park, v_viewer, 'VIEWER', '[]'::jsonb, 'active', v_owner, 'Demo Viewer')
  ON CONFLICT (parking_id, user_id) DO UPDATE SET
    role_id = EXCLUDED.role_id,
    status = EXCLUDED.status,
    display_name = EXCLUDED.display_name,
    updated_at = now();

  INSERT INTO public.parking_invitations (
    parking_id, email, role_id, permissions, token, expires_at, status, sent_by, display_name
  )
  VALUES (
    v_park, 'pending.parking@example.com', 'STAFF', '[]'::jsonb,
    'local-seed-parking-invite-1', now() + interval '14 days', 'pending', v_owner, 'Pending Parking Staff'
  )
  ON CONFLICT (parking_id, lower(TRIM(BOTH FROM email))) WHERE status = 'pending' DO NOTHING;

  RAISE NOTICE 'local seed: team seeded at org, property and parking level';
END $$;

