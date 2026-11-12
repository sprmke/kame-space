/**
 * get-residence-profile — public read of one residence's structure.
 *
 * Resolve order: `developmentId`, then `residenceName`, then the property's own link.
 * Only ACTIVE developments are exposed. Returns the public slice; never approval wiring.
 *
 * Query: developmentId | residenceName | propertyId. Rate limited.
 */

import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';
import { toPublicResidenceProfile } from '../_shared/residenceProfilePublic.ts';
import {
  loadResidenceProfileForProperty,
  loadResidenceProfileForResidence,
  type ResidenceProfile,
} from '../_shared/residenceProfile.ts';
import { servePublic } from '../_shared/serveEdge.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';

servePublic('get-residence-profile', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const limited = await publicGetRateLimitGate(req, 'get-residence-profile');
  if (limited) return limited;

  const url = new URL(req.url);
  const developmentId = url.searchParams.get('developmentId')?.trim() || null;
  const residenceName = url.searchParams.get('residenceName')?.trim() || null;
  const propertyId = url.searchParams.get('propertyId')?.trim() || null;

  if (!developmentId && !residenceName && !propertyId) {
    return jsonError(req, 'developmentId, residenceName or propertyId is required');
  }

  const supabase = createServiceClient();
  let profile: ResidenceProfile;
  try {
    profile = propertyId
      ? await loadResidenceProfileForProperty(supabase, propertyId, { strict: false })
      : await loadResidenceProfileForResidence(
          supabase,
          { developmentId, residenceName },
          { strict: false }
        );
  } catch (error) {
    console.error('[get-residence-profile]', error);
    return jsonError(req, 'Failed to load residence', 500);
  }

  // An archiving or deleted development must not leak into host onboarding.
  if (profile.developmentId) {
    const { data: row } = await supabase
      .from('developments')
      .select('status')
      .eq('id', profile.developmentId)
      .maybeSingle();
    if ((row as { status?: string } | null)?.status !== 'ACTIVE') {
      return jsonError(req, 'Residence not found', 404);
    }
  }

  return jsonSuccess(req, { residence: toPublicResidenceProfile(profile) });
});
