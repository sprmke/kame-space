import { AuthPageContent } from '@/features/guest/auth/components';
import { AUTH_PAGE_CONFIG } from '@/features/guest/auth/config/auth-page-config';
import { useGuestAuthPage } from '@/features/guest/auth/hooks/useGuestAuthPage';

import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';

export function GuestLoginPage() {
  usePageTitle(publicPageTitle('Sign In'));
  const guestAuth = useGuestAuthPage({ defaultRedirect: '/' });

  return (
    <AuthPageContent
      config={AUTH_PAGE_CONFIG.guest}
      actions={{
        sendEmailOtp: guestAuth.sendEmailOtp,
        verifyEmailOtp: guestAuth.verifyEmailOtp,
        signInWithGoogle: guestAuth.signInWithGoogle,
        googleLoading: guestAuth.googleLoading,
        bannerError: guestAuth.error,
      }}
    />
  );
}
