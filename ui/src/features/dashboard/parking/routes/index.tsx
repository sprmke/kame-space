import { lazy } from 'react';
import type { ReactNode } from 'react';

import { Route } from 'react-router-dom';

import type { ParkingRouteFn } from '@/features/dashboard/org/routes/guards';

import {
  ParkingBookingsRouteSkeleton,
  ParkingBookingDetailRouteSkeleton,
  ParkingDashboardRouteSkeleton,
  ParkingFinanceRouteSkeleton,
  ParkingInboxRouteSkeleton,
  ParkingNotificationsRouteSkeleton,
  ParkingPricingRouteSkeleton,
  ParkingSettingsRouteSkeleton,
} from '@/components/skeletons/RouteSkeletons';

const ParkingInboxPage = lazy(() =>
  import('@/features/dashboard/inbox/pages/ParkingInboxPage').then((m) => ({
    default: m.ParkingInboxPage,
  }))
);
const ParkingBookingDetailPage = lazy(() =>
  import('@/features/dashboard/parking/pages/ParkingBookingDetailPage').then((m) => ({
    default: m.ParkingBookingDetailPage,
  }))
);
const ParkingBookingsPage = lazy(() =>
  import('@/features/dashboard/parking/pages/ParkingBookingsPage').then((m) => ({
    default: m.ParkingBookingsPage,
  }))
);
const ParkingDashboardPage = lazy(() =>
  import('@/features/dashboard/parking/pages/ParkingDashboardPage').then((m) => ({
    default: m.ParkingDashboardPage,
  }))
);
const ParkingFinancePage = lazy(() =>
  import('@/features/dashboard/parking/pages/ParkingFinancePage').then((m) => ({
    default: m.ParkingFinancePage,
  }))
);
const ParkingNotificationsPage = lazy(() =>
  import('@/features/dashboard/parking/pages/ParkingNotificationsPage').then((m) => ({
    default: m.ParkingNotificationsPage,
  }))
);
const ParkingPricingPage = lazy(() =>
  import('@/features/dashboard/parking/pages/ParkingPricingPage').then((m) => ({
    default: m.ParkingPricingPage,
  }))
);
const ParkingSettingsPage = lazy(() =>
  import('@/features/dashboard/parking/pages/ParkingSettingsPage').then((m) => ({
    default: m.ParkingSettingsPage,
  }))
);

/**
 * Every parking section goes through `parkingRoute()` — parity with `propertyRoute()`.
 * A bare route let a member open a page from a bookmarked URL even when the nav hid it, and
 * the page then 403'd on its first API call instead of showing the restricted state.
 */
export function parkingAdminRoutes(parkingRoute: ParkingRouteFn): ReactNode {
  return (
    <>
      <Route
        index
        element={parkingRoute(
          'dashboard',
          <ParkingDashboardPage />,
          <ParkingDashboardRouteSkeleton />
        )}
      />
      <Route
        path="bookings"
        element={parkingRoute(
          'bookings',
          <ParkingBookingsPage />,
          <ParkingBookingsRouteSkeleton />
        )}
      />
      <Route
        path="bookings/:bookingId"
        element={parkingRoute(
          'bookings',
          <ParkingBookingDetailPage />,
          <ParkingBookingDetailRouteSkeleton />
        )}
      />
      <Route
        path="finance"
        element={parkingRoute('finance', <ParkingFinancePage />, <ParkingFinanceRouteSkeleton />)}
      />
      <Route
        path="pricing"
        element={parkingRoute('pricing', <ParkingPricingPage />, <ParkingPricingRouteSkeleton />)}
      />
      <Route
        path="notifications"
        element={parkingRoute(
          'notifications',
          <ParkingNotificationsPage />,
          <ParkingNotificationsRouteSkeleton />
        )}
      />
      <Route
        path="settings"
        element={parkingRoute(
          'settings',
          <ParkingSettingsPage />,
          <ParkingSettingsRouteSkeleton />
        )}
      />
      <Route
        path="inbox"
        element={parkingRoute('inbox', <ParkingInboxPage />, <ParkingInboxRouteSkeleton />)}
      />
    </>
  );
}
