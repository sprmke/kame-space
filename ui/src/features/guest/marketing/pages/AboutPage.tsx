import { Link } from 'react-router-dom';

import {
  Building2,
  CalendarCheck2,
  CarFront,
  Inbox,
  MapPin,
  Megaphone,
  ShieldCheck,
} from 'lucide-react';

import { MarketingPublicCallout } from '@/features/guest/marketing/shared/components/MarketingPublicCallout';
import { MarketingPublicIconCard } from '@/features/guest/marketing/shared/components/MarketingPublicIconCard';
import { MarketingPublicPageContent } from '@/features/guest/marketing/shared/components/MarketingPublicPageContent';
import { MarketingPublicPageHero } from '@/features/guest/marketing/shared/components/MarketingPublicPageHero';
import { MarketingPublicSectionHeading } from '@/features/guest/marketing/shared/components/MarketingPublicSectionHeading';

import { Button } from '@/components/ui/button';
import { usePublicRouteTitle } from '@/lib/pageTitle';
import { PLATFORM_APP_NAME, PLATFORM_CONTACT_EMAIL } from '@/lib/platformBranding';
import { STATIC_PAGE_COPY } from '@/lib/seo/content/staticPageCopy';
import { usePageMeta } from '@/lib/seo/usePageMeta';

const capabilities = [
  {
    icon: CalendarCheck2,
    title: 'Booking workflow',
    body: 'Guests submit stay details. You move each booking from review through documents, check-in, check-out, and security-deposit refund.',
  },
  {
    icon: Building2,
    title: 'Organizations & properties',
    body: 'Run multiple listings with team roles and permission-scoped dashboards, without splitting tools across spreadsheets.',
  },
  {
    icon: CarFront,
    title: 'Parking',
    body: 'Parking listings and guest flows sit beside homes, not buried as a property add-on.',
  },
  {
    icon: Inbox,
    title: 'Guest messaging',
    body: 'Meta and web chat in one inbox, with AI reply suggestions when you need to respond quickly.',
  },
  {
    icon: Megaphone,
    title: 'Marketing studio',
    body: 'Draft content and publish to Meta from the same workspace you use to operate stays.',
  },
  {
    icon: ShieldCheck,
    title: 'Document review',
    body: 'IDs, receipts, and stay papers go through structured review, including AI checks where you enable them.',
  },
] as const;

export function AboutPage() {
  usePublicRouteTitle('/about');
  usePageMeta({});
  return (
    <div className="bg-background min-h-screen">
      <MarketingPublicPageHero
        eyebrow="About"
        title={STATIC_PAGE_COPY.about.heading}
        description={STATIC_PAGE_COPY.about.intro}
        blobPosition="right"
      >
        <div className="flex flex-wrap items-center justify-center gap-2.5 md:gap-3">
          <Button
            size="lg"
            className="bg-primary-strong hover:bg-primary/90 h-11 rounded-full px-5 text-[15px] font-semibold text-white md:h-12 md:px-8 md:text-base"
            asChild
          >
            <Link to="/for-hosts">Become a host</Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-11 rounded-full px-5 text-[15px] md:h-12 md:px-8 md:text-base"
            asChild
          >
            <Link to="/properties">Browse stays</Link>
          </Button>
        </div>
      </MarketingPublicPageHero>

      <MarketingPublicPageContent>
        <MarketingPublicSectionHeading
          title="What the platform covers"
          description="Guests book through property calendars and forms. Hosts and teams run each stay through a status workflow with email automation where configured."
          className="mx-auto max-w-3xl"
        />

        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:mt-12 md:gap-6 lg:grid-cols-3">
          {capabilities.map(({ icon, title, body }) => (
            <li key={title}>
              <MarketingPublicIconCard icon={icon} title={title} body={body} />
            </li>
          ))}
        </ul>
      </MarketingPublicPageContent>

      <MarketingPublicCallout
        variant="band"
        icon={MapPin}
        title="Based in Manila"
        body={
          <>
            {PLATFORM_APP_NAME
              ? `${PLATFORM_APP_NAME} is built and operated from Manila, Philippines.`
              : 'Built and operated from Manila, Philippines.'}{' '}
            For product questions, host onboarding, or guest stay issues, email{' '}
            <a
              href={`mailto:${PLATFORM_CONTACT_EMAIL}`}
              className="text-brand-ink font-medium hover:underline"
            >
              {PLATFORM_CONTACT_EMAIL}
            </a>{' '}
            or use{' '}
            <Link to="/contact" className="text-brand-ink font-medium hover:underline">
              Contact
            </Link>
            .
          </>
        }
      />
    </div>
  );
}
