import { AuthPageContent } from '@/features/guest/auth/components';
import { AUTH_PAGE_CONFIG } from '@/features/guest/auth/config/auth-page-config';
import { useGuestAuthPage } from '@/features/guest/auth/hooks/useGuestAuthPage';
import { useLocalTestSignIn } from '@/features/guest/auth/hooks/useLocalTestSignIn';
import { resolveGuestTestEmail } from '@/features/guest/auth/lib/localTestAuth';

import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';

export function GuestLoginPage() {
  usePageTitle(publicPageTitle('Sign In'));
  const guestAuth = useGuestAuthPage({ defaultRedirect: '/' });
  const localTestEmail = import.meta.env.DEV ? resolveGuestTestEmail(import.meta.env) : '';
  const localTest = useLocalTestSignIn(localTestEmail);

  return (
    <AuthPageContent
      config={AUTH_PAGE_CONFIG.guest}
      actions={{
        sendEmailOtp: guestAuth.sendEmailOtp,
        verifyEmailOtp: guestAuth.verifyEmailOtp,
        signInWithGoogle: guestAuth.signInWithGoogle,
        googleLoading: guestAuth.googleLoading,
        bannerError: guestAuth.error ?? localTest.error?.message ?? null,
        testLogin: localTestEmail ? { email: localTestEmail } : null,
        onTestLogin: localTest.signIn,
        testLoginLoading: localTest.loading,
      }}
    />
  );
}
