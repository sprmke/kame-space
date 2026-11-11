-- The stay guide link works from the day it is emailed.
--
-- `stay_guide_valid_from` used to be Manila midnight on check-in day, while the
-- ready-for-check-in email goes out as soon as the booking reaches READY_FOR_CHECKIN. A guest
-- approved early tapped the button and got "This stay guide isn't available" (guest journey
-- plan, finding D1).
--
-- New tokens open at issue time (see `computeStayGuideValidityWindow`). This backfills the
-- tokens already in the wild so those guests are not stranded: any token whose window has not
-- opened yet is opened now. `valid_until` is untouched, and access is still limited to the
-- eligible statuses.

UPDATE public.guest_submissions
SET stay_guide_valid_from = NOW()
WHERE stay_guide_token IS NOT NULL
  AND stay_guide_valid_from IS NOT NULL
  AND stay_guide_valid_from > NOW()
  AND status IN (
    'READY_FOR_CHECKIN',
    'READY_FOR_CHECKOUT',
    'PENDING_SD_REFUND',
    'COMPLETED'
  );

COMMENT ON COLUMN public.guest_submissions.stay_guide_valid_from IS
  'When the stay guide token became readable. Set to the issue time so the emailed link works the day it is sent; Wi-Fi and door code have their own reveal time.';
