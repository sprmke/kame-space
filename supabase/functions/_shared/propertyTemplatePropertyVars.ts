/**
 * Property-data placeholders shared by every template surface (email, stay guide, trip page,
 * chat, preview).
 *
 * Secrets (`wifi_password`, `door_code`) are only filled when the caller has already passed the
 * reveal gate. Every other path renders "on your trip page", so a secret can never leak into an
 * email or a building admin thread.
 */

import { resolveAppSettings } from './appSettings.ts';
import { mintGuestBookingAccessToken } from './guestBookingAccessToken.ts';
import { buildGuestFacingPlaceholderVars, loadGuestFacingContactInfo } from './guestContactInfo.ts';
import { loadGuestEssentials, type GuestEssentialsDto } from './guestEssentials.ts';
import { resolveGuestFormSettings } from './guestFormSettings.ts';
import { loadPublicPropertyById } from './publicPropertyService.ts';
import { resolvePropertySlugById } from './propertyScope.ts';
import { guestMessagesPath, guestStayGuidePath } from './publicGuestPaths.ts';
import { escapeHtml } from './renderEmailHtml.ts';

export type PropertyPlaceholderBooking = {
  id?: string | null;
  /** Used to refuse minting a guest link for a booking on another property. */
  property_id?: string | null;
  status?: string | null;
  check_in_date?: string | null;
  check_in_time?: string | null;
  guest_essentials_override?: unknown;
};

export type BuildPropertyPlaceholderVarsInput = {
  propertyId?: string | null;
  booking?: PropertyPlaceholderBooking | null;
  /** Already reveal-gated essentials. Loaded when omitted and a booking is present. */
  essentials?: GuestEssentialsDto | null;
  /** Guide and trip page only: print revealed secrets instead of the pointer text. */
  revealSecrets?: boolean;
  /** "Available Dec 9, 2:00 PM" while secrets are still withheld. */
  revealLabel?: string | null;
  now?: Date;
};

export type PropertyPlaceholderVarsResult = {
  vars: Record<string, string>;
  /** Plain tokens for this property that resolve to an empty string. */
  emptyPlaceholders: string[];
};

const SECRET_POINTER = 'on your trip page';

/**
 * Property reads carry pricing, reviews and media. Rendering several emails or a stay guide
 * would otherwise pay for that repeatedly. The branding loader already caches for 30s, so
 * match it.
 */
const PROPERTY_CACHE_TTL_MS = 30_000;
const propertyCache = new Map<
  string,
  { at: number; value: Awaited<ReturnType<typeof loadPublicPropertyById>> }
>();

