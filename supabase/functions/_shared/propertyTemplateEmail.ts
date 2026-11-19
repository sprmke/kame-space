/**
 * Render workflow emails using configurable body copy from property_template_contents.
 */

import type { AppSettingsResolved } from './appSettings.ts';
import { resolveAppSettings } from './appSettings.ts';
import { buildEmailLegalFooterHtml } from './emailLegalFooter.ts';
import {
  formatEmailDateRange,
  loadPropertyEmailBranding,
  resolveEmailUnitLabel,
  type PropertyEmailBranding,
} from './propertyEmailBranding.ts';
import {
  guestFormPath,
  guestGuestReviewPath,
  guestSdFormPath,
  guestTripPath,
} from './publicGuestPaths.ts';
import {
  escapeHtml,
  loadEmailTemplate,
  replacePlaceholders,
  withEmailShellStyleVars,
} from './renderEmailHtml.ts';
import { buildDateLineBlockHtml, buildGuestTripCtaHtml } from './propertyTemplateEmailSections.ts';
import { normalizeBlockLevelPlaceholdersInHtml } from './normalizeBlockLevelPlaceholders.ts';
import { normalizeEmailCalloutPlaceholders } from './normalizeEmailCalloutPlaceholders.ts';
import {
  getBuiltinPropertyTemplate,
  getPropertyTemplateRow,
  resolvePropertyTemplateContent,
  type PropertyTemplateKey,
} from './propertyTemplates.ts';
import {
  isBlockLevelPropertyPlaceholder,
  TOKENIZED_LINK_PLACEHOLDER_KEYS,
} from './propertyTemplateCatalog.ts';
import { computeTotalGuestBalanceFromBooking } from './totalGuestBalance.ts';
import { resolveGuestFormSettings } from './guestFormSettings.ts';
import { REVIEW_WINDOW_DAYS } from './reviewWindow.ts';
import { PENDING_REVIEW_CHASE_LEAD_DAYS } from './pendingReviewPolicy.ts';
import {
  buildPropertyPlaceholderVars,
  type PropertyPlaceholderBooking,
} from './propertyTemplatePropertyVars.ts';
import { buildEmailCtaHtml } from './brandedEmailShell.ts';
import { resolveGuestParkingCtaAbsoluteUrl } from './ownerDefaultParking.ts';
import type { GuestFormData, GuestSubmission } from './types.ts';
import { countStayNights, formatDateForEmail, formatTimeForDisplay } from './utils.ts';

/** Email template keys editable on the Templates page. */
export const PROPERTY_EMAIL_TEMPLATE_KEYS = [
  'email-gaf-request',
  'email-pet-request',
  'email-new-booking-request',
  'email-booking-request-received',
  'email-booking-acknowledgement',
  'email-ready-for-checkin',
  'email-sd-refund-form-request',
  'email-booking-cancelled-guest',
  'email-booking-cancelled-host',
  'email-cancellation-request-guest',
  'email-refund-sent-guest',
  'email-pre-arrival-reminder',
  'email-parking-reminder',
  'email-review-request',
  'email-review-reminder',
  'email-request-expired-guest',
  'email-request-expiring-host',
  'email-building-admin-cancellation',
] as const;

export type PropertyEmailTemplateKey = (typeof PROPERTY_EMAIL_TEMPLATE_KEYS)[number];

