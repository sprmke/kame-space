/**
 * Server placeholder catalog for property templates.
 *
 * The Templates GET response carries the allowed keys per template so the editor, preview and
 * send path read one definition instead of four hand-synced lists.
 *
 * `kind` decides how a token behaves:
 * - `plain`  a single value substituted inline.
 * - `block`  a computed HTML block that must sit alone in a `<p>`.
 * - `secret`  reveal-gated value, Stay guide only.
 * - `link`   tokenized guest link, never allowed in building admin or team alerts.
 */

import { EMAIL_DYNAMIC_SECTION_KEYS } from './propertyTemplateEmailSections.ts';

export type PropertyTemplatePlaceholderKind = 'plain' | 'block' | 'secret' | 'link';

export type PropertyTemplatePlaceholder = {
  key: string;
  label: string;
  group: string;
  kind: PropertyTemplatePlaceholderKind;
};

const PLAIN_CORE: string[] = [
  'primary_guest_name',
  'guest_name',
  'guest_phone',
  'guest_email',
  'guest_facebook_name',
];

const PLAIN_STAY: string[] = [
  'check_in_date',
  'check_out_date',
  'check_in_time',
  'check_out_time',
  'stay_dates',
  'nights',
  'pax',
  'tower_and_unit_number',
  'unit_number',
  'property_name',
  'booking_source',
];

const PLAIN_FLAGS: string[] = [
  'decor_status',
  'pet_status',
  'has_decor',
  'has_pets',
  'decor_flag',
  'pet_flag',
  'special_requests',
];

const PLAIN_PET: string[] = ['pet_name', 'pet_type', 'pet_breed', 'pet_age'];
const PLAIN_VEHICLE: string[] = ['car_brand_model', 'car_color', 'car_plate_number'];
const PLAIN_PAYMENT: string[] = ['total_guest_balance', 'security_deposit', 'sd_form_url'];
const PLAIN_CONTACT: string[] = [
  'facebook_page_url',
  'airbnb_url',
  'contact_name',
  'contact_phone',
  'contact_email',
  'social_contact_mentions',
];
const PLAIN_BOOKING_META: string[] = ['booking_link'];
const PLAIN_GUEST_LINKS: string[] = ['trip_url'];

/** Block tokens the editor must insert on their own paragraph. */
export const PROPERTY_BLOCK_PLACEHOLDER_KEYS: readonly string[] = EMAIL_DYNAMIC_SECTION_KEYS;

export function isBlockLevelPropertyPlaceholder(key: string): boolean {
  return PROPERTY_BLOCK_PLACEHOLDER_KEYS.includes(key);
}

function unique(...groups: readonly (readonly string[])[]): string[] {
  return [...new Set(groups.flat())];
}

const CORE = unique(PLAIN_CORE, PLAIN_STAY, PLAIN_FLAGS);

export const PROPERTY_PLACEHOLDER_KEYS_BY_TEMPLATE: Record<string, readonly string[]> = {
  'house-rules': CORE,
  'check-in-instructions': unique(CORE, PLAIN_PAYMENT),
  'check-out-instructions': unique(CORE, PLAIN_PAYMENT),
  'parking-reminders': unique(CORE, PLAIN_VEHICLE),
  'email-gaf-request': unique(
    CORE,
    PLAIN_BOOKING_META,
    ['urgent_notice', 'update_notice'],
    ['email_signature_section']
  ),
  'email-pet-request': unique(
    CORE,
    PLAIN_PET,
    PLAIN_BOOKING_META,
    ['urgent_notice', 'update_notice'],
    ['pet_details_section', 'pet_attachments_section', 'email_signature_section']
  ),
  'email-new-booking-request': unique(CORE, PLAIN_BOOKING_META, PLAIN_PAYMENT, [
    'urgent_notice',
    'new_booking_detail_tables',
    'downpayment_receipt_ai_section',
    'booking_link_cta',
  ]),
  'email-booking-acknowledgement': unique(
    CORE,
    PLAIN_BOOKING_META,
    PLAIN_CONTACT,
    PLAIN_GUEST_LINKS,
    ['booking_acknowledgement_flow_section', 'email_signature_section']
  ),
  'email-booking-request-received': unique(
    CORE,
    PLAIN_BOOKING_META,
    PLAIN_CONTACT,
    PLAIN_GUEST_LINKS,
    ['booking_request_received_flow_section', 'email_signature_section']
  ),
  'email-ready-for-checkin': unique(CORE, PLAIN_PAYMENT, PLAIN_CONTACT, PLAIN_GUEST_LINKS, [
    'trip_cta_section',
    'ready_for_checkin_booking_summary_section',
    'document_reminders_section',
    'payment_breakdown_section',
    'gcash_payment_section',
    'stay_guide_cta_section',
    'ready_for_checkin_contact_section',
    'email_signature_section',
  ]),
  'email-sd-refund-form-request': unique(CORE, PLAIN_PAYMENT, PLAIN_CONTACT, PLAIN_GUEST_LINKS, [
    'sd_refund_checklist_section',
    'sd_refund_details_section',
    'trip_cta_section',
  ]),
  'email-booking-cancelled-guest': unique(
    CORE,
    PLAIN_BOOKING_META,
    PLAIN_CONTACT,
    PLAIN_GUEST_LINKS,
    [
      'cancellation_intro',
      'cancellation_detail_section',
      'trip_cta_section',
      'email_signature_section',
    ]
  ),
  'email-booking-cancelled-host': unique(CORE, PLAIN_BOOKING_META, PLAIN_CONTACT, [
    'cancellation_host_title',
    'cancellation_detail_section',
    'booking_link_cta',
    'email_signature_section',
  ]),
  'email-cancellation-request-guest': unique(
    CORE,
    PLAIN_BOOKING_META,
    PLAIN_CONTACT,
    PLAIN_GUEST_LINKS,
    [
      'cancellation_request_title',
      'cancellation_detail_section',
      'trip_cta_section',
      'email_signature_section',
    ]
  ),
  'email-refund-sent-guest': unique(CORE, PLAIN_BOOKING_META, PLAIN_CONTACT, PLAIN_GUEST_LINKS, [
    'cancellation_detail_section',
    'trip_cta_section',
    'email_signature_section',
  ]),
};

