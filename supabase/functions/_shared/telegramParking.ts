/**
 * Parking-slot Telegram notifications — credentials + message templates.
 */

import { DatabaseService } from './databaseService.ts';
import {
  resolvePropertyTelegramCredentials,
  verifyPropertyTelegramChannel,
  type TelegramEnvVerifyResult,
} from './propertyTelegramCredentials.ts';
import { createServiceClient } from './orgAuth.ts';
import { trimOrEmpty } from './stringUtils.ts';

export type TelegramParkingSettingsRow = {
  parking_id: string;
  enabled: boolean;
  reservation_request_template: string;
  check_in_reminder_template: string;
  payment_received_template: string;
  request_cancelled_template: string;
  payment_expired_template: string;
  endorsement_failed_template: string;
  notify_on_reservation_request: boolean;
  notify_on_check_in_reminder: boolean;
  notify_on_payment_received: boolean;
  notify_on_request_cancelled: boolean;
  notify_on_payment_expired: boolean;
  notify_on_endorsement_failed: boolean;
  updated_at: string;
};

export type ParkingTemplateKey =
  | 'reservation_request'
  | 'check_in_reminder'
  | 'payment_received'
  | 'request_cancelled'
  | 'payment_expired'
  | 'endorsement_failed';

const TEMPLATE_COLUMN: Record<ParkingTemplateKey, keyof TelegramParkingSettingsRow> = {
  reservation_request: 'reservation_request_template',
  check_in_reminder: 'check_in_reminder_template',
  payment_received: 'payment_received_template',
  request_cancelled: 'request_cancelled_template',
  payment_expired: 'payment_expired_template',
  endorsement_failed: 'endorsement_failed_template',
};

const TEMPLATE_TOGGLE_COLUMN: Record<ParkingTemplateKey, keyof TelegramParkingSettingsRow> = {
  reservation_request: 'notify_on_reservation_request',
  check_in_reminder: 'notify_on_check_in_reminder',
  payment_received: 'notify_on_payment_received',
  request_cancelled: 'notify_on_request_cancelled',
  payment_expired: 'notify_on_payment_expired',
  endorsement_failed: 'notify_on_endorsement_failed',
};

const DEFAULT_TEMPLATES: Record<ParkingTemplateKey, string> = {
  reservation_request: 'New parking reservation request for {{slot_label}}.',
  check_in_reminder: 'Parking check-in reminder: {{slot_label}} on {{check_in_date}}.',
  payment_received: 'Payment received for parking {{slot_label}}.',
  request_cancelled: 'Guest cancelled parking {{slot_label}} for {{check_in_date}}.',
  payment_expired:
    'Payment window expired for parking {{slot_label}}. The request is searching again.',
  endorsement_failed:
    'Endorsement failed for {{slot_label}} at {{residence_name}}. Add the PMO email and resend.',
};

const SAMPLE_VALUES: Record<string, string> = {
  slot_label: 'ML2S26',
  check_in_date: '07-20-2026',
  guest_name: 'Juan Dela Cruz',
  amount: '₱1,200',
  residence_name: 'One Palm Residences',
};

export const PARKING_TELEGRAM_PLACEHOLDER_KEYS = [
  'slot_label',
  'check_in_date',
  'guest_name',
  'amount',
  'residence_name',
] as const;

function sanitizeTemplate(raw: string, fallback: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, 8000);
}

export function serializeParkingTelegramSettings(row: Record<string, unknown>) {
  const r = row as unknown as TelegramParkingSettingsRow;
  return {
    enabled: Boolean(r.enabled),
    reservationRequestTemplate: sanitizeTemplate(
      String(r.reservation_request_template ?? ''),
      DEFAULT_TEMPLATES.reservation_request
    ),
    checkInReminderTemplate: sanitizeTemplate(
      String(r.check_in_reminder_template ?? ''),
      DEFAULT_TEMPLATES.check_in_reminder
    ),
    paymentReceivedTemplate: sanitizeTemplate(
      String(r.payment_received_template ?? ''),
      DEFAULT_TEMPLATES.payment_received
    ),
    requestCancelledTemplate: sanitizeTemplate(
      String(r.request_cancelled_template ?? ''),
      DEFAULT_TEMPLATES.request_cancelled
    ),
    paymentExpiredTemplate: sanitizeTemplate(
      String(r.payment_expired_template ?? ''),
      DEFAULT_TEMPLATES.payment_expired
    ),
    endorsementFailedTemplate: sanitizeTemplate(
      String(r.endorsement_failed_template ?? ''),
      DEFAULT_TEMPLATES.endorsement_failed
    ),
    notifyOnReservationRequest: r.notify_on_reservation_request !== false,
    notifyOnCheckInReminder: r.notify_on_check_in_reminder !== false,
    notifyOnPaymentReceived: r.notify_on_payment_received !== false,
    notifyOnRequestCancelled: r.notify_on_request_cancelled !== false,
    notifyOnPaymentExpired: r.notify_on_payment_expired !== false,
    notifyOnEndorsementFailed: r.notify_on_endorsement_failed !== false,
    placeholdersReference: [...PARKING_TELEGRAM_PLACEHOLDER_KEYS],
    updatedAt: r.updated_at ?? null,
  };
}

