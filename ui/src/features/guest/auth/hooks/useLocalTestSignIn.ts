import { useCallback, useState } from 'react';

import { LOCAL_TEST_PASSWORD } from '@/features/guest/auth/lib/localTestAuth';

import { supabase } from '@/lib/supabase/client';

import type { AuthError } from '@supabase/supabase-js';

/**
 * Password sign-in for the seeded local test account. Only rendered in dev, so
 * reviewers can bypass Google OAuth inside each Orca browser session.
 */
export function useLocalTestSignIn(email: string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);

  const signIn = useCallback(async () => {
    if (!email) return null;
    setLoading(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: LOCAL_TEST_PASSWORD,
    });
    setLoading(false);
    if (authError) setError(authError);
    return authError;
  }, [email]);

  return { signIn, loading, error };
}
