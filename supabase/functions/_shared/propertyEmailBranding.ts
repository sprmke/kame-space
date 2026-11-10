/**
 * Property + org labels for workflow email From headers, subjects, and shells.
 */

import { createClient } from './supabaseJs.ts';
import { resolveAppSettings, type AppSettingsResolved } from './appSettings.ts';
import { resolvePublicBrandName } from './platformBrand.ts';
import { getDefaultPropertyId } from './propertyScope.ts';

export type PropertyEmailBranding = {
  organizationName: string;
  propertyName: string;
  /** Default unit line when booking/form has no tower_and_unit */
  unitLabel: string;
  fromEmail: string;
};

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { at: number; value: PropertyEmailBranding }>();

function supabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

/** Booking/form unit wins; else property GAF unit → DB tower_and_unit → property name. */
export function resolveEmailUnitLabel(
  explicitUnit: string | null | undefined,
  branding: PropertyEmailBranding
): string {
  const trimmed = String(explicitUnit ?? '').trim();
  return trimmed || branding.unitLabel;
}

export function formatResendFromAddress(displayName: string, email: string): string {
  const safeName = displayName.replace(/[\r\n<>"]/g, ' ').trim() || 'Property';
  return `${safeName} <${email.trim()}>`;
}

export function sanitizeAttachmentToken(raw: string): string {
  const token = raw
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return token || 'PROPERTY';
}

export function formatEmailDateRange(checkIn: string, checkOut: string): string {
  return `(${checkIn} to ${checkOut})`;
}

/**
 * Pure half of {@link loadPropertyEmailBranding}: labels picked from the resolved settings
 * and the property/organization rows. The golden set snapshots it without a database.
 */
export function buildPropertyEmailBranding(input: {
  settings: AppSettingsResolved;
  property: { name: string | null; tower_and_unit: string | null } | null;
  organizationName: string;
  fromEmail: string;
}): PropertyEmailBranding {
  const propertyName = String(input.property?.name ?? '').trim();
  const organizationName = String(input.organizationName ?? '').trim();
  const unitLabel =
    input.settings.gafTowerAndUnitNumber?.trim() ||
    String(input.property?.tower_and_unit ?? '').trim() ||
    propertyName ||
    organizationName ||
    'Property';

  return {
    organizationName: resolvePublicBrandName(organizationName) || propertyName || 'Property',
    propertyName: propertyName || organizationName || 'Property',
    unitLabel,
    fromEmail: input.fromEmail,
  };
}

export async function loadPropertyEmailBranding(
  propertyId?: string | null
): Promise<PropertyEmailBranding> {
  const resolvedId = propertyId ?? (await getDefaultPropertyId());
  const hit = cache.get(resolvedId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const settings = await resolveAppSettings(resolvedId);
  const { data, error } = await supabaseAdmin()
    .from('properties')
    .select('name, tower_and_unit, organization_id')
    .eq('id', resolvedId)
    .maybeSingle();

  if (error) {
    console.warn('[propertyEmailBranding] property load failed:', error.message);
  }

  let orgName = '';
  const orgId = data?.organization_id as string | undefined;
  if (orgId) {
    const { data: org, error: orgErr } = await supabaseAdmin()
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .maybeSingle();
    if (orgErr) {
      console.warn('[propertyEmailBranding] org load failed:', orgErr.message);
    }
    orgName = String(org?.name ?? '').trim();
  }

  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')?.trim() || settings.emailReplyTo?.trim();
  if (!fromEmail) {
    throw new Error('Missing RESEND_FROM_EMAIL env or emailReplyTo in property app_settings');
  }

  const branding = buildPropertyEmailBranding({
    settings,
    property: (data as { name: string | null; tower_and_unit: string | null } | null) ?? null,
    organizationName: orgName,
    fromEmail,
  });

  cache.set(resolvedId, { at: Date.now(), value: branding });
  return branding;
}
