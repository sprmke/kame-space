import { lazy } from 'react';
import type { ReactNode } from 'react';

import { Navigate, Route, useLocation, useParams } from 'react-router-dom';

import { orgPropertiesPath } from '@/features/dashboard/org/lib/tenantPaths';
import type { ParkingRouteFn, PropertyRouteFn } from '@/features/dashboard/org/routes/guards';

import {
  ParkingInboxRouteSkeleton,
  PropertyInboxRouteSkeleton,
} from '@/components/skeletons/RouteSkeletons';

const ParkingInboxPage = lazy(() =>
  import('@/features/dashboard/inbox/pages/ParkingInboxPage').then((m) => ({
    default: m.ParkingInboxPage,
  }))
);
const PropertyInboxPage = lazy(() =>
  import('@/features/dashboard/inbox/pages/PropertyInboxPage').then((m) => ({
    default: m.PropertyInboxPage,
  }))
);

/** Legacy org inbox → properties (pick a property to open Messages). */
export function OrgInboxRedirect() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  return <Navigate to={orgSlug ? orgPropertiesPath(orgSlug) : '/'} replace />;
}

/** Old `/inbox` URLs → `/messages`, keeping query and hash. */
export function LegacyInboxToMessagesRedirect() {
  const location = useLocation();
  const pathname = location.pathname.replace(/\/inbox\/?$/, '/messages');
  return <Navigate to={`${pathname}${location.search}${location.hash}`} replace />;
}

export function propertyInboxRoute(propertyRoute: PropertyRouteFn): ReactNode {
  return (
    <>
      <Route
        path="messages"
        element={propertyRoute('inbox', <PropertyInboxPage />, <PropertyInboxRouteSkeleton />)}
      />
      <Route path="inbox" element={<LegacyInboxToMessagesRedirect />} />
    </>
  );
}

export function parkingInboxRoute(parkingRoute: ParkingRouteFn): ReactNode {
  return (
    <>
      <Route
        path="messages"
        element={parkingRoute('inbox', <ParkingInboxPage />, <ParkingInboxRouteSkeleton />)}
      />
      <Route path="inbox" element={<LegacyInboxToMessagesRedirect />} />
    </>
  );
}
