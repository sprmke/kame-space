import { AuthPageContent } from '@/features/guest/auth/components';
import { HostAuthResolving } from '@/features/guest/auth/components/HostAuthResolving';
import { AUTH_PAGE_CONFIG } from '@/features/guest/auth/config/auth-page-config';
import { useHostGoogleAuth } from '@/features/guest/auth/hooks/useHostGoogleAuth';
import { useLocalTestSignIn } from '@/features/guest/auth/hooks/useLocalTestSignIn';
import { HOST_LOGIN_PATH } from '@/features/guest/auth/lib/hostAuthPaths';
import { resolveHostTestEmail } from '@/features/guest/auth/lib/localTestAuth';

import { appPageTitle, usePageTitle } from '@/lib/pageTitle';

export function HostLoginPage() {
  usePageTitle(appPageTitle('Sign In'));
  const hostAuth = useHostGoogleAuth({
    callbackPathname: HOST_LOGIN_PATH,
    defaultRedirect: '/dashboard',
  });
  const localTestEmail = import.meta.env.DEV ? resolveHostTestEmail(import.meta.env) : '';
  const localTest = useLocalTestSignIn(localTestEmail);

  if (hostAuth.status === 'admin' && hostAuth.isResolving) {
    return <HostAuthResolving />;
  }

  return (
    <AuthPageContent
      config={AUTH_PAGE_CONFIG.host}
      actions={{
        sendEmailOtp: hostAuth.sendEmailOtp,
        verifyEmailOtp: hostAuth.verifyEmailOtp,
        signInWithGoogle: hostAuth.signInWithGoogle,
        googleLoading: hostAuth.isSigningIn,
        bannerError: hostAuth.error ?? localTest.error?.message ?? null,
        testLogin: localTestEmail ? { email: localTestEmail } : null,
        testLoginLabel: 'Use local owner account',
        onTestLogin: localTest.signIn,
        testLoginLoading: localTest.loading,
      }}
    />
  );
}
