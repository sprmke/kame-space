import { useReducedMotion } from 'framer-motion';
import {
  BadgeCheck,
  Building2,
  CarFront,
  Megaphone,
  Package,
  UtensilsCrossed,
  Wrench,
} from 'lucide-react';

import { ListingHeroSearch } from '@/features/guest/marketing/shared/components/ListingHeroSearch';

import { BrandEmptyState } from '@/components/branding/BrandEmptyState';
import { usePublicStaticRouteSeo } from '@/lib/seo/routeTitle';
import { cn } from '@/lib/utils';

const servicePreviews = [
  { label: 'Become a property manager', icon: Building2, enterDelay: '', floatDelay: '0s' },
  {
    label: 'Become an agent',
    icon: BadgeCheck,
    enterDelay: 'animation-delay-100',
    floatDelay: '0.6s',
  },
  {
    label: 'Market properties',
    icon: Megaphone,
    enterDelay: 'animation-delay-150',
    floatDelay: '1.2s',
  },
  { label: 'Maintenance', icon: Wrench, enterDelay: 'animation-delay-200', floatDelay: '1.8s' },
  {
    label: 'Food & Essentials',
    icon: UtensilsCrossed,
    enterDelay: 'animation-delay-300',
    floatDelay: '2.4s',
  },
  { label: 'Supplies', icon: Package, enterDelay: 'animation-delay-400', floatDelay: '3s' },
  {
    label: 'Transportation',
    icon: CarFront,
    enterDelay: 'animation-delay-500',
    floatDelay: '3.6s',
  },
] as const;

/**
 * Public `/services` (nav after Parkings). Catalog is not live yet; hero uses the
 * library `coming-soon` mascot pose.
 */
export function ServicesPage() {
  usePublicStaticRouteSeo('/services');
  const reduceMotion = useReducedMotion();

  return (
    <div className="bg-background min-h-screen">
      <section className="border-border bg-background border-b pt-[var(--public-nav-h)]">
        <div className="container mx-auto px-4 py-3 sm:px-6 md:py-5 lg:px-8 lg:py-6">
          <ListingHeroSearch />
        </div>
      </section>

      <div className="relative isolate flex min-h-[28rem] items-center justify-center overflow-hidden px-4 pb-20 pt-12 sm:px-6 md:min-h-[42rem] md:pb-28 md:pt-20 lg:px-8">
        <div className="relative z-10 flex w-full max-w-3xl flex-col items-center text-center">
          <section aria-labelledby="services-title" className="animate-fade-in-up w-full">
            <BrandEmptyState
              mascotPose="coming-soon"
              mascotPriority
              markSize="xl"
              titleAs="h1"
              titleId="services-title"
              eyebrow="Services"
              title="Coming Soon"
              description="Extras for every part of your stay."
              className="py-0 sm:py-0"
            >
              <ul
                className="flex w-full max-w-2xl flex-wrap items-center justify-center gap-2 md:gap-3"
                aria-hidden
              >
                {servicePreviews.map(({ label, icon: Icon, enterDelay, floatDelay }) => (
                  <li key={label} className={cn('animate-fade-in-up opacity-0', enterDelay)}>
                    <span
                      className={cn(
                        'border-border bg-card/90 text-card-foreground inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold shadow-md backdrop-blur sm:px-4 sm:py-2.5 sm:text-sm',
                        !reduceMotion && 'animate-float'
                      )}
                      style={reduceMotion ? undefined : { animationDelay: floatDelay }}
                    >
                      <Icon className="text-primary h-4 w-4 shrink-0" aria-hidden />
                      {label}
                    </span>
                  </li>
                ))}
              </ul>
            </BrandEmptyState>
          </section>
        </div>
      </div>
    </div>
  );
}
