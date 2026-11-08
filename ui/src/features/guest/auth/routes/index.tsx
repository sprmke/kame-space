import { lazy } from 'react';

import { Navigate, Route } from 'react-router-dom';

import { AuthLayout } from '@/features/guest/auth/components/AuthLayout';
import { LegacyAuthRegisterRedirect } from '@/features/guest/auth/components/LegacyAuthRegisterRedirect';
import { LegacySignInRedirect } from '@/features/guest/auth/components/LegacySignInRedirect';
import { guestLoginPath } from '@/features/guest/auth/lib/guestAuthPaths';
import { hostLoginPath } from '@/features/guest/auth/lib/hostAuthPaths';

const GuestLoginPage = lazy(() =>
  import('@/features/guest/auth/pages/GuestAuthPages').then((m) => ({
    default: m.GuestLoginPage,
  }))
);
const HostLoginPage = lazy(() =>
  import('@/features/guest/auth/pages/HostAuthPages').then((m) => ({ default: m.HostLoginPage }))
);

/**
 * Host + guest auth pages — both passwordless (email OTP + Google).
 *
 * There is one sign-in screen per audience: email OTP creates the account on first verified
 * code, so `/register` redirects to the matching `/login` instead of rendering a second form.
 */
export const guestAuthRoutes = [
  <Route key="legacy-sign-in" path="/sign-in" element={<LegacySignInRedirect />} />,
  <Route
    key="legacy-host-register"
    path="/for-hosts/register"
    element={<LegacyAuthRegisterRedirect resolveLoginHref={hostLoginPath} />}
  />,
  <Route
    key="legacy-guest-register"
    path="/for-guests/register"
    element={<LegacyAuthRegisterRedirect resolveLoginHref={guestLoginPath} />}
  />,
  <Route key="auth-shell" element={<AuthLayout />}>
    <Route path="for-hosts/login" element={<HostLoginPage />} />
    <Route path="for-guests/login" element={<GuestLoginPage />} />
  </Route>,
  <Route
    key="legacy-guest-auth"
    path="/for-guests/*"
    element={<Navigate to="/for-guests/login" replace />}
  />,
];