const CUSTOM_TEMPLATE_KEYS = unique(
  CORE,
  PLAIN_PET,
  PLAIN_VEHICLE,
  PLAIN_PAYMENT,
  PLAIN_BOOKING_META,
  PLAIN_CONTACT,
  PROPERTY_BLOCK_PLACEHOLDER_KEYS
);

export function propertyTemplatePlaceholderKeys(
  templateKey: string,
  category: 'standard' | 'email' | 'message' | 'custom'
): readonly string[] {
  if (category === 'custom' || category === 'message') {
    return PROPERTY_PLACEHOLDER_KEYS_BY_TEMPLATE[templateKey] ?? CUSTOM_TEMPLATE_KEYS;
  }
  return PROPERTY_PLACEHOLDER_KEYS_BY_TEMPLATE[templateKey] ?? CUSTOM_TEMPLATE_KEYS;
}

/** Tokens that carry a booking access token in the URL. Never for building admin or team mail. */
export const TOKENIZED_LINK_PLACEHOLDER_KEYS: readonly string[] = [
  'trip_url',
  'sd_form_url',
  'review_url',
  'form_url',
  'stay_guide_url',
  'messages_url',
  'trip_cta_section',
  'stay_guide_cta_section',
  'sd_refund_details_section',
  'review_cta_section',
  'parking_cta_section',
  'messages_cta_section',
];

export const SECRET_PLACEHOLDER_KEYS: readonly string[] = ['wifi_password', 'door_code'];

/** Blocks a template cannot save without, because a side effect lives inside them. */
export const REQUIRED_BLOCKS_BY_TEMPLATE: Record<string, readonly string[]> = {
  'email-sd-refund-form-request': ['sd_refund_details_section'],
};

export type PropertyTemplateTokenValidation = {
  errors: string[];
  warnings: string[];
};

function tokenKeysOf(html: string): string[] {
  return [...html.matchAll(/\{\{([\w-]+)\}\}/g)].map((match) => match[1].replace(/-/g, '_'));
}

/**
 * Context rules from the plan, enforced server-side on save.
 *
 * `errors` block the save. `warnings` let the save through but tell the editor what will not
 * render, so a typo is visible before a guest sees an empty sentence.
 */
export function validatePropertyTemplateTokens(input: {
  templateKey: string;
  category: 'standard' | 'email' | 'message' | 'custom';
  group?: string | null;
  content: string;
  subject?: string | null;
}): PropertyTemplateTokenValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const allowed = new Set(propertyTemplatePlaceholderKeys(input.templateKey, input.category));
  const tokens = tokenKeysOf(input.content);
  const subjectTokens = input.subject ? tokenKeysOf(input.subject) : [];
  const guideOnly = input.category === 'standard';
  const noGuestLinks = input.group === 'building-admin' || input.group === 'team-alerts';

  for (const token of new Set([...tokens, ...subjectTokens])) {
    if (SECRET_PLACEHOLDER_KEYS.includes(token) && !guideOnly) {
      errors.push(`{{${token}}} is only allowed in Stay guide templates`);
    }
    if (TOKENIZED_LINK_PLACEHOLDER_KEYS.includes(token) && noGuestLinks) {
      errors.push(`{{${token}}} carries a guest link and cannot be used in this email`);
    }
    if (subjectTokens.includes(token) && isBlockLevelPropertyPlaceholder(token)) {
      errors.push(`{{${token}}} is a block and cannot be used in a subject`);
    }
    if (!allowed.has(token) && input.category !== 'custom') {
      warnings.push(`Unknown placeholder {{${token}}}`);
    }
  }

  for (const required of REQUIRED_BLOCKS_BY_TEMPLATE[input.templateKey] ?? []) {
    if (!tokens.includes(required)) {
      warnings.push(`{{${required}}} was removed, so part of this email will not send`);
    }
  }

  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
