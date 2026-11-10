import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

// `telegramParking.ts` also owns the DB-backed sender; give its static Supabase client a
// harmless URL so the pure template helpers can be imported without a live project.
Deno.env.set('SUPABASE_URL', 'http://127.0.0.1:54321');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role');

const {
  PARKING_TELEGRAM_PLACEHOLDER_KEYS,
  parkingTemplatePatchFromBody,
  parseParkingTemplateKey,
  renderParkingTemplate,
  serializeParkingTelegramSettings,
  templateTextForKey,
} = await import('./telegramParking.ts');

Deno.test('new parking Telegram alerts serialize with defaults and toggles on', () => {
  const dto = serializeParkingTelegramSettings({});
  assertEquals(
    dto.requestCancelledTemplate,
    'Guest cancelled parking {{slot_label}} for {{check_in_date}}.'
  );
  assertEquals(
    dto.paymentExpiredTemplate,
    'Payment window expired for parking {{slot_label}}. The request is searching again.'
  );
  assertEquals(
    dto.endorsementFailedTemplate,
    'Endorsement failed for {{slot_label}} at {{residence_name}}. Add the PMO email and resend.'
  );
  assertEquals(dto.notifyOnRequestCancelled, true);
  assertEquals(dto.notifyOnPaymentExpired, true);
  assertEquals(dto.notifyOnEndorsementFailed, true);
  assert(PARKING_TELEGRAM_PLACEHOLDER_KEYS.includes('residence_name'));
});

Deno.test('parking Telegram patch accepts the new template and toggle keys', () => {
  const patch = parkingTemplatePatchFromBody({
    requestCancelledTemplate: 'Cancelled {{slot_label}}',
    paymentExpiredTemplate: 'Expired {{slot_label}}',
    endorsementFailedTemplate: 'Failed {{slot_label}}',
    notifyOnRequestCancelled: false,
    notifyOnPaymentExpired: false,
    notifyOnEndorsementFailed: false,
  });
  assertEquals(patch.request_cancelled_template, 'Cancelled {{slot_label}}');
  assertEquals(patch.payment_expired_template, 'Expired {{slot_label}}');
  assertEquals(patch.endorsement_failed_template, 'Failed {{slot_label}}');
  assertEquals(patch.notify_on_request_cancelled, false);
  assertEquals(patch.notify_on_payment_expired, false);
  assertEquals(patch.notify_on_endorsement_failed, false);
});

Deno.test('parking Telegram template keys and rendering cover the new alerts', () => {
  for (const key of ['request_cancelled', 'payment_expired', 'endorsement_failed'] as const) {
    assertEquals(parseParkingTemplateKey(key), key);
    assert(templateTextForKey({}, key).length > 0);
  }
  assertEquals(
    renderParkingTemplate('{{slot_label}} at {{residence_name}}', {
      slot_label: 'ML2S26',
      residence_name: 'One Palm Residences',
    }),
    'ML2S26 at One Palm Residences'
  );
});
