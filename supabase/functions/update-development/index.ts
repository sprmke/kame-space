/**
 * update-development — PATCH platform development (super admin).
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  developmentStatsByName,
  serializeDevelopment,
  type DevelopmentRow,
} from '../_shared/developmentSerialize.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { validateOptionalEmail } from '../_shared/appSettings.ts';
import {
  mergeDocumentRequirements,
  parseDocumentRequirements,
  removedRequirementIds,
} from '../_shared/documentRequirements.ts';
import {
  normalizeResidenceStructure,
  validateResidenceStructure,
} from '../_shared/residenceProfile.ts';
import { verifySuperAdminJwt } from '../_shared/superAdminAuth.ts';
import { logSuperAdminAction } from '../_shared/superAdminAudit.ts';
import { validatePropertyMediaArray } from '../_shared/propertyMedia.ts';
import { parseUnitTypes, validateUnitTypes } from '../_shared/unitTypes.ts';
import {
  parseGuestGuides,
  validateDevelopmentGuestInfoSettings,
} from '../_shared/developmentGuestInfo.ts';
import {
  parseHostAnnouncements,
  stampHostAnnouncementsForSave,
  validateHostAnnouncements,
} from '../_shared/hostAnnouncements.ts';


/** Non-terminal bookings whose approval-step snapshot still lists one of `removedIds`. */
async function countSnapshotsReferencing(
  supabase: ReturnType<typeof createServiceClient>,
  developmentId: string,
  removedIds: string[]
): Promise<number> {
  const { data: properties, error: propertyError } = await supabase
    .from('properties')
    .select('id')
    .eq('development_id', developmentId)
    .limit(500);
  if (propertyError) {
    throw new Error(`Could not check bookings for this development: ${propertyError.message}`);
  }
  const propertyIds = (properties ?? []).map((row) => (row as { id: string }).id);
  if (propertyIds.length === 0) return 0;

  const { data: bookings, error: bookingError } = await supabase
    .from('guest_submissions')
    .select('document_requirements_snapshot')
    .in('property_id', propertyIds)
    .not('document_requirements_snapshot', 'is', null)
    .not('status', 'in', '(COMPLETED,CANCELLED)')
    .limit(500);
  if (bookingError) {
    throw new Error(`Could not check bookings for this development: ${bookingError.message}`);
  }

  return (bookings ?? []).filter((row) => {
    const snapshot = (row as { document_requirements_snapshot: unknown })
      .document_requirements_snapshot;
    return mergeDocumentRequirements(snapshot).some((requirement) =>
      removedIds.includes(requirement.id)
    );
  }).length;
}

const DEVELOPMENT_TYPES = new Set([
  'CONDOMINIUM',
  'SUBDIVISION',
  'MIXED_USE',
  'TOWNHOUSE',
  'COMMERCIAL',
]);

const DEVELOPMENT_STATUSES = new Set(['ACTIVE', 'INACTIVE']);

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function numberOrNull(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return undefined;
}

function objectOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

