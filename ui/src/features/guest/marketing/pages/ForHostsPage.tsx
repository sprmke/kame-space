import { V5AiWork } from '@/features/guest/marketing/for-hosts/v5/components/V5AiWork';
import { V5AskKame } from '@/features/guest/marketing/for-hosts/v5/components/V5AskKame';
import { V5BookingFees } from '@/features/guest/marketing/for-hosts/v5/components/V5BookingFees';
import { V5Closing } from '@/features/guest/marketing/for-hosts/v5/components/V5Closing';
import { V5Faq } from '@/features/guest/marketing/for-hosts/v5/components/V5Faq';
import { V5Guests } from '@/features/guest/marketing/for-hosts/v5/components/V5Guests';
import { V5Hero } from '@/features/guest/marketing/for-hosts/v5/components/V5Hero';
import { V5Setup } from '@/features/guest/marketing/for-hosts/v5/components/V5Setup';
import { V5Tour } from '@/features/guest/marketing/for-hosts/v5/components/V5Tour';
import { V5WhyDirect } from '@/features/guest/marketing/for-hosts/v5/components/V5WhyDirect';
import { V5Workflow } from '@/features/guest/marketing/for-hosts/v5/components/V5Workflow';

import { usePublicStaticRouteSeo } from '@/lib/seo/routeTitle';

/**
 * Live for-hosts landing. Order follows the hero promise (easy and affordable):
 * 1. the offer; 2. what AI does; 3. channels you already use; 4. one booking path;
 * 5. what guests see; 6. Ask Kame; 7. flat plan savings; 8. tour; 9. setup; 10. FAQ; 11. CTA.
 * Section spacing uses `V5_SECTION_Y`.
 */
export function ForHostsPage() {
  usePublicStaticRouteSeo('/for-hosts');

  return (
    <>
      <V5Hero />
      <V5AiWork />
      <V5WhyDirect />
      <V5Workflow />
      <V5Guests />
      <V5AskKame />
      {/* Trial: swap back to <V5Fees /> (and its import) to restore the plan-picker calculator. */}
      <V5BookingFees />
      <V5Tour />
      <V5Setup />
      <V5Faq />
      <V5Closing />
    </>
  );
}
