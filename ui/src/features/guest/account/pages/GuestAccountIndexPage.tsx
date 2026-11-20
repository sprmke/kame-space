import { Navigate } from 'react-router-dom';

import { GUEST_ACCOUNT_PROFILE_PATH } from '@/features/guest/account/lib/guestAccountPaths';

/**
 * `/account` lands on the Account hub (profile + drill rows on phone).
 * Trips / Messages / Saved stay on D10 tabs.
 */
export function GuestAccountIndexPage() {
  return <Navigate to={GUEST_ACCOUNT_PROFILE_PATH} replace />;
}