serveAuthenticated('update-development', async (req) => {
  requireHttpMethod(req, 'PATCH');
  const admin = await verifySuperAdminJwt(req);

  const body = await readJsonBody(req);
  const developmentId = typeof body.developmentId === 'string' ? body.developmentId.trim() : '';
  if (!developmentId) {
    return jsonError(req, 'developmentId is required');
  }

  const supabase = createServiceClient();
  const { data: existing, error: loadError } = await supabase
    .from('developments')
    .select('*')
    .eq('id', developmentId)
    .maybeSingle();

  if (loadError) {
    console.error('[update-development]', loadError.message);
    throw new Error('Failed to load development');
  }
  if (!existing) {
    return jsonError(req, 'Development not found', 404);
  }

  // Optimistic concurrency: the editor sends the `updated_at` it loaded. A second save
  // from a stale tab gets a 409 instead of silently overwriting the other admin.
  const expectedUpdatedAt =
    typeof body.expectedUpdatedAt === 'string' ? body.expectedUpdatedAt.trim() : '';
  if (expectedUpdatedAt && expectedUpdatedAt !== (existing as DevelopmentRow).updated_at) {
    return jsonError(
      req,
      'This development changed since you loaded it. Reload to see the latest version.',
      409
    );
  }

  const restoreHistoryId =
    typeof body.restoreHistoryId === 'string' ? body.restoreHistoryId.trim() : '';
  if (restoreHistoryId) {
    const { data: version, error: versionError } = await supabase
      .from('development_settings_history')
      .select('id, settings, saved_at, saved_by_email')
      .eq('id', restoreHistoryId)
      .eq('development_id', developmentId)
      .maybeSingle();
    if (versionError) {
      console.error('[update-development] history load:', versionError.message);
      throw new Error('Failed to load that version');
    }
    if (!version) return jsonError(req, 'Version not found', 404);

    // An old version was valid when saved, but a schema rule may have tightened since.
    const restoredSettings = (version as { settings?: Record<string, unknown> }).settings ?? {};
    if (restoredSettings.structure !== undefined) {
      const restoredStructure = normalizeResidenceStructure(restoredSettings.structure);
      const restoredStructureError = validateResidenceStructure(restoredStructure);
      if (restoredStructureError) {
        return jsonError(req, `That version is no longer valid: ${restoredStructureError}`);
      }
      restoredSettings.structure = restoredStructure;
    }

    const { error: restoreError } = await supabase
      .from('developments')
      .update({ settings: restoredSettings, updated_at: new Date().toISOString() })
      .eq('id', developmentId);
    if (restoreError) {
      console.error('[update-development] restore:', restoreError.message);
      throw new Error('Failed to restore that version');
    }

    await logSuperAdminAction(admin, {
      action: 'development.settings_restored',
      targetType: 'development',
      targetId: developmentId,
      summary: `Restored a settings version of ${(existing as DevelopmentRow).name}`,
      metadata: { historyId: restoreHistoryId, savedAt: (version as { saved_at?: string }).saved_at },
    });

    const { data: restored } = await supabase
      .from('developments')
      .select('*')
      .eq('id', developmentId)
      .maybeSingle();

    const restoredRow = (restored ?? existing) as DevelopmentRow;
    const statsMap = await developmentStatsByName(supabase, [restoredRow.name]);
    return jsonSuccess(req, {
      development: serializeDevelopment(
        restoredRow,
        statsMap.get(restoredRow.name) ?? { propertyCount: 0, parkingCount: 0 }
      ),
      restored: true,
    });
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  const settingsPatch: Record<string, unknown> = {
    ...((existing as DevelopmentRow).settings ?? {}),
  };
  let settingsChanged = false;

  if (typeof body.name === 'string') {
    const name = body.name.trim();
    if (name.length < 2 || name.length > 160) {
      return jsonError(req, 'Development name must be 2–160 characters');
    }
    const { data: nameConflict } = await supabase
      .from('developments')
      .select('id')
      .eq('name', name)
      .neq('id', developmentId)
      .maybeSingle();
    if (nameConflict) {
      return jsonError(req, 'A development with this name already exists', 409);
    }
    patch.name = name;
  }

  if (typeof body.slug === 'string') {
    const slug = body.slug.trim();
    if (!slug) {
      return jsonError(req, 'Slug cannot be empty');
    }
    const { data: slugConflict } = await supabase
      .from('developments')
      .select('id')
      .eq('slug', slug)
      .neq('id', developmentId)
      .maybeSingle();
    if (slugConflict) {
      return jsonError(req, 'Slug is already in use', 409);
    }
    patch.slug = slug;
  }

  if (body.developerName !== undefined) {
    patch.developer_name =
      typeof body.developerName === 'string' ? body.developerName.trim() || null : null;
  }

  if (typeof body.type === 'string') {
    if (!DEVELOPMENT_TYPES.has(body.type)) {
      return jsonError(req, 'Invalid development type');
    }
    patch.type = body.type;
  }

  if (typeof body.status === 'string') {
    if (!DEVELOPMENT_STATUSES.has(body.status)) {
      return jsonError(req, 'Invalid status');
    }
    patch.status = body.status;
  }

  if (body.location !== undefined) {
    patch.location = typeof body.location === 'string' ? body.location.trim() || null : null;
  }

  if (body.city !== undefined) {
    patch.city = typeof body.city === 'string' ? body.city.trim() || null : null;
  }

  if (body.description !== undefined) {
    patch.description =
      typeof body.description === 'string' ? body.description.trim() || null : null;
  }

  if (body.coverImageUrl !== undefined) {
    patch.cover_image_url =
      typeof body.coverImageUrl === 'string' ? body.coverImageUrl.trim() || null : null;
  }

  if (body.media !== undefined) {
    const validated = validatePropertyMediaArray(body.media);
    if (!validated.ok) {
      return jsonError(req, validated.error);
    }
    settingsPatch.media = validated.items;
    settingsPatch.images = validated.items
      .filter((item) => item.type === 'image')
      .map((item) => item.url);
    settingsChanged = true;

    const primary =
      validated.items.find((item) => item.type === 'image' && item.isPrimary) ??
      validated.items.find((item) => item.type === 'image');
    if (primary?.url) {
      patch.cover_image_url = primary.url;
    }
  }

  const settingsFields: Array<[string, unknown]> = [
    ['images', stringArray(body.images)],
    ['amenities', stringArray(body.amenities)],
    ['propertyTowers', stringArray(body.propertyTowers)],
    ['parkingTowers', stringArray(body.parkingTowers)],
    ['parkingLevels', stringArray(body.parkingLevels)],
    ['address', typeof body.address === 'string' ? body.address.trim() || null : undefined],
    ['province', typeof body.province === 'string' ? body.province.trim() || null : undefined],
    ['country', typeof body.country === 'string' ? body.country.trim() || null : undefined],
    ['zipCode', typeof body.zipCode === 'string' ? body.zipCode.trim() || null : undefined],
    ['mapsUrl', typeof body.mapsUrl === 'string' ? body.mapsUrl.trim() || null : undefined],
    ['placeId', typeof body.placeId === 'string' ? body.placeId.trim() || null : undefined],
    ['latitude', numberOrNull(body.latitude)],
    ['longitude', numberOrNull(body.longitude)],
    ['pmoEmail', typeof body.pmoEmail === 'string' ? body.pmoEmail.trim() || null : undefined],
  ];

  for (const [key, value] of settingsFields) {
    if (value === undefined) continue;
    if (key === 'pmoEmail' && typeof value === 'string' && value.trim()) {
      const err = validateOptionalEmail(value, 'PMO email');
      if (err) return jsonError(req, err);
    }
    settingsPatch[key] = value;
    settingsChanged = true;
  }

  if (body.structure !== undefined) {
    const structure = normalizeResidenceStructure(body.structure);
    const structureError = validateResidenceStructure(structure);
    if (structureError) {
      return jsonError(req, structureError);
    }
    settingsPatch.structure = structure;
    // Flat keys stay in sync until Phase 7 retires them.
    settingsPatch.propertyTowers = structure.propertyTowers.map((tower) => tower.name);
    settingsPatch.parkingTowers = structure.parkingTowers.map((tower) => tower.name);
    settingsPatch.parkingLevels = [
      ...new Set(structure.parkingTowers.flatMap((tower) => tower.levels)),
    ];
    settingsChanged = true;
  }

  if (body.unitTypes !== undefined) {
    const parsed = parseUnitTypes(body.unitTypes);
    if (!parsed) {
      return jsonError(req, 'Each unit type needs an id, label, and max adults');
    }
    const unitTypeError = validateUnitTypes(parsed);
    if (unitTypeError) {
      return jsonError(req, unitTypeError);
    }
    settingsPatch.unitTypes = parsed;
    settingsChanged = true;
  }

  if (body.documentRequirements !== undefined) {
    if (!Array.isArray(body.documentRequirements)) {
      return jsonError(req, 'documentRequirements must be an array');
    }
    // `parseDocumentRequirements` skips malformed entries, so compare counts and
    // reject rather than silently dropping a row the super admin still sees.
    const parsed = parseDocumentRequirements(body.documentRequirements) ?? [];
    if (parsed.length !== body.documentRequirements.length) {
      return jsonError(
        req,
        'Each document requirement needs an id, label, order, trigger, and approval source'
      );
    }
    const existingRequirements = (objectOrEmpty(settingsPatch.workflowDefaults) as Record<
      string,
      unknown
    >).documentRequirements;
    const removedIds = removedRequirementIds(existingRequirements, parsed);
    if (removedIds.length > 0) {
      // A booking that already started with a step must keep it; retire it instead.
      let inFlight = 0;
      try {
        inFlight = await countSnapshotsReferencing(supabase, developmentId, removedIds);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not check bookings';
        return jsonError(req, message, 500);
      }
      if (inFlight > 0) {
        return jsonError(
          req,
          `${inFlight} booking${inFlight === 1 ? '' : 's'} already started with a step you removed. Set it to inactive instead.`,
          409
        );
      }
    }
    settingsPatch.workflowDefaults = {
      ...objectOrEmpty(settingsPatch.workflowDefaults),
      documentRequirements: parsed,
    };
    settingsChanged = true;
  }

  if (body.poolFee !== undefined) {
    const poolFee = numberOrNull(body.poolFee);
    if (poolFee === undefined) {
      return jsonError(req, 'poolFee must be a number or null');
    }
    if (poolFee != null && poolFee < 0) {
      return jsonError(req, 'poolFee cannot be negative');
    }
    settingsPatch.poolFee = poolFee;
    settingsChanged = true;
  }

  if (body.poolSchedule !== undefined) {
    settingsPatch.poolSchedule =
      typeof body.poolSchedule === 'string' ? body.poolSchedule.trim() || null : null;
    settingsChanged = true;
  }

  if (body.guestRequirements !== undefined) {
    settingsPatch.guestRequirements =
      typeof body.guestRequirements === 'string' ? body.guestRequirements.trim() || null : null;
    settingsChanged = true;
  }

  if (body.importantInfo !== undefined) {
    settingsPatch.importantInfo =
      typeof body.importantInfo === 'string' ? body.importantInfo.trim() || null : null;
    settingsChanged = true;
  }

  if (body.guestGuides !== undefined) {
    if (!Array.isArray(body.guestGuides)) {
      return jsonError(req, 'guestGuides must be an array');
    }
    const parsed = parseGuestGuides(body.guestGuides);
    if (parsed.length !== body.guestGuides.length) {
      return jsonError(req, 'Each guest guide needs an id, title, and content');
    }
    settingsPatch.guestGuides = parsed;
    settingsChanged = true;
  }

  if (body.announcements !== undefined) {
    if (!Array.isArray(body.announcements)) {
      return jsonError(req, 'announcements must be an array');
    }
    const parsed = parseHostAnnouncements(body.announcements);
    if (parsed.length !== body.announcements.length) {
      return jsonError(req, 'Each announcement needs an id, title, and message');
    }
    const validationError = validateHostAnnouncements(parsed);
    if (validationError) {
      return jsonError(req, validationError);
    }
    settingsPatch.announcements = stampHostAnnouncementsForSave(
      parsed,
      parseHostAnnouncements((existing as DevelopmentRow).settings?.announcements)
    );
    settingsChanged = true;
  }

  if (settingsChanged) {
    const guestInfoError = validateDevelopmentGuestInfoSettings(settingsPatch);
    if (guestInfoError) {
      return jsonError(req, guestInfoError);
    }
    patch.settings = settingsPatch;

    // Keep the previous settings so a bad edit to a live residence is reversible.
    const { error: historyError } = await supabase.from('development_settings_history').insert({
      development_id: developmentId,
      settings: (existing as DevelopmentRow).settings ?? {},
      saved_by: admin.id ?? null,
      saved_by_email: admin.email ?? null,
    });
    if (historyError) {
      console.error('[update-development] history insert:', historyError.message);
    }
  }

  const { data, error } = await supabase
    .from('developments')
    .update(patch)
    .eq('id', developmentId)
    .select('*')
    .single();

  if (error) {
    console.error('[update-development]', error.message);
    throw new Error('Failed to update development');
  }

  const row = data as DevelopmentRow;

  await logSuperAdminAction(admin, {
    action: typeof patch.name === 'string' ? 'development.renamed' : 'development.settings_updated',
    targetType: 'development',
    targetId: developmentId,
    summary:
      typeof patch.name === 'string'
        ? `Renamed a development to ${row.name}`
        : `Updated the settings of ${row.name}`,
    metadata: { settingsChanged, fields: Object.keys(patch) },
  });

  // The FK is the identity; `residence_name` is the display copy. Keep it in step on rename
  // so grouping, search place slugs and the unmatched-row view stay consistent.
  if (typeof patch.name === 'string') {
    const [{ error: propertyRenameError }, { error: parkingRenameError }] = await Promise.all([
      supabase
        .from('properties')
        .update({ residence_name: row.name })
        .eq('development_id', developmentId),
      supabase
        .from('parkings')
        .update({ residence_name: row.name })
        .eq('development_id', developmentId),
    ]);
    if (propertyRenameError) {
      console.error('[update-development] property rename:', propertyRenameError.message);
    }
    if (parkingRenameError) {
      console.error('[update-development] parking rename:', parkingRenameError.message);
    }
  }

  const statsMap = await developmentStatsByName(supabase, [row.name]);

  return jsonSuccess(req, {
    development: serializeDevelopment(
      row,
      statsMap.get(row.name) ?? { propertyCount: 0, parkingCount: 0 }
    ),
  });
});
