/**
 * check-tower-unit — GET tower + unit availability for succession UX.
 * Auth: verifyAuthenticatedUser.
 *
 * available: true when format is valid (create is never blocked by peers).
 * hasActiveListing: true when another ACTIVE property already uses this pair.
 */

import {
  isPropertyTower,
  isValidUnitNumber,
  lookupPropertyTowerUnitConflict,
} from '../_shared/propertyTowerUnit.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  formatUnitLabel,
  loadResidenceProfileForProperty,
  loadResidenceProfileForResidence,
  unitNumberError,
  validateTowerForProfile,
} from '../_shared/residenceProfile.ts';
import { jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('check-tower-unit', async (req) => {
  requireHttpMethod(req, 'GET');

  const url = new URL(req.url);
  const tower = url.searchParams.get('tower')?.trim() ?? '';
  const unitNumber = url.searchParams.get('unitNumber')?.trim() ?? '';
  const excludePropertyId = url.searchParams.get('excludePropertyId')?.trim() || undefined;
  const propertyId = url.searchParams.get('propertyId')?.trim() || undefined;
  const developmentId = url.searchParams.get('developmentId')?.trim() || undefined;
  const residenceName = url.searchParams.get('residenceName')?.trim() || undefined;

  const supabase = createServiceClient();
  const hasResidenceContext = Boolean(propertyId || developmentId || residenceName);
  const profile = propertyId
    ? await loadResidenceProfileForProperty(supabase, propertyId, { strict: false })
    : hasResidenceContext
      ? await loadResidenceProfileForResidence(
          supabase,
          { developmentId, residenceName },
          { strict: false }
        )
      : null;

  if (profile) {
    const validTower = validateTowerForProfile(profile, tower);
    const unitMessage = unitNumberError(profile, unitNumber);
    if (!validTower.ok || unitMessage) {
      return jsonSuccess(req, {
        available: false,
        reason: 'invalid',
        hasActiveListing: false,
        message: unitMessage ?? (validTower.ok ? null : validTower.error),
        conflict: null,
      });
    }

    const conflictWithResidence = await lookupPropertyTowerUnitConflict(
      supabase,
      validTower.tower,
      unitNumber.trim(),
      excludePropertyId,
      profile.developmentId
    );

    return jsonSuccess(req, {
      available: true,
      hasActiveListing: Boolean(conflictWithResidence),
      message: conflictWithResidence
        ? `This unit is already listed under ${conflictWithResidence.orgName ?? 'another organization'}`
        : null,
      conflict: conflictWithResidence
        ? {
            propertyId: conflictWithResidence.id,
            propertyName: conflictWithResidence.name,
            orgName: conflictWithResidence.orgName,
          }
        : null,
      towerAndUnit: formatUnitLabel(profile, validTower.tower, unitNumber),
    });
  }

  if (!isPropertyTower(tower) || !isValidUnitNumber(unitNumber)) {
    return jsonSuccess(req, {
      available: false,
      reason: 'invalid',
      hasActiveListing: false,
      message: null,
      conflict: null,
    });
  }

  const conflict = await lookupPropertyTowerUnitConflict(
    supabase,
    tower,
    unitNumber,
    excludePropertyId
  );

  return jsonSuccess(req, {
    available: true,
    hasActiveListing: Boolean(conflict),
    message: conflict
      ? `This unit is already listed under ${conflict.orgName ?? 'another organization'}`
      : null,
    conflict: conflict
      ? {
          propertyId: conflict.id,
          propertyName: conflict.name,
          orgName: conflict.orgName,
        }
      : null,
  });
});
