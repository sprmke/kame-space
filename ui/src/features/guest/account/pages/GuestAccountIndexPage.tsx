import { Navigate } from 'react-router-dom';

import { GUEST_ACCOUNT_TRIPS_PATH } from '@/features/guest/account/lib/guestAccountPaths';

/**
 * `/account` lands on Trips.
 *
 * For a guest with an upcoming stay, the trips list is the most useful page. Profile is one
 * tap away in the account nav (plan D2, finding A3).
 */
export function GuestAccountIndexPage() {
  return <Navigate to={GUEST_ACCOUNT_TRIPS_PATH} replace />;
}
