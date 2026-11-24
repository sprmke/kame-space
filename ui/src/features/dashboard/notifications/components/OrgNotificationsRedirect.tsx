import { Navigate, useParams } from 'react-router-dom';

import { useProperties } from '@/features/dashboard/org/hooks/useOrganizations';
import {
  getLastPropertySlug,
  orgPropertiesPath,
  propertyNotificationsPath,
} from '@/features/dashboard/org/lib/tenantPaths';

/**
 * `/org/:orgSlug/notifications` has no page of its own: the hub is property scoped.
 * Without this route the URL fell through to the public 404, so a bookmark or a
 * stale link dropped an authenticated host out of the dashboard entirely.
 *
 * Resolves the org from the URL (not the last-used org) and reuses the last property
 * when it belongs to that org, otherwise the first one.
 */
export function OrgNotificationsRedirect() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { data, isLoading } = useProperties(orgSlug);

  if (!orgSlug) return <Navigate to="/org" replace />;
  if (isLoading && !data) return null;

  const properties = data?.properties ?? [];
  if (properties.length === 0) return <Navigate to={orgPropertiesPath(orgSlug)} replace />;

  const lastSlug = getLastPropertySlug();
  const property = properties.find((row) => row.slug === lastSlug) ?? properties[0]!;

  return <Navigate to={propertyNotificationsPath(orgSlug, property.slug)} replace />;
}
