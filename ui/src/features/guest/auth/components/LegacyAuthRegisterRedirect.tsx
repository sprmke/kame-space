import { Navigate, useSearchParams } from 'react-router-dom';

import { safeRedirect } from '@/features/guest/auth/lib/authRedirect';

interface LegacyAuthRegisterRedirectProps {
  /** Builds the audience's sign-in URL, forwarding `?redirect=` when present. */
  resolveLoginHref: (redirect: string | undefined) => string;
}

/**
 * `/register` alias → the audience's single sign-in page.
 *
 * Email OTP creates the account on first verified code, so a separate register screen would
 * render the identical form. Old bookmarks and links keep working; `?redirect=` is preserved
 * after the same same-origin check the login page applies.
 */
export function LegacyAuthRegisterRedirect({ resolveLoginHref }: LegacyAuthRegisterRedirectProps) {
  const [params] = useSearchParams();
  const raw = params.get('redirect');
  const safe = raw ? safeRedirect(raw, '') : '';
  return <Navigate to={resolveLoginHref(safe || undefined)} replace />;
}