export function renderParkingTemplatePreview(text: string): string {
  return renderParkingTemplate(text, SAMPLE_VALUES);
}

export function renderParkingTemplate(
  text: string,
  values: Record<string, string | null | undefined>
): string {
  let out = text;
  for (const [key, value] of Object.entries(values)) {
    out = out.replaceAll(`{{${key}}}`, String(value ?? ''));
  }
  return out;
}

export async function verifyParkingTelegramEnv(
  parkingId: string,
  overrides?: { botToken?: string; chatId?: string }
): Promise<TelegramEnvVerifyResult> {
  return verifyPropertyTelegramChannel('parking', { parkingId }, overrides);
}

export async function sendParkingDraftPreview(
  text: string,
  parkingId: string
): Promise<{ sent: boolean; error?: string; messageCharCount?: number }> {
  const { telegramDeliveryUnavailable } = await import('./featureAvailability.ts');
  if (await telegramDeliveryUnavailable()) {
    return { sent: false, error: 'feature_unavailable' };
  }
  const rendered = renderParkingTemplatePreview(text);
  const creds = await resolvePropertyTelegramCredentials('parking', { parkingId });
  if (!creds.ok) {
    return { sent: false, error: creds.error };
  }
  const url = `https://api.telegram.org/bot${creds.token}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: creds.chatId,
      text: rendered.slice(0, 4096),
      disable_web_page_preview: true,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
  const { logTelegramMessage } = await import('./telegramMessageLog.ts');
  if (!json.ok) {
    const error = String(json.description ?? res.statusText);
    await logTelegramMessage({
      scope: { parkingId },
      module: 'parking',
      text: rendered.slice(0, 4096),
      ok: false,
      error,
    });
    return { sent: false, error };
  }
  await logTelegramMessage({
    scope: { parkingId },
    module: 'parking',
    text: rendered.slice(0, 4096),
    ok: true,
  });
  return { sent: true, messageCharCount: rendered.length };
}

export function parkingTemplatePatchFromBody(
  body: Record<string, unknown>
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (typeof body.enabled === 'boolean') patch.enabled = body.enabled;

  if (typeof body.reservationRequestTemplate === 'string') {
    patch.reservation_request_template = sanitizeTemplate(
      body.reservationRequestTemplate,
      DEFAULT_TEMPLATES.reservation_request
    );
  }
  if (typeof body.checkInReminderTemplate === 'string') {
    patch.check_in_reminder_template = sanitizeTemplate(
      body.checkInReminderTemplate,
      DEFAULT_TEMPLATES.check_in_reminder
    );
  }
  if (typeof body.paymentReceivedTemplate === 'string') {
    patch.payment_received_template = sanitizeTemplate(
      body.paymentReceivedTemplate,
      DEFAULT_TEMPLATES.payment_received
    );
  }
  if (typeof body.requestCancelledTemplate === 'string') {
    patch.request_cancelled_template = sanitizeTemplate(
      body.requestCancelledTemplate,
      DEFAULT_TEMPLATES.request_cancelled
    );
  }
  if (typeof body.paymentExpiredTemplate === 'string') {
    patch.payment_expired_template = sanitizeTemplate(
      body.paymentExpiredTemplate,
      DEFAULT_TEMPLATES.payment_expired
    );
  }
  if (typeof body.endorsementFailedTemplate === 'string') {
    patch.endorsement_failed_template = sanitizeTemplate(
      body.endorsementFailedTemplate,
      DEFAULT_TEMPLATES.endorsement_failed
    );
  }

  if (typeof body.notifyOnReservationRequest === 'boolean') {
    patch.notify_on_reservation_request = body.notifyOnReservationRequest;
  }
  if (typeof body.notifyOnCheckInReminder === 'boolean') {
    patch.notify_on_check_in_reminder = body.notifyOnCheckInReminder;
  }
  if (typeof body.notifyOnPaymentReceived === 'boolean') {
    patch.notify_on_payment_received = body.notifyOnPaymentReceived;
  }
  if (typeof body.notifyOnRequestCancelled === 'boolean') {
    patch.notify_on_request_cancelled = body.notifyOnRequestCancelled;
  }
  if (typeof body.notifyOnPaymentExpired === 'boolean') {
    patch.notify_on_payment_expired = body.notifyOnPaymentExpired;
  }
  if (typeof body.notifyOnEndorsementFailed === 'boolean') {
    patch.notify_on_endorsement_failed = body.notifyOnEndorsementFailed;
  }

  return patch;
}

export function parseParkingTemplateKey(raw: unknown): ParkingTemplateKey | null {
  if (
    raw === 'reservation_request' ||
    raw === 'check_in_reminder' ||
    raw === 'payment_received' ||
    raw === 'request_cancelled' ||
    raw === 'payment_expired' ||
    raw === 'endorsement_failed'
  ) {
    return raw;
  }
  return null;
}

export async function ensureTelegramParkingSettings(parkingId: string): Promise<void> {
  const pid = parkingId.trim();
  if (!pid) throw new Error('parkingId required');

  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from('telegram_parking_settings')
    .select('parking_id')
    .eq('parking_id', pid)
    .maybeSingle();

  if (existing) return;

  const { data: parkingSettings } = await supabase
    .from('parking_settings')
    .select('parking_notification_templates')
    .eq('parking_id', pid)
    .maybeSingle();

  const templates =
    parkingSettings?.parking_notification_templates &&
    typeof parkingSettings.parking_notification_templates === 'object' &&
    !Array.isArray(parkingSettings.parking_notification_templates)
      ? (parkingSettings.parking_notification_templates as Record<string, unknown>)
      : {};

  const reservation = trimOrEmpty(String(templates.reservation_request ?? ''));
  const checkIn = trimOrEmpty(String(templates.check_in_reminder ?? ''));
  const payment = trimOrEmpty(String(templates.payment_received ?? ''));

  const { error } = await supabase.from('telegram_parking_settings').insert({
    parking_id: pid,
    reservation_request_template: reservation || DEFAULT_TEMPLATES.reservation_request,
    check_in_reminder_template: checkIn || DEFAULT_TEMPLATES.check_in_reminder,
    payment_received_template: payment || DEFAULT_TEMPLATES.payment_received,
  });

  if (error) {
    console.error('[ensureTelegramParkingSettings]', error.message);
    throw new Error(`Failed to seed telegram_parking_settings for parking ${pid}`);
  }
}

export async function loadParkingTelegramSettingsRow(
  parkingId: string
): Promise<Record<string, unknown>> {
  await ensureTelegramParkingSettings(parkingId);
  const row = await DatabaseService.getTelegramParkingSettings(parkingId);
  if (!row) {
    throw new Error('Parking Telegram settings row missing');
  }
  return row;
}

export function templateTextForKey(row: Record<string, unknown>, key: ParkingTemplateKey): string {
  const col = TEMPLATE_COLUMN[key];
  const value = row[col as string];
  return sanitizeTemplate(String(value ?? ''), DEFAULT_TEMPLATES[key]);
}

/**
 * Sends one parking Telegram notice using the slot's template, toggle and credentials.
 * Never throws: a Telegram outage or missing config must not fail the booking/payment flow.
 */
export async function sendParkingTelegramNotice(input: {
  parkingId: string;
  key: ParkingTemplateKey;
  values: Record<string, string | null | undefined>;
  deepLink?: string | null;
}): Promise<{ sent: boolean; error?: string }> {
  try {
    const settingsRow = await loadParkingTelegramSettingsRow(input.parkingId);
    if (!Boolean(settingsRow.enabled)) return { sent: false, error: 'disabled' };
    const toggle = TEMPLATE_TOGGLE_COLUMN[input.key];
    if (settingsRow[toggle] === false) return { sent: false, error: 'disabled' };

    const { telegramDeliveryUnavailable } = await import('./featureAvailability.ts');
    if (await telegramDeliveryUnavailable()) return { sent: false, error: 'feature_unavailable' };

    const { isTelegramDeliveryEnabled } = await import('./telegramDeliveryControl.ts');
    if (!(await isTelegramDeliveryEnabled({ parkingId: input.parkingId }))) {
      return { sent: false, error: 'delivery_paused' };
    }

    const creds = await resolvePropertyTelegramCredentials('parking', {
      parkingId: input.parkingId,
    });
    if (!creds.ok) return { sent: false, error: creds.error };

    const template = templateTextForKey(settingsRow, input.key);
    let text = renderParkingTemplate(template, input.values);
    if (input.deepLink) text = `${text}\n\n${input.deepLink}`;

    const url = `https://api.telegram.org/bot${creds.token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: creds.chatId,
        text: text.slice(0, 4096),
        disable_web_page_preview: true,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    const { logTelegramMessage } = await import('./telegramMessageLog.ts');
    if (!json.ok) {
      const error = String(json.description ?? res.statusText);
      await logTelegramMessage({
        scope: { parkingId: input.parkingId },
        module: 'parking',
        text: text.slice(0, 4096),
        ok: false,
        error,
      });
      return { sent: false, error };
    }
    await logTelegramMessage({
      scope: { parkingId: input.parkingId },
      module: 'parking',
      text: text.slice(0, 4096),
      ok: true,
    });
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[sendParkingTelegramNotice]', input.parkingId, input.key, message);
    return { sent: false, error: message };
  }
}
