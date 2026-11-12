/**
 * list-residence-options — public read of ACTIVE residence structure for host onboarding.
 *
 * Returns only the public slice (towers, unit/format rules, parking levels, occupancy,
 * terms, copy). Never approval recipients or PDF templates.
 *
 * Query: none. Rate limited.
 */

import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';
import { buildResidenceOptions } from '../_shared/residenceProfilePublic.ts';
import { servePublic } from '../_shared/serveEdge.ts';

servePublic('list-residence-options', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const limited = await publicGetRateLimitGate(req, 'list-residence-options');
  if (limited) return limited;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('developments')
    .select('id, name, slug, type, settings')
    .eq('status', 'ACTIVE')
    .order('name', { ascending: true })
    // Public, unauthenticated list: bound the payload instead of trusting the row count.
    .limit(200);

  if (error) {
    console.error('[list-residence-options]', error.message);
    return jsonError(req, 'Failed to load residences', 500);
  }

  return jsonSuccess(req, {
    residences: buildResidenceOptions(
      (data ?? []) as { id: string; name: string; slug: string; type: string; settings: unknown }[]
    ),
  });
});
