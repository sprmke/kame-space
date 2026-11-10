-- Guest post-booking journey: structured arrival essentials, guest-visible host templates,
-- and the idempotency columns the send-once emails need.
--
-- Plan: docs/workflow/in-progress/guest-post-booking-journey.md
--
-- Why a separate essentials table and not `properties.settings`: `settings` is returned by
-- every public listing read, so a Wi-Fi password or a door code stored there would leak to
-- anyone browsing. Only `get-guest-trip` and `get-guest-stay-guide` read this table, and
-- they withhold the secrets until the reveal time.

CREATE TABLE IF NOT EXISTS public.property_guest_essentials (
  property_id UUID PRIMARY KEY REFERENCES public.properties(id) ON DELETE CASCADE,
  wifi_name TEXT,
  wifi_password TEXT,
  -- Door / lock / lockbox code. Rotating codes are overridden per booking.
  door_code TEXT,
  unit_floor TEXT,
  parking_slot_note TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  building_security_phone TEXT,
  garbage_schedule TEXT,
  quiet_hours TEXT,
  -- How long before check-in the secrets may be read. 24h default per plan D5.
  reveal_lead_hours INTEGER NOT NULL DEFAULT 24
    CONSTRAINT property_guest_essentials_reveal_lead_hours_range
    CHECK (reveal_lead_hours BETWEEN 0 AND 720),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.property_guest_essentials ENABLE ROW LEVEL SECURITY;

-- Access is enforced in the edge functions, as with property_template_contents.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_guest_essentials TO service_role;

COMMENT ON TABLE public.property_guest_essentials IS
  'Structured arrival essentials per property (Wi-Fi, door code, unit, contacts). Read only by get-guest-trip and get-guest-stay-guide; secrets withheld until the reveal time.';

-- Per-booking override for a rotating code (plan D7). Never contains Wi-Fi or contacts.
ALTER TABLE public.guest_submissions
  ADD COLUMN IF NOT EXISTS guest_essentials_override JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.guest_submissions.guest_essentials_override IS
  'Per-booking essential overrides, e.g. {"doorCode": "4821"} for a rotating lock. Merged over property_guest_essentials when the trip payload is built.';

-- Send-once email idempotency (request received on submit, pre-arrival reminder cron).
ALTER TABLE public.guest_submissions
  ADD COLUMN IF NOT EXISTS request_received_emailed_at TIMESTAMPTZ;
ALTER TABLE public.guest_submissions
  ADD COLUMN IF NOT EXISTS pre_arrival_emailed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.guest_submissions.request_received_emailed_at IS
  'When the "Request received" guest email was sent. Makes a retried submit idempotent.';
COMMENT ON COLUMN public.guest_submissions.pre_arrival_emailed_at IS
  'When the pre-arrival reminder email was sent. Idempotency key for the reminder cron.';

-- Guest-visible custom templates (plan D8).
ALTER TABLE public.property_template_contents
  ADD COLUMN IF NOT EXISTS guest_visible BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.property_template_contents
  ADD COLUMN IF NOT EXISTS guest_phase TEXT;

ALTER TABLE public.property_template_contents
  DROP CONSTRAINT IF EXISTS property_template_contents_guest_phase_check;
ALTER TABLE public.property_template_contents
  ADD CONSTRAINT property_template_contents_guest_phase_check
  CHECK (
    guest_phase IS NULL
    OR guest_phase IN ('before', 'arrival', 'stay', 'checkout', 'after', 'always')
  );

COMMENT ON COLUMN public.property_template_contents.guest_visible IS
  'Custom templates only: render this template on the guest trip page and in the stay guide.';
COMMENT ON COLUMN public.property_template_contents.guest_phase IS
  'Custom templates only: which trip phase shows this template. NULL means "always".';

-- Host notification when a guest sends a balance payment receipt from the trip page
-- (plan 3.3 / 7.5). Carries every type from 20261316129020 plus the addition.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN (
    'booking_pending_review',
    'booking_ready_for_checkin',
    'booking_ready_for_checkout',
    'booking_sd_refund_due',
    'booking_gaf_auto_approved',
    'booking_pet_auto_approved',
    'booking_parking_matched',
    'inbox_new_message',
    'calendar_sync_failing',
    'calendar_conflict',
    'booking_external_imported',
    'booking_guest_form_completed',
    'smart_pricing_updated',
    'property_settings_copied',
    'analytics_review_updated',
    'review_received',
    'review_due',
    'review_response_received',
    'maintenance_guest_reported',
    'guest_request_submitted',
    'booking_receipt_uploaded'
  )
);
