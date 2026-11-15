import { useCallback, useEffect, useState } from 'react';

import { ArrowLeft } from 'lucide-react';

import { AuthDivider } from '@/features/guest/auth/components/AuthDivider';
import { useGuestAuthActions } from '@/features/guest/auth/hooks/useGuestAuthActions';

import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { KameSpaceBrandIcon } from '@/components/branding/KameSpaceBrandIcon';
import { SignInLegalNotice } from '@/components/legal/LegalNoticePresets';
import { useCaptchaToken } from '@/components/security/useCaptchaToken';
import { Button } from '@/components/ui/button';
import { SpinnerIcon } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { FORM_PLACEHOLDERS } from '@/lib/constants/formPlaceholders';
import { cn } from '@/lib/utils';

type Step = 'email' | 'otp';

interface GuestAuthModalProps {
  open: boolean;
  /** Voluntary sign-in (header) may dismiss; `requireGuestAuth` gates set this false. */
  dismissible?: boolean;
  onOpenChange: (open: boolean) => void;
  oauthRedirectPath: string;
}

export function GuestAuthModal({
  open,
  dismissible = true,
  onOpenChange,
  oauthRedirectPath,
}: GuestAuthModalProps) {
  const { sendEmailOtp, verifyEmailOtp, signInWithGoogle } = useGuestAuthActions();
  const captcha = useCaptchaToken({ action: 'auth-email-otp' });
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSigningInWithGoogle, setIsSigningInWithGoogle] = useState(false);

  const resetForm = useCallback(() => {
    setStep('email');
    setEmail('');
    setCode('');
    setError(null);
    setIsSending(false);
    setIsVerifying(false);
    setIsSigningInWithGoogle(false);
  }, []);

  useEffect(() => {
    if (!open) resetForm();
  }, [open, resetForm]);

  const handleContinueEmail = async () => {
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Enter a valid email address');
      return;
    }
    setError(null);
    setIsSending(true);
    const captchaToken = await captcha.ensureToken();
    const otpError = await sendEmailOtp(trimmed, captchaToken);
    captcha.reset();
    setIsSending(false);
    if (otpError) {
      setError(otpError.message);
      return;
    }
    setStep('otp');
  };

  const handleVerifyCode = async () => {
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setError('Enter the code from your email');
      return;
    }
    setError(null);
    setIsVerifying(true);
    const verifyError = await verifyEmailOtp(email, trimmedCode);
    setIsVerifying(false);
    if (verifyError) {
      setError(verifyError.message);
      return;
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsSigningInWithGoogle(true);
    const oauthError = await signInWithGoogle(oauthRedirectPath);
    if (oauthError) {
      setError(oauthError.message);
      setIsSigningInWithGoogle(false);
    }
  };

  const busy = isSending || isVerifying || isSigningInWithGoogle;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !dismissible) return;
    onOpenChange(nextOpen);
  };

  const blockDismiss = (event: Event) => {
    if (dismissible) return;
    event.preventDefault();
  };

  return (
    <ResponsiveModal open={open} onOpenChange={handleOpenChange}>
      <ResponsiveModalContent
        sheetLayout="split"
        showCloseButton={dismissible}
        disableDrag={!dismissible}
        onInteractOutside={blockDismiss}
        onPointerDownOutside={blockDismiss}
        onEscapeKeyDown={blockDismiss}
        className="gap-0 p-0 sm:max-w-[min(calc(100vw-1.5rem),26rem)]"
      >
        <ResponsiveModalHeader className="border-border/60 space-y-4 border-b px-4 pb-4 pt-5 text-center sm:px-5">
          <KameSpaceBrandIcon className="mx-auto h-11 w-11" />
          <ResponsiveModalTitle className="text-center text-lg font-bold sm:text-xl">
            {step === 'email' ? 'Log in or sign up' : 'Confirm your email'}
          </ResponsiveModalTitle>
        </ResponsiveModalHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {step === 'otp' && (
            <button
              type="button"
              onClick={() => {
                setStep('email');
                setCode('');
                setError(null);
              }}
              className="text-muted-foreground hover:text-foreground mb-4 flex min-h-[44px] items-center gap-1.5 text-sm font-medium transition-colors"
            >
              <ArrowLeft className="size-4 shrink-0" aria-hidden />
              Back
            </button>
          )}

          <div className="flex flex-col gap-3">
            <div>
              {step === 'email' ? (
                <>
                  <Label htmlFor="guest-auth-email" className="sr-only">
                    Email
                  </Label>
                  <Input
                    id="guest-auth-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder={FORM_PLACEHOLDERS.email}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    disabled={busy}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'guest-auth-field-error' : undefined}
                    className="rounded-xl text-base"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleContinueEmail();
                    }}
                  />
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-muted-foreground text-center text-sm">{email}</p>
                  <Label htmlFor="guest-auth-code" className="sr-only">
                    Verification code
                  </Label>
                  <Input
                    id="guest-auth-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="Enter code"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      if (error) setError(null);
                    }}
                    disabled={busy}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'guest-auth-field-error' : undefined}
                    className="rounded-xl text-center text-base tracking-widest"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleVerifyCode();
                    }}
                  />
                </div>
              )}
              {error ? (
                <p
                  id="guest-auth-field-error"
                  className="text-destructive mt-1.5 text-sm"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
              {/* Nested in the field group so a collapsed Turnstile does not double flex gap. */}
              {captcha.widget}
            </div>

            <Button
              type="button"
              className="h-12 w-full rounded-xl text-[15px] font-semibold sm:h-11 sm:text-sm"
              disabled={busy}
              onClick={() => void (step === 'email' ? handleContinueEmail() : handleVerifyCode())}
            >
              {isSending || isVerifying ? (
                <SpinnerIcon className="size-5" />
              ) : step === 'email' ? (
                'Continue'
              ) : (
                'Verify'
              )}
            </Button>

            {step === 'email' ? (
              <div className="flex flex-col gap-3 pt-1">
                <AuthDivider text="or" />
                <GoogleSignInButton
                  onClick={() => void handleGoogleSignIn()}
                  disabled={busy}
                  loading={isSigningInWithGoogle}
                />
                <SignInLegalNotice />
              </div>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleContinueEmail()}
                className={cn(
                  'text-muted-foreground hover:text-foreground mx-auto flex min-h-[44px] items-center text-sm font-medium transition-colors',
                  busy && 'pointer-events-none opacity-50'
                )}
              >
                Resend code
              </button>
            )}
          </div>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
