/**
 * `list-properties` payload.
 *
 * Extracted so the handler and the session bootstrap share one implementation. Every
 * authorisation rule still comes from `verifyOrgListAccess`; this only packages the rows.
 */

import {
  type AuthenticatedUser,
  createServiceClient,
  serializeProperty,
  verifyOrgListAccess,
} from './orgAuth.ts';
import {
  computePropertyListStatsByPropertyId,
  propertyListStatsOrEmpty,
} from './propertyListStats.ts';

export type ListPropertiesPayload = {
  properties: Array<ReturnType<typeof serializeProperty> & { stats: unknown }>;
};

/** `orgId` or `orgSlug` selects the org; the caller's access is verified first. */
export async function loadPropertiesPayload(
  req: Request,
  user: AuthenticatedUser,
  selectors: { orgId?: string; orgSlug?: string }
): Promise<ListPropertiesPayload> {
  const { org, canListAllProperties } = await verifyOrgListAccess(
    req,
    selectors.orgId,
    selectors.orgSlug,
    user
  );

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('organization_id', org.id)
    .order('name', { ascending: true });

  if (error) {
    console.error('[list-properties]', error.message);
    throw new Error('Failed to list properties');
  }

  let properties = data ?? [];

  if (!canListAllProperties) {
    const { data: memberRows, error: memberError } = await supabase
      .from('property_members')
      .select('property_id')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (memberError) {
      console.error('[list-properties]', memberError.message);
      throw new Error('Failed to list properties');
    }

    const { data: planLimitedRows, error: planLimitedError } = await supabase
      .from('property_members')
      .select('property_id')
      .eq('user_id', user.id)
      .eq('status', 'inactive')
      .eq('plan_limited', true);

    if (planLimitedError) {
      console.error('[list-properties]', planLimitedError.message);
      throw new Error('Failed to list properties');
    }

    const allowed = new Set([
      ...(memberRows ?? []).map((row) => row.property_id as string),
      ...(planLimitedRows ?? []).map((row) => row.property_id as string),
    ]);
    properties = properties.filter((row) => allowed.has(row.id as string));
  }

  const propertyIds = properties.map((row) => row.id as string);
  let statsByPropertyId = new Map<string, ReturnType<typeof propertyListStatsOrEmpty>>();

  if (propertyIds.length > 0) {
    // Owner/admin scope can span hundreds of properties, so filter through an inner-joined
    // embed instead of an `id.in.(...)` list that overruns the request URI.
    const bookingsQuery = canListAllProperties
      ? supabase
          .from('guest_submissions')
          .select(
            'property_id, status, check_in_date, check_out_date, number_of_nights, booking_rate, number_of_adults, number_of_children, properties!inner(organization_id)'
          )
          .eq('properties.organization_id', org.id)
      : supabase
          .from('guest_submissions')
          .select(
            'property_id, status, check_in_date, check_out_date, number_of_nights, booking_rate, number_of_adults, number_of_children'
          )
          .in('property_id', propertyIds);

    const { data: bookingRows, error: bookingsError } = await bookingsQuery;

    if (bookingsError) {
      console.error('[list-properties] bookings', bookingsError.message);
      throw new Error('Failed to load property booking stats');
    }

    statsByPropertyId = computePropertyListStatsByPropertyId(bookingRows ?? []);
  }

  return {
    properties: properties.map((row) => ({
      ...serializeProperty(row),
      stats: propertyListStatsOrEmpty(statsByPropertyId, row.id as string),
    })),
  };
}
