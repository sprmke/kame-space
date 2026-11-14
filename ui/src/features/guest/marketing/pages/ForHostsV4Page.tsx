import { V4CapabilitySystem } from '@/features/guest/marketing/for-hosts/v4/components/V4CapabilitySystem';
import { V4ClosingCta } from '@/features/guest/marketing/for-hosts/v4/components/V4ClosingCta';
import { V4Economics } from '@/features/guest/marketing/for-hosts/v4/components/V4Economics';
import { V4Faq } from '@/features/guest/marketing/for-hosts/v4/components/V4Faq';
import { V4GuestExperience } from '@/features/guest/marketing/for-hosts/v4/components/V4GuestExperience';
import { V4Hero } from '@/features/guest/marketing/for-hosts/v4/components/V4Hero';
import { V4OutcomeJourney } from '@/features/guest/marketing/for-hosts/v4/components/V4OutcomeJourney';
import { V4ProofRail } from '@/features/guest/marketing/for-hosts/v4/components/V4ProofRail';
import { V4Tour } from '@/features/guest/marketing/for-hosts/v4/components/V4Tour';

import { usePublicStaticRouteSeo } from '@/lib/seo/routeTitle';

/**
 * Outcome-led `/for-hosts` redesign at `/for-hosts/v4` for side-by-side review. The live route
 * stays unchanged until this direction is approved for promotion.
 */
export function ForHostsV4Page() {
  usePublicStaticRouteSeo('/for-hosts/v4');

  return (
    <>
      <V4Hero />
      <V4ProofRail />
      <V4Economics />
      <V4OutcomeJourney />
      <V4GuestExperience />
      <V4CapabilitySystem />
      <V4Tour />
      <V4Faq />
      <V4ClosingCta />
    </>
  );
}
