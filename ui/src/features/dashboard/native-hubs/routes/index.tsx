import { lazy } from 'react';
import type { ReactNode } from 'react';

import { Route } from 'react-router-dom';

import type {
  OrgRouteFn,
  ParkingRouteFn,
  PropertyRouteFn,
} from '@/features/dashboard/org/routes/guards';

import { PropertyDashboardRouteSkeleton } from '@/components/skeletons/RouteSkeletons';

const WorkHubPage = lazy(() =>
  import('@/features/dashboard/native-hubs/pages/WorkHubPage').then((m) => ({
    default: m.WorkHubPage,
  }))
);
const YouHubPage = lazy(() =>
  import('@/features/dashboard/native-hubs/pages/YouHubPage').then((m) => ({
    default: m.YouHubPage,
  }))
);

const HubSkeleton = PropertyDashboardRouteSkeleton;

export function nativeHubsPropertyRoute(propertyRoute: PropertyRouteFn): ReactNode {
  return (
    <>
      <Route path="work" element={propertyRoute('dashboard', <WorkHubPage />, <HubSkeleton />)} />
      <Route path="you" element={propertyRoute('dashboard', <YouHubPage />, <HubSkeleton />)} />
    </>
  );
}

export function nativeHubsParkingRoute(parkingRoute: ParkingRouteFn): ReactNode {
  return (
    <>
      <Route path="work" element={parkingRoute('dashboard', <WorkHubPage />, <HubSkeleton />)} />
      <Route path="you" element={parkingRoute('dashboard', <YouHubPage />, <HubSkeleton />)} />
    </>
  );
}

const OrgAlertsPage = lazy(() =>
  import('@/features/dashboard/native-hubs/pages/OrgAlertsPage').then((m) => ({
    default: m.OrgAlertsPage,
  }))
);

export function nativeHubsOrgRoute(orgRoute: OrgRouteFn): ReactNode {
  return (
    <>
      <Route path="alerts" element={orgRoute('dashboard', <OrgAlertsPage />, <HubSkeleton />)} />
      <Route path="work" element={orgRoute('dashboard', <WorkHubPage />, <HubSkeleton />)} />
      <Route path="you" element={orgRoute('dashboard', <YouHubPage />, <HubSkeleton />)} />
    </>
  );
}
