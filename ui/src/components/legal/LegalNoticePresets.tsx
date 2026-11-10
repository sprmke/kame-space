import { LegalLink } from '@/components/legal/LegalLink';
import { LegalNotice } from '@/components/legal/LegalNotice';

/**
 * Every in-flow legal line lives here so the same action always reads the same way.
 * Placement rules: `docs/guides/routes/legal.md` § In-app notices.
 */

type PresetProps = { className?: string; align?: 'start' | 'center' };

/** Sign-in and sign-up (host and guest pages, guest auth modal). */
export function SignInLegalNotice({ className, align = 'center' }: PresetProps) {
  return (
    <LegalNotice align={align} className={className}>
      By continuing, you agree to the <LegalLink doc="terms" /> and acknowledge the{' '}
      <LegalLink doc="privacy" />.
    </LegalNotice>
  );
}

/** Last step of the guest booking form, next to Submit. */
export function BookingSubmitLegalNotice({ className, align = 'start' }: PresetProps) {
  return (
    <LegalNotice align={align} className={className}>
      By submitting, you agree to the host&apos;s house rules, our{' '}
      <LegalLink doc="terms" section="bookings" />, and the <LegalLink doc="privacy" />.
    </LegalNotice>
  );
}

/** Booking form payment step, under the receipt upload. */
export function StayPaymentLegalNotice({ className, align = 'start' }: PresetProps) {
  return (
    <LegalNotice align={align} className={className}>
      You pay the host directly. Your receipt is kept private.{' '}
      <LegalLink doc="terms" section="payments">
        Payment terms
      </LegalLink>
    </LegalNotice>
  );
}

/** Parking request form, next to Submit request. */
export function ParkingRequestLegalNotice({ className, align = 'start' }: PresetProps) {
  return (
    <LegalNotice align={align} className={className}>
      By submitting, you agree to the <LegalLink doc="terms" section="parking" /> and the{' '}
      <LegalLink doc="privacy" />.
    </LegalNotice>
  );
}

/** Parking Pay now (PayMongo checkout). */
export function ParkingPaymentLegalNotice({ className, align = 'center' }: PresetProps) {
  return (
    <LegalNotice align={align} className={className}>
      Paid securely through PayMongo. Non-refundable once paid.{' '}
      <LegalLink doc="terms" section="parking">
        Parking terms
      </LegalLink>
    </LegalNotice>
  );
}

/** Plans & Billing review dialog. */
export function PlanBillingLegalNotice({
  kind,
  className,
  align = 'start',
}: PresetProps & { kind: 'checkout' | 'downgrade' }) {
  return (
    <LegalNotice align={align} className={className}>
      {kind === 'checkout'
        ? 'Paid through PayMongo. Renews monthly by payment link. Unused time is not refunded.'
        : 'This applies right away. Unused time is not refunded.'}{' '}
      <LegalLink doc="terms" section="billing">
        Billing terms
      </LegalLink>
    </LegalNotice>
  );
}

/** GCash or bank details for a deposit or cancellation refund. */
export function RefundDetailsLegalNotice({ className, align = 'start' }: PresetProps) {
  return (
    <LegalNotice align={align} className={className}>
      We use these details only to send your refund. <LegalLink doc="privacy" section="payments" />
    </LegalNotice>
  );
}

/** Guest chat with a host (web chat). */
export function GuestChatLegalNotice({ className, align = 'center' }: PresetProps) {
  return (
    <LegalNotice align={align} className={className}>
      Replies may come from an AI assistant. <LegalLink doc="privacy" section="ai" />
    </LegalNotice>
  );
}

/** Guest review and host review of a guest. */
export function ReviewLegalNotice({ className, align = 'start' }: PresetProps) {
  return (
    <LegalNotice align={align} className={className}>
      Keep it honest and leave out contact details.{' '}
      <LegalLink doc="terms" section="reviews">
        Review rules
      </LegalLink>
    </LegalNotice>
  );
}

/** Host Get verified uploads (ID, selfie, ownership proof). */
export function HostVerificationLegalNotice({ className, align = 'start' }: PresetProps) {
  return (
    <LegalNotice align={align} className={className}>
      We use these files only to verify your account and keep them private.{' '}
      <LegalLink doc="privacy" section="identity" />
    </LegalNotice>
  );
}

/** Inbox Meta connect card, shown while Facebook/Instagram are not yet connected. */
export function MetaConnectLegalNotice({ className, align = 'start' }: PresetProps) {
  return (
    <LegalNotice align={align} className={className}>
      Connecting lets us read and reply to this Page&apos;s messages on your behalf.{' '}
      <LegalLink doc="privacy" section="sharing" />
    </LegalNotice>
  );
}

/** Data import wizard, before a host uploads a guest/booking spreadsheet. */
export function DataImportLegalNotice({ className, align = 'start' }: PresetProps) {
  return (
    <LegalNotice align={align} className={className}>
      Only import guest data you are allowed to use for running your stays.{' '}
      <LegalLink doc="terms" section="host-data">
        Host data terms
      </LegalLink>
    </LegalNotice>
  );
}

/** Marketing Studio AI generate/publish actions. */
export function MarketingAiLegalNotice({ className, align = 'start' }: PresetProps) {
  return (
    <LegalNotice align={align} className={className}>
      AI drafts can be wrong. Review before you publish.{' '}
      <LegalLink doc="terms" section="ai">
        AI terms
      </LegalLink>
    </LegalNotice>
  );
}