async function loadPropertyCached(propertyId: string) {
  const hit = propertyCache.get(propertyId);
  if (hit && Date.now() - hit.at < PROPERTY_CACHE_TTL_MS) return hit.value;
  const value = await loadPublicPropertyById(propertyId, { allowInactive: true }).catch(() => null);
  propertyCache.set(propertyId, { at: Date.now(), value });
  return value;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function listHtml(items: string[]): string {
  if (items.length === 0) return '';
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function detailSectionHtml(title: string, rows: Array<[string, string]>): string {
  const usable = rows.filter(([, value]) => value.trim());
  if (usable.length === 0) return '';
  const cells = usable
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#667085;font-weight:500;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:6px 0;color:#101828;">${escapeHtml(value)}</td></tr>`
    )
    .join('');
  return `<p style="margin:0 0 10px 0;font-weight:700;color:#101828;">${escapeHtml(title)}</p><table role="presentation" style="width:100%;border-collapse:collapse;font-size:15px;line-height:1.6;">${cells}</table>`;
}

function ctaButtonHtml(label: string, url: string): string {
  if (!url.trim()) return '';
  return `<div class="cta-wrap" style="margin:16px 0 8px 0;text-align:center;"><a class="cta-btn" href="${escapeHtml(url)}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 22px;border-radius:10px;background-color:#2DAA97;color:#ffffff;font-weight:700;text-decoration:none;">${escapeHtml(label)}</a></div>`;
}

function peso(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(Number(amount))) return '';
  return `₱${Number(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** "Available Dec 9, 2:00 PM" in Manila, for a withheld secret. */
export function formatSecretRevealLabel(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const label = date.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  return `Available ${label}`;
}

export async function buildPropertyPlaceholderVars(
  input: BuildPropertyPlaceholderVarsInput
): Promise<PropertyPlaceholderVarsResult> {
  const propertyId = str(input.propertyId);
  const vars: Record<string, string> = {};
  const emptyPlaceholders: string[] = [];

  if (!propertyId) {
    return {
      vars: Object.fromEntries(plainTokenKeys().map((key) => [key, ''])),
      emptyPlaceholders: plainTokenKeys(),
    };
  }

  const settings = await resolveAppSettings(propertyId);
  const [property, formSettings, contact] = await Promise.all([
    loadPropertyCached(propertyId),
    resolveGuestFormSettings(propertyId).catch(() => null),
    loadGuestFacingContactInfo(propertyId, settings),
  ]);

  const essentials =
    input.essentials !== undefined
      ? input.essentials
      : input.booking
        ? await loadGuestEssentials({
            propertyId,
            booking: {
              status: input.booking.status,
              check_in_date: input.booking.check_in_date,
              check_in_time: input.booking.check_in_time,
              guest_essentials_override: input.booking.guest_essentials_override,
            },
            now: input.now,
          })
        : null;

  const propertyName = property?.name ?? formSettings?.propertyName ?? '';
  const address = property?.address || property?.locationLabel || '';
  const mapsUrl =
    property?.mapsUrl ||
    (property?.latitude != null && property?.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${property.latitude},${property.longitude}`
      : '');
  const hostName = property?.host.ownerName ?? '';
  const orgName = property?.host.organizationName ?? formSettings?.organizationName ?? '';

  const slug = property?.slug ?? (await resolvePropertySlugById(propertyId)) ?? '';
  const bookingId = str(input.booking?.id);
  const bookingPropertyId = str(input.booking?.property_id);
  const bookingBelongsToProperty = !bookingPropertyId || bookingPropertyId === propertyId;
  let stayGuideUrl = '';
  let messagesUrl = '';
  if (slug && bookingId && bookingBelongsToProperty) {
    try {
      const token = await mintGuestBookingAccessToken(bookingId);
      stayGuideUrl = guestStayGuidePath(settings.publicGuestAppOrigin, slug, token);
      messagesUrl = guestMessagesPath(settings.publicGuestAppOrigin, slug, bookingId, token);
    } catch (err) {
      console.warn('[propertyTemplatePropertyVars] link mint failed:', err);
    }
  }

  const shownSecret = (value: string | null, label: string | null) =>
    value && value.trim() ? value : label?.trim() || 'Ask your host';

  if (input.revealSecrets && essentials) {
    vars.wifi_password = escapeHtml(
      shownSecret(essentials.wifiPassword, input.revealLabel ?? null)
    );
    vars.door_code = essentials.hasDoorCode
      ? escapeHtml(shownSecret(essentials.doorCode, input.revealLabel ?? null))
      : '';
  } else {
    vars.wifi_password = SECRET_POINTER;
    vars.door_code = SECRET_POINTER;
  }

  vars.property_name = escapeHtml(propertyName);
  vars.residence_name = escapeHtml(property?.residenceName ?? formSettings?.residenceName ?? '');
  vars.property_address = escapeHtml(address);
  vars.map_link = escapeHtml(mapsUrl);
  vars.host_name = escapeHtml(hostName);
  vars.org_name = escapeHtml(orgName);
  vars.max_guests = String(property?.maxGuests ?? formSettings?.maxAdults ?? '');
  vars.tower_and_unit_number = escapeHtml(property?.towerAndUnit ?? propertyName);
  vars.unit_number = vars.tower_and_unit_number;

  vars.wifi_name = escapeHtml(essentials?.wifiName ?? '');
  vars.unit_floor = escapeHtml(essentials?.unitFloor ?? '');
  vars.parking_slot_note = escapeHtml(essentials?.parkingSlotNote ?? '');
  vars.garbage_schedule = escapeHtml(essentials?.garbageSchedule ?? '');
  vars.quiet_hours = escapeHtml(essentials?.quietHours ?? '');
  vars.building_security_phone = escapeHtml(essentials?.buildingSecurityPhone ?? '');
  vars.emergency_contact_name = escapeHtml(essentials?.emergencyContactName ?? '');
  vars.emergency_contact_phone = escapeHtml(essentials?.emergencyContactPhone ?? '');

  vars.pet_fee = peso(property?.pricing.petFee);
  vars.parking_rate = peso(property?.pricing.parkingRateGuest ?? settings.defaultParkingRateGuest);

  vars.stay_guide_url = escapeHtml(stayGuideUrl);
  vars.messages_url = escapeHtml(messagesUrl);

  Object.assign(vars, buildGuestFacingPlaceholderVars(contact));

  vars.house_rules_list = listHtml((property?.houseRules ?? []).map((rule) => rule.text));
  vars.amenities_list = listHtml(property?.amenities ?? []);

  vars.contact_section = detailSectionHtml('Contact us', [
    ['Name', contact.contactName],
    ['Phone', contact.contactPhone],
    ['Email', contact.contactEmail],
  ]);
  vars.emergency_contacts_section = detailSectionHtml('Emergency contacts', [
    [
      'Emergency contact',
      [essentials?.emergencyContactName, essentials?.emergencyContactPhone]
        .filter(Boolean)
        .join(', '),
    ],
    ['Building security', essentials?.buildingSecurityPhone ?? ''],
  ]);
  vars.map_cta_section = ctaButtonHtml('Open in Maps', mapsUrl);

  const policy = property?.cancellationPolicy;
  vars.cancellation_policy_section =
    policy && !policy.unset
      ? `<p style="margin:0 0 6px 0;font-weight:700;color:#101828;">${escapeHtml(policy.title)}</p><p style="margin:0;color:#333333;line-height:1.6;">${escapeHtml(policy.description)}</p>`
      : '';

  vars.arrival_access_note_section =
    essentials && (essentials.wifiName || essentials.hasDoorCode)
      ? essentials.revealAt
        ? `<p style="margin:0 0 16px 0;">Wi-Fi and door details appear shortly before check-in under Essentials on your trip page.</p>`
        : `<p style="margin:0 0 16px 0;">Your Wi-Fi and door details are under Essentials on your trip page.</p>`
      : '';

  vars.reveal_label = escapeHtml(
    input.revealLabel ??
      (essentials?.revealAt ? (formatSecretRevealLabel(essentials.revealAt) ?? '') : '')
  );

  for (const key of plainTokenKeys()) {
    if (!Object.prototype.hasOwnProperty.call(vars, key)) {
      vars[key] = '';
    }
    if (!vars[key].trim()) emptyPlaceholders.push(key);
  }

  return { vars, emptyPlaceholders };
}

/** Plain property-data tokens the GET response can flag as empty for this property. */
export function plainTokenKeys(): string[] {
  return [
    'property_name',
    'residence_name',
    'property_address',
    'map_link',
    'host_name',
    'org_name',
    'max_guests',
    'wifi_name',
    'unit_floor',
    'parking_slot_note',
    'garbage_schedule',
    'quiet_hours',
    'building_security_phone',
    'emergency_contact_name',
    'emergency_contact_phone',
    'pet_fee',
    'parking_rate',
    'contact_name',
    'contact_phone',
    'contact_email',
    'stay_guide_url',
    'messages_url',
  ];
}
