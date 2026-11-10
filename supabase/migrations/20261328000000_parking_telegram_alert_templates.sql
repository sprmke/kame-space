-- M-11 follow-up: the new in-app host alerts also need Telegram delivery. Add templates and
-- toggles next to the existing reservation/check-in/payment templates. Defaults match the
-- in-app copy and default on so existing hosts get the same coverage after migration.

BEGIN;

ALTER TABLE public.telegram_parking_settings
  ADD COLUMN IF NOT EXISTS request_cancelled_template TEXT NOT NULL DEFAULT
    'Guest cancelled parking {{slot_label}} for {{check_in_date}}.',
  ADD COLUMN IF NOT EXISTS payment_expired_template TEXT NOT NULL DEFAULT
    'Payment window expired for parking {{slot_label}}. The request is searching again.',
  ADD COLUMN IF NOT EXISTS endorsement_failed_template TEXT NOT NULL DEFAULT
    'Endorsement failed for {{slot_label}} at {{residence_name}}. Add the PMO email and resend.',
  ADD COLUMN IF NOT EXISTS notify_on_request_cancelled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_on_payment_expired BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_on_endorsement_failed BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.telegram_parking_settings.request_cancelled_template IS
  'Telegram alert when a guest cancels a parking request or an unpaid claim.';
COMMENT ON COLUMN public.telegram_parking_settings.payment_expired_template IS
  'Telegram alert when a guest payment window lapses and the request resumes searching.';
COMMENT ON COLUMN public.telegram_parking_settings.endorsement_failed_template IS
  'Telegram alert when the PMO endorsement email fails and the host must add the PMO email.';

COMMIT;
