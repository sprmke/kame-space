/**
 * property-guest-essentials — host GET/PATCH for the structured arrival essentials shown on
 * the guest trip page and in the stay guide (guest journey plan D7, task 7.3).
 *
 * GET   ?property_id=                 templates:view
 * PATCH { property_id, essentials }   templates.standard:edit
 *
 * `templates.standard:edit` is the leaf that already governs check-in / check-out
 * instructions and house rules. Essentials are the same kind of guest-facing content, so
 * they reuse it rather than inventing a role.
 *
 * Secrets live in `property_guest_essentials`, never in `properties.settings`, which every
 * public listing read returns. Activity events record which fields changed, never values.
 */

import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import {
  buildEssentialsPatch,
  ESSENTIALS_SELECT_COLUMNS,
  toEssentialsAdminDto,
} from '../_shared/guestEssentialsAdmin.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('property-guest-essentials', async (req, user) => {
  if (req.method === 'GET') {
    const propertyId = new URL(req.url).searchParams.get('property_id')?.trim() ?? '';
    if (!propertyId) return jsonError(req, 'property_id is required', 400);

    await resolveScopedPropertyAccess(req, 'templates:view', propertyId);
    const { data, error } = await createServiceClient()
      .from('property_guest_essentials')
      .select(ESSENTIALS_SELECT_COLUMNS)
      .eq('property_id', propertyId)
      .maybeSingle();
    if (error) return jsonError(req, error.message, 500);

    return jsonSuccess(req, { essentials: toEssentialsAdminDto(data) });
  }

  if (req.method !== 'PATCH') return jsonError(req, 'Method not allowed', 405);

  const body = await readJsonBody(req);
  const propertyId = String(body.property_id ?? '').trim();
  if (!propertyId) return jsonError(req, 'property_id is required', 400);

  const access = await resolveScopedPropertyAccess(req, 'templates.standard:edit', propertyId);

  const raw = body.essentials;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return jsonError(req, 'essentials is required', 400);
  }

  const { patch, changed, error: validationError } = buildEssentialsPatch(
    raw as Record<string, unknown>
  );
  if (validationError) return jsonError(req, validationError, 400);
  if (Object.keys(patch).length === 0) return jsonError(req, 'Nothing to save', 400);

  const { data, error } = await createServiceClient()
    .from('property_guest_essentials')
    .upsert(
      { property_id: propertyId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'property_id' }
    )
    .select(ESSENTIALS_SELECT_COLUMNS)
    .maybeSingle();
  if (error) return jsonError(req, error.message, 500);

  await logActivity({
    action: 'settings.updated',
    organizationId: access.org.id,
    propertyId,
    scope: 'property',
    actor: buildActorContext('dashboard', { propertyAccess: access }, req),
    targetType: 'settings',
    targetId: propertyId,
    targetLabel: access.property.name ?? null,
    // Field names only. A values diff would put the Wi-Fi password and door code into the
    // activity feed, which hosts and org admins can read.
    metadata: { area: 'guest essentials', fields: changed.join(',') },
  });

  return jsonSuccess(req, { essentials: toEssentialsAdminDto(data) });
});
