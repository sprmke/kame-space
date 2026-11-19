/**
 * test: N/A — copy-only module. Every `*HelpCopy.ts` file is scanned by
 * `ui/src/lib/help/helpCopy.test.ts`.
 */
import { Banknote, CircleDollarSign, Users } from 'lucide-react';

import type { HelpCopyModule, HowItWorksCopy } from '@/lib/help/types';

/**
 * Parking pricing — "How payouts work" panel. Keeps the host rate, the guest service fee and the
 * platform fee in one place instead of burying them in field helper text.
 */
export const PARKING_PAYOUTS_HOW_IT_WORKS: HowItWorksCopy = {
  title: 'How parking payouts work',
  steps: [
    {
      icon: CircleDollarSign,
      title: 'Set your rate',
      body: 'Choose the nightly price guests see. The minimum is ₱100.',
    },
    {
      icon: Users,
      title: 'Guests pay your rate plus a fee',
      body: 'Guests pay your rate and a small service fee at checkout. The service fee never comes out of your payout.',
    },
    {
      icon: Banknote,
      title: 'Get paid per booking',
      body: 'We take the platform fee from your rate, then send your payout after the guest pays.',
    },
  ],
  tip: 'Direct-link bookings use a lower fee. Payouts are sent manually for now.',
};

/**
 * Pricing summary cards. Weekend premium is the difference between the
 * weekend and base rate; custom dates are date overrides; fixed fees are the
 * fees enabled for the listing.
 */
export const PRICING_HELP_COPY = {
  weekendPremium: {
    hint: 'How much more a weekend night costs than the base rate.',
  },
  customDates: {
    hint: 'Nights with a price you set for a specific date. They override the base and weekend rates.',
  },
  fixedFees: {
    hint: 'The fees turned on for this property, charged on top of the nightly rate.',
  },
  smartPricingNights: {
    hint: 'Nights in this view that Smart Pricing currently prices.',
  },
  parkingWeekendPremium: {
    hint: 'How much more a weekend slot costs than the base rate.',
  },
  parkingCustomDates: {
    hint: 'Nights with a price you set for a specific date. They override the base and weekend rates.',
  },
  parkingBlockedNights: {
    hint: 'Nights you closed so guests cannot book them. Blocked nights stay out of marketplace matching.',
  },
  parkingPayout: {
    hint: 'The price guests see, the platform fee, and the amount you receive per night.',
  },
  parkingDirectLink: {
    hint: 'Share this link with guests you find yourself. Those bookings use a lower platform fee.',
  },
} satisfies HelpCopyModule;