function formatPeso(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(Number(amount))) return '-';
  return `₱${Number(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

async function emailHeaderLogoHtml(propertyId?: string | null, logoAlt?: string): Promise<string> {
  const settings = await resolveAppSettings(propertyId);
  const frag = await loadEmailTemplate('fragments/email-header-logo');
  return replacePlaceholders(
    frag,
    withEmailShellStyleVars(
      {
        logoUrl: escapeHtml(settings.emailLogoUrl),
        logoAlt: escapeHtml(logoAlt ?? 'Property'),
      },
      settings.brandColor
    )
  );
}

/** Replace `{{token}}` in admin-authored HTML. Values must already be escaped when needed. */
export function normalizePropertyTemplatePlaceholderKey(raw: string): string {
  return raw.trim().replace(/-/g, '_');
}

/** Replace `{{token}}` in admin-authored HTML. Values must already be escaped when needed. */
export function applyPropertyTemplatePlaceholders(
  html: string,
  vars: Record<string, string>
): string {
  /*
   * A block placeholder sits alone in a `<p>`, but its value is a table or div. Keeping the
   * outer `<p>` nested a block in a paragraph, which the browser repairs into a stray empty
   * paragraph (visible in the stay guide). Unwrap it here; an empty block removes the line.
   */
  const unwrapped = html.replace(
    /<p(\s[^>]*)?>\s*\{\{([\w-]+)\}\}\s*<\/p>/gi,
    (match, attrs: string | undefined, rawKey: string) => {
      const key = normalizePropertyTemplatePlaceholderKey(rawKey);
      if (!isBlockLevelPropertyPlaceholder(key)) return match;
      const value = vars[key] ?? '';
      if (!value.trim()) return '';
      return value;
    }
  );

  return unwrapped.replace(/\{\{([\w-]+)\}\}/g, (_, rawKey: string) => {
    const key = normalizePropertyTemplatePlaceholderKey(rawKey);
    return vars[key] ?? '';
  });
}

/** Improve WYSIWYG HTML for email clients and public stay guide (images, links). */
export function prepareConfigurableEmailBodyHtml(html: string, publicOrigin: string): string {
  let out = html;
  const base = publicOrigin.replace(/\/+$/, '');

  out = out.replace(/<img\b([^>]*?)>/gi, (match, attrs: string) => {
    let nextAttrs = attrs;
    const srcMatch = nextAttrs.match(/\bsrc\s*=\s*("([^"]*)"|'([^']*)')/i);
    if (srcMatch) {
      const rawSrc = (srcMatch[2] ?? srcMatch[3] ?? '').trim();
      if (rawSrc && !/^https?:\/\//i.test(rawSrc) && !rawSrc.startsWith('data:') && base) {
        const absolute = rawSrc.startsWith('/') ? `${base}${rawSrc}` : `${base}/${rawSrc}`;
        nextAttrs = nextAttrs.replace(srcMatch[0], `src="${absolute}"`);
      }
    }

    if (/style\s*=/i.test(nextAttrs)) {
      if (!/max-width\s*:/i.test(nextAttrs)) {
        nextAttrs = nextAttrs.replace(/style\s*=\s*("([^"]*)"|'([^']*)')/i, (_m, _q, d1, d2) => {
          const existing = d1 ?? d2 ?? '';
          return `style="${existing};display:block;max-width:100%;height:auto;border-radius:8px;margin:16px 0;"`;
        });
      }
      return `<img${nextAttrs}>`;
    }
    return `<img${nextAttrs} style="display:block;max-width:100%;height:auto;border-radius:8px;margin:16px 0;">`;
  });

  if (base) {
    out = out.replace(/href\s*=\s*"(\/[^"]*)"/gi, `href="${base}$1"`);
    out = out.replace(/href\s*=\s*'(\/[^']*)'/gi, `href='${base}$1'`);
  }

  return out;
}

function decorFlags(booking: {
  guest_requests_surprise_decor?: boolean | null;
  has_pets?: boolean | null;
}) {
  const hasDecor = Boolean(booking.guest_requests_surprise_decor);
  const hasPets = Boolean(booking.has_pets);
  return {
    decor_status: hasDecor ? '🎉 Yes' : 'No',
    pet_status: hasPets ? '🐶 Yes' : 'No',
    has_decor: hasDecor ? 'Yes' : 'No',
    has_pets: hasPets ? 'Yes' : 'No',
    decor_flag: hasDecor ? '🎉 Has decor' : '',
    pet_flag: hasPets ? '🐶 Has pets' : '',
  };
}

/** Placeholder values are HTML-escaped for the body; a subject needs the raw characters. */
function decodeSubjectEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * Subject for an automated email: the host's override, else the shipped default, rendered with
 * the same plain placeholders as the body. GAF and pet subjects stay locked because inbound
 * approval parses them.
 */
export async function resolvePropertyTemplateSubject(input: {
  propertyId?: string | null;
  templateKey: string;
  vars: Record<string, string>;
  fallback: string;
}): Promise<string> {
  const builtin = getBuiltinPropertyTemplate(input.templateKey);
  if (builtin?.subjectLocked) return input.fallback;

  let rowSubject: string | null | undefined;
  if (input.propertyId) {
    try {
      const row = await getPropertyTemplateRow(input.propertyId, input.templateKey);
      rowSubject = row?.subject ?? null;
    } catch (err) {
      console.warn('[propertyTemplateEmail] subject lookup failed:', err);
    }
  }

  const raw = rowSubject?.trim() || builtin?.defaultSubject?.trim() || '';
  if (!raw) return input.fallback;
  const rendered = decodeSubjectEntities(
    applyPropertyTemplatePlaceholders(raw, input.vars).replace(/\s+/g, ' ')
  ).trim();
  return rendered || input.fallback;
}

export function buildBookingPlaceholderVars(
  booking: GuestSubmission,
  settings: AppSettingsResolved,
  extras: Record<string, string> = {},
  branding?: PropertyEmailBranding
): Record<string, string> {
  const displayCheckIn = formatDateForEmail(booking.check_in_date);
  const displayCheckOut = formatDateForEmail(booking.check_out_date);
  const pax = (booking.number_of_adults || 0) + (booking.number_of_children || 0);
  const nights = countStayNights(booking.check_in_date, booking.check_out_date);
  const unitLabel = branding
    ? resolveEmailUnitLabel(booking.tower_and_unit_number, branding)
    : String(booking.tower_and_unit_number ?? '').trim() ||
      settings.gafTowerAndUnitNumber?.trim() ||
      'Property';
  const propertyName = branding?.propertyName ?? 'Property';
  const appOrigin = settings.publicGuestAppOrigin.replace(/\/+$/, '');
  const bookingId = String(booking.id ?? '').trim();
  const propertySlug = (extras.property_slug ?? extras.propertySlug ?? '').trim();
  const bookingLink = bookingId ? `${appOrigin}/bookings/${encodeURIComponent(bookingId)}` : '';
  const sdFormUrl =
    extras.sd_form_url?.trim() ||
    (bookingId ? guestSdFormPath(appOrigin, propertySlug, bookingId) : '');
  const formUrl =
    extras.form_url?.trim() || (bookingId ? guestFormPath(appOrigin, propertySlug, bookingId) : '');
  const reviewUrl =
    extras.review_url?.trim() ||
    (bookingId ? guestGuestReviewPath(appOrigin, propertySlug, bookingId) : '');
  const tripUrl =
    extras.trip_url?.trim() ||
    (bookingId && propertySlug ? guestTripPath(appOrigin, propertySlug, bookingId) : '');
  const totalBalance =
    computeTotalGuestBalanceFromBooking(booking as unknown as Record<string, unknown>) ?? 0;
  const guestDisplayName = String(
    booking.primary_guest_name || booking.guest_facebook_name || ''
  ).trim();
  const guestFirstName = guestDisplayName.split(/\s+/)[0] || 'there';

  const flags = decorFlags(booking);

  return {
    primary_guest_name: escapeHtml(booking.primary_guest_name),
    guest_first_name: escapeHtml(guestFirstName),
    guest_name: escapeHtml(booking.primary_guest_name || booking.guest_facebook_name),
    guest_email: escapeHtml(booking.guest_email),
    guest_phone: escapeHtml(booking.guest_phone_number),
    guest_facebook_name: escapeHtml(booking.guest_facebook_name),
    check_in_date: escapeHtml(displayCheckIn),
    check_out_date: escapeHtml(displayCheckOut),
    check_in_time: escapeHtml(formatTimeForDisplay(booking.check_in_time)),
    check_out_time: escapeHtml(formatTimeForDisplay(booking.check_out_time)),
    stay_dates: escapeHtml(formatEmailDateRange(displayCheckIn, displayCheckOut)),
    nights: String(nights),
    nights_label: escapeHtml(`${nights} ${nights === 1 ? 'night' : 'nights'}`),
    pax: String(pax),
    guests_label: escapeHtml(`${pax} ${pax === 1 ? 'guest' : 'guests'}`),
    review_window_days: String(REVIEW_WINDOW_DAYS),
    expires_in_days: String(PENDING_REVIEW_CHASE_LEAD_DAYS),
    balance_due_section:
      totalBalance > 0
        ? `<p style="margin:0 0 16px 0;">Your remaining balance is <strong>${escapeHtml(formatPeso(totalBalance))}</strong>.</p>`
        : '',
    tower_and_unit_number: escapeHtml(unitLabel),
    unit_number: escapeHtml(unitLabel),
    property_name: escapeHtml(propertyName),
    booking_source: escapeHtml(String(booking.booking_source ?? '')),
    booking_link: escapeHtml(bookingLink),
    special_requests: escapeHtml(String(booking.guest_special_requests ?? '').trim() || 'None'),
    pet_name: escapeHtml(String(booking.pet_name ?? '')),
    pet_type: escapeHtml(String(booking.pet_type ?? '')),
    pet_breed: escapeHtml(String(booking.pet_breed ?? '')),
    pet_age: escapeHtml(String(booking.pet_age ?? '')),
    car_brand_model: escapeHtml(String(booking.car_brand_model ?? '')),
    car_color: escapeHtml(String(booking.car_color ?? '')),
    car_plate_number: escapeHtml(String(booking.car_plate_number ?? '')),
    total_guest_balance: escapeHtml(formatPeso(totalBalance)),
    sd_form_url: escapeHtml(sdFormUrl),
    form_url: escapeHtml(formUrl),
    review_url: escapeHtml(reviewUrl),
    trip_url: escapeHtml(tripUrl),
    // Rendered by default in every guest email that needs a way back to the trip. A
    // template that places {{trip_url}} itself blanks this out, so the guest never sees two
    // links to the same place (plan 6.3).
    trip_cta_section: tripUrl ? buildGuestTripCtaHtml(tripUrl, settings.brandColor) : '',
    security_deposit: escapeHtml(formatPeso(booking.security_deposit as number | null)),
    ...Object.fromEntries(Object.entries(flags).map(([k, v]) => [k, escapeHtml(v)])),
    ...extras,
  };
}

export function buildGuestFormPlaceholderVars(
  formData: GuestFormData,
  settings: AppSettingsResolved,
  extras: Record<string, string> = {},
  branding?: PropertyEmailBranding
): Record<string, string> {
  const displayCheckIn = formatDateForEmail(formData.checkInDate);
  const displayCheckOut = formatDateForEmail(formData.checkOutDate);
  const pax = formData.numberOfAdults + formData.numberOfChildren;
  const nights = countStayNights(formData.checkInDate, formData.checkOutDate);
  const unitLabel = branding
    ? resolveEmailUnitLabel(formData.towerAndUnitNumber, branding)
    : String(formData.towerAndUnitNumber ?? '').trim() ||
      settings.gafTowerAndUnitNumber?.trim() ||
      'Property';
  const propertyName = branding?.propertyName ?? 'Property';
  const hasDecor = Boolean(formData.guestRequestsSurpriseDecor);
  const hasPets = Boolean(formData.hasPets);
  const guestDisplayName = String(
    formData.primaryGuestName || formData.guestFacebookName || ''
  ).trim();
  const guestFirstName = guestDisplayName.split(/\s+/)[0] || 'there';

  return {
    primary_guest_name: escapeHtml(formData.primaryGuestName),
    guest_first_name: escapeHtml(guestFirstName),
    guest_name: escapeHtml(formData.primaryGuestName || formData.guestFacebookName),
    guest_email: escapeHtml(formData.guestEmail),
    guest_phone: escapeHtml(formData.guestPhoneNumber),
    guest_facebook_name: escapeHtml(formData.guestFacebookName),
    check_in_date: escapeHtml(displayCheckIn),
    check_out_date: escapeHtml(displayCheckOut),
    check_in_time: escapeHtml(formatTimeForDisplay(formData.checkInTime)),
    check_out_time: escapeHtml(formatTimeForDisplay(formData.checkOutTime)),
    stay_dates: escapeHtml(formatEmailDateRange(displayCheckIn, displayCheckOut)),
    nights: String(nights),
    nights_label: escapeHtml(`${nights} ${nights === 1 ? 'night' : 'nights'}`),
    pax: String(pax),
    guests_label: escapeHtml(`${pax} ${pax === 1 ? 'guest' : 'guests'}`),
    tower_and_unit_number: escapeHtml(unitLabel),
    unit_number: escapeHtml(unitLabel),
    property_name: escapeHtml(propertyName),
    booking_source: escapeHtml(String(formData.bookingSource ?? '')),
    special_requests: escapeHtml(String(formData.guestSpecialRequests ?? '').trim() || 'None'),
    pet_name: escapeHtml(String(formData.petName ?? '')),
    pet_type: escapeHtml(String(formData.petType ?? '')),
    pet_breed: escapeHtml(String(formData.petBreed ?? '')),
    pet_age: escapeHtml(String(formData.petAge ?? '')),
    pet_vaccination_date: escapeHtml(formatDateForEmail(formData.petVaccinationDate || '')),
    car_brand_model: escapeHtml(String(formData.carBrandModel ?? '')),
    car_color: escapeHtml(String(formData.carColor ?? '')),
    car_plate_number: escapeHtml(String(formData.carPlateNumber ?? '')),
    decor_status: escapeHtml(hasDecor ? '🎉 Yes' : 'No'),
    pet_status: escapeHtml(hasPets ? '🐶 Yes' : 'No'),
    has_decor: escapeHtml(hasDecor ? 'Yes' : 'No'),
    has_pets: escapeHtml(hasPets ? 'Yes' : 'No'),
    decor_flag: escapeHtml(hasDecor ? '🎉 Has decor' : ''),
    pet_flag: escapeHtml(hasPets ? '🐶 Has pets' : ''),
    ...extras,
  };
}

const GUIDE_SECTION_KEYS = [
  { placeholder: 'check_in_instructions_section', templateKey: 'check-in-instructions' },
  { placeholder: 'check_out_instructions_section', templateKey: 'check-out-instructions' },
  { placeholder: 'house_rules_section', templateKey: 'house-rules' },
] as const satisfies readonly {
  placeholder: string;
  templateKey: PropertyTemplateKey;
}[];

/** Past this, the embed is dropped rather than risk Gmail clipping the whole email. */
const MAX_EMBEDDED_GUIDE_CHARS = 8_000;

/**
 * Embeds a guide template body in an email so a host writes check-in, check-out or house rules
 * once. Placeholders are already resolved in `vars`.
 */
async function buildGuideSectionHtml(
  propertyId: string | undefined,
  templateKey: PropertyTemplateKey,
  vars: Record<string, string>
): Promise<string> {
  if (!propertyId) return '';
  try {
    const resolved = await resolvePropertyTemplateContent(propertyId, templateKey);
    const html = applyPropertyTemplatePlaceholders(resolved.content, vars).trim();
    if (!html || html.length > MAX_EMBEDDED_GUIDE_CHARS) return '';
    return `<div class="guide-embed" style="margin:0 0 18px 0;">${html}</div>`;
  } catch (err) {
    console.warn('[propertyTemplateEmail] guide embed failed:', err);
    return '';
  }
}

export async function renderPropertyTemplateSendEmail(input: {
  propertyId: string | undefined;
  /** Custom (`custom-*`) keys are only valid together with `contentOverride`. */
  templateKey: PropertyEmailTemplateKey | (string & {});
  emailTitle: string;
  placeholderVars: Record<string, string>;
  urgentBlock?: string;
  /** @deprecated Use {{update_notice}} in template body. */
  updateNoticeBlock?: string;
  branding?: PropertyEmailBranding;
  /** When set (preview), use this body instead of DB/default content. */
  contentOverride?: string;
  /** Enables booking-dependent blocks (parking CTA, review CTA, guide embeds). */
  booking?: PropertyPlaceholderBooking | null;
}): Promise<string> {
  const settings = await resolveAppSettings(input.propertyId);
  const branding = input.branding ?? (await loadPropertyEmailBranding(input.propertyId));

  let rawContent = input.contentOverride?.trim() ?? '';
  if (!rawContent) {
    const resolved = await resolvePropertyTemplateContent(
      input.propertyId,
      input.templateKey as PropertyTemplateKey
    );
    rawContent = resolved.content;
  }

  if (!rawContent.trim()) {
    throw new Error(`Property email template "${input.templateKey}" has empty content`);
  }

  rawContent = normalizeBlockLevelPlaceholdersInHtml(rawContent);
  rawContent = normalizeEmailCalloutPlaceholders(rawContent, input.templateKey);

  // The default trip button steps aside when the host already put the trip link in the body,
  // so a guest never sees two links to the same place (plan 6.3).
  let vars: Record<string, string> =
    rawContent.includes('{{trip_url}}') && input.placeholderVars.trip_cta_section !== undefined
      ? { ...input.placeholderVars, trip_cta_section: '' }
      : { ...input.placeholderVars };

  /*
   * Booking rows can be missing their own times (legacy imports), and a fixed fallback string
   * contradicts Settings. Resolve this property's times once per render and fill only the
   * blanks, so the email always matches what the guest form and stay guide say.
   */
  if (input.propertyId) {
    try {
      const formSettings = await resolveGuestFormSettings(input.propertyId);
      const propertyCheckIn = formatTimeForDisplay(formSettings.checkInTime);
      const propertyCheckOut = formatTimeForDisplay(formSettings.checkOutTime);
      if (!vars.check_in_time && propertyCheckIn) {
        vars.check_in_time = escapeHtml(propertyCheckIn);
      }
      if (!vars.check_out_time && propertyCheckOut) {
        vars.check_out_time = escapeHtml(propertyCheckOut);
      }
    } catch (err) {
      console.warn('[propertyTemplateEmail] guest form settings lookup failed:', err);
    }
  }

  const propertyVars = await buildPropertyPlaceholderVars({
    propertyId: input.propertyId,
    booking: input.booking ?? null,
  });
  // Booking-specific values win over property defaults (unit, name, links).
  vars = { ...propertyVars.vars, ...vars };

  const brandColor = settings.brandColor;
  if (vars.messages_url) {
    vars.messages_cta_section = buildEmailCtaHtml(
      'Message your host',
      vars.messages_url,
      brandColor
    );
  }
  if (vars.review_url) {
    vars.review_cta_section = buildEmailCtaHtml('Leave a review', vars.review_url, brandColor);
  }
  if (input.booking?.id) {
    try {
      const parkingUrl = await resolveGuestParkingCtaAbsoluteUrl({
        propertyBookingId: input.booking.id,
        publicGuestAppOrigin: settings.publicGuestAppOrigin,
      });
      vars.parking_cta_section = buildEmailCtaHtml('Find parking', parkingUrl, brandColor);
    } catch (err) {
      console.warn('[propertyTemplateEmail] parking CTA failed:', err);
    }
  }

  for (const guideKey of GUIDE_SECTION_KEYS) {
    if (!rawContent.includes(`{{${guideKey.placeholder}}}`)) continue;
    vars[guideKey.placeholder] = await buildGuideSectionHtml(
      input.propertyId,
      guideKey.templateKey,
      vars
    );
  }

  /*
   * Belt and braces: a row saved before save-time validation could still carry a guest link
   * in a building admin or team email. Blank them at render time too, so a booking access
   * token can never reach the building.
   */
  const templateGroup = getBuiltinPropertyTemplate(input.templateKey)?.group;
  if (templateGroup === 'building-admin' || templateGroup === 'team-alerts') {
    for (const key of TOKENIZED_LINK_PLACEHOLDER_KEYS) {
      if (key in vars) vars[key] = '';
    }
  }

  let body = applyPropertyTemplatePlaceholders(rawContent, vars);
  body = prepareConfigurableEmailBodyHtml(body, settings.publicGuestAppOrigin);

  const bodyContent = body;

  const emailHeaderLogo = await emailHeaderLogoHtml(input.propertyId, branding.organizationName);
  const shell = await loadEmailTemplate('fragments/configurable-template-send');
  const unitLabel = input.placeholderVars.tower_and_unit_number || escapeHtml(branding.unitLabel);

  const title =
    input.emailTitle.trim() || getBuiltinPropertyTemplate(input.templateKey)?.label || 'Email';
  const legalFooter = buildEmailLegalFooterHtml(branding.organizationName);
  const dateLineBlock = buildDateLineBlockHtml(
    input.placeholderVars.check_in_date ?? '',
    input.placeholderVars.check_out_date ?? '',
    settings.brandColor
  );

  return replacePlaceholders(
    shell,
    withEmailShellStyleVars(
      {
        emailHeaderLogo,
        brandName: escapeHtml(branding.organizationName),
        unitLabel,
        emailTitle: escapeHtml(title),
        dateLineBlock,
        bodyContent,
        legalFooter,
      },
      settings.brandColor
    )
  );
}
