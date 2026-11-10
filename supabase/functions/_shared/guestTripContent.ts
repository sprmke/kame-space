/**
 * Host-prepared content on the guest trip page (plan Phase 3, decisions D6 and D8).
 *
 * - Check-in / check-out instructions: the same property templates the stay guide uses,
 *   rendered inline on the trip page so a guest on any plan knows how to get in.
 * - "From your host": custom templates the host marked guest-visible, filtered to the
 *   trip stage.
 *
 * Placeholders go through the same pipeline as email and the stay guide, so a host writes
 * one template and it reads correctly everywhere.
 */

import { resolveAppSettings } from './appSettings.ts';
import { guestBookingEmailLinkPlaceholderExtras } from './guestBookingEmailLinks.ts';
import { createServiceClient } from './orgAuth.ts';
import {
  applyPropertyTemplatePlaceholders,
  buildBookingPlaceholderVars,
  prepareConfigurableEmailBodyHtml,
} from './propertyTemplateEmail.ts';
import { loadPropertyEmailBranding } from './propertyEmailBranding.ts';
import { resolvePropertyTemplateContent } from './propertyTemplates.ts';
import { resolvePropertySlugById } from './propertyScope.ts';
import type { GuestSubmission } from './types.ts';

/** Which trip moment a guest-visible template belongs to. */
export type GuestTemplatePhase = 'before' | 'arrival' | 'stay' | 'checkout' | 'after' | 'always';

/** Coarse stage the host writes for. */
export type GuestTripStage = 'before' | 'arrival' | 'stay' | 'checkout' | 'after';

export type GuestTripHostSection = {
  id: string;
  name: string;
  html: string;
  phase: GuestTemplatePhase;
};

export type GuestTripInstructions = {
  checkInHtml: string | null;
  checkOutHtml: string | null;
};

export type GuestTripContent = GuestTripInstructions & {
  hostSections: GuestTripHostSection[];
};

type TemplateRow = {
  id: string;
  name: string | null;
  content: string;
  guest_phase: string | null;
};

const PHASES: readonly GuestTemplatePhase[] = [
  'before',
  'arrival',
  'stay',
  'checkout',
  'after',
  'always',
];

function isGuestTemplatePhase(value: unknown): value is GuestTemplatePhase {
  return typeof value === 'string' && (PHASES as readonly string[]).includes(value);
}

/**
 * Maps the booking status to the coarse stage a host writes for.
 *
 * Coarser than the trip page's own phase model on purpose: a host writing "how to use the
 * induction hob" should mark it "stay", not reason about arrival day.
 *
 * `stay` is true while the guest is inside the stay window (checked in, not yet out).
 */
export function guestTripStage(status: string, isInStay: boolean): GuestTripStage {
  const s = String(status ?? '').trim();
  if (s === 'CANCELLED') return 'after';
  if (s === 'PENDING_SD_REFUND' || s === 'COMPLETED') return 'after';
  if (s === 'READY_FOR_CHECKOUT') return isInStay ? 'checkout' : 'after';
  if (s === 'READY_FOR_CHECKIN') return isInStay ? 'stay' : 'arrival';
  return 'before';
}

/** A section shows when it matches the stage, or when the host left it as "always". */
export function guestSectionVisibleAtPhase(
  phase: GuestTemplatePhase,
  stage: GuestTripStage
): boolean {
  return phase === 'always' || phase === stage;
}

/** Everything the trip page needs to render host content, with one settings read. */
export async function loadGuestTripContent(input: {
  propertyId: string;
  booking: GuestSubmission;
  publicOrigin: string;
  stage: GuestTripStage;
}): Promise<GuestTripContent> {
  const propertyId = String(input.propertyId ?? '').trim();
  if (!propertyId) return { checkInHtml: null, checkOutHtml: null, hostSections: [] };

  const settings = await resolveAppSettings(propertyId);
  const branding = await loadPropertyEmailBranding(propertyId);
  const propertySlug = (await resolvePropertySlugById(propertyId)) ?? '';
  const bookingId = String(input.booking.id ?? '').trim();

  const linkExtras =
    bookingId && propertySlug
      ? await guestBookingEmailLinkPlaceholderExtras({
          origin: input.publicOrigin,
          propertySlug,
          bookingId,
        })
      : {
          property_slug: propertySlug,
          form_url: '',
          sd_form_url: '',
          review_url: '',
          trip_url: '',
        };

  const vars = buildBookingPlaceholderVars(input.booking, settings, linkExtras, branding);
  const render = (content: string): string =>
    // Absolutizes images and relative links against the public origin, same as email.
    prepareConfigurableEmailBodyHtml(
      applyPropertyTemplatePlaceholders(content, vars),
      input.publicOrigin
    );

  const [checkIn, checkOut, customResult] = await Promise.all([
    resolvePropertyTemplateContent(propertyId, 'check-in-instructions'),
    resolvePropertyTemplateContent(propertyId, 'check-out-instructions'),
    createServiceClient()
      .from('property_template_contents')
      .select('id, name, content, guest_phase')
      .eq('property_id', propertyId)
      .eq('category', 'custom')
      .eq('guest_visible', true)
      .order('name', { ascending: true }),
  ]);

  if (customResult.error) {
    console.warn('[guestTripContent] host sections failed:', customResult.error.message);
  }

  const rows = ((customResult.data ?? []) as TemplateRow[]).filter((row) => row.content.trim());
  const hostSections: GuestTripHostSection[] = [];
  for (const row of rows) {
    const phase: GuestTemplatePhase = isGuestTemplatePhase(row.guest_phase)
      ? row.guest_phase
      : 'always';
    if (!guestSectionVisibleAtPhase(phase, input.stage)) continue;
    hostSections.push({
      id: row.id,
      name: (row.name ?? '').trim() || 'From your host',
      html: render(row.content),
      phase,
    });
  }

  return {
    checkInHtml: checkIn.content.trim() ? render(checkIn.content) : null,
    checkOutHtml: checkOut.content.trim() ? render(checkOut.content) : null,
    hostSections,
  };
}
