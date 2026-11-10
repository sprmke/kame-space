import { LegalLink } from '@/components/legal/LegalLink';
import { PLATFORM_CONTACT_EMAIL } from '@/lib/platformBranding';

const PRIVACY_REQUEST_MAILTO = `mailto:${PLATFORM_CONTACT_EMAIL}?subject=${encodeURIComponent('Privacy request')}`;

/** Guest profile: where to read the policies and how to ask for a copy or deletion of their data. */
export function GuestPrivacyCard() {
  return (
    <div className="border-border space-y-1.5 rounded-xl border p-4">
      <p className="text-sm font-semibold">Privacy and data</p>
      <p className="text-muted-foreground text-sm">
        Read the <LegalLink doc="privacy" /> and <LegalLink doc="terms" />.
      </p>
      <a
        href={PRIVACY_REQUEST_MAILTO}
        className="text-primary focus-visible:ring-ring inline-flex min-h-[44px] items-center rounded-sm text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2"
      >
        Request a copy or deletion of your data
      </a>
    </div>
  );
}
