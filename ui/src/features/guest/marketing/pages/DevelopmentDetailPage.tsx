import { Navigate, useParams } from 'react-router-dom';

import {
  DevelopmentHero,
  DevelopmentAmenities,
  DevelopmentAvailableSection,
} from '@/features/guest/marketing/developments/components';
import { usePublicDevelopment } from '@/features/guest/marketing/developments/hooks/usePublicDevelopment';
import { ListingLoadError } from '@/features/guest/marketing/shared/components/ListingLoadError';

import { DevelopmentDetailPageSkeleton } from '@/components/skeletons/GuestMarketingSkeleton';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';
import { absoluteCanonicalUrl, siteOrigin } from '@/lib/seo/canonicalOrigin';
import {
  buildBreadcrumbJsonLdFromItems,
  buildDevelopmentJsonLd,
  buildPageTitle,
  combineJsonLd,
  developmentTitle,
  listingDescription,
} from '@/lib/seo/seoMeta';
import { usePageMeta } from '@/lib/seo/usePageMeta';
import { ListingBreadcrumbs } from '@/features/guest/marketing/shared/components/ListingBreadcrumbs';

export function DevelopmentDetailPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const developmentResult = usePublicDevelopment(slug);
  const { data: development, isLoading, isError } = developmentResult;
  const developmentPageTitle = development
    ? buildPageTitle(
        developmentTitle({ name: development.name, city: development.city ?? development.location })
      )
    : publicPageTitle('Development');
  usePageTitle(developmentPageTitle);

  const developmentDescription = development
    ? listingDescription({
        name: development.name,
        city: development.city ?? development.location,
        hostDescription: development.description,
      })
    : undefined;

  const canonicalPath = `/developments/${development?.slug ?? slug}`;
  const breadcrumbItems = development
    ? [
        { label: 'Home', to: '/' },
        { label: 'Developments', to: '/developments' },
        { label: development.name },
      ]
    : [];
  usePageMeta(
    {
      title: developmentPageTitle,
      description: developmentDescription ?? null,
      canonicalPath,
      image: development?.coverImage || null,
      jsonLd: development
        ? combineJsonLd([
            buildDevelopmentJsonLd({
              name: development.name,
              url: absoluteCanonicalUrl(canonicalPath),
              description: development.description,
              image: development.coverImage || null,
              city: development.city,
            }),
            buildBreadcrumbJsonLdFromItems(breadcrumbItems, siteOrigin()),
          ])
        : null,
    },
    Boolean(development)
  );

  if (isLoading) {
    return (
      <div className="bg-background min-h-screen">
        <DevelopmentDetailPageSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-background public-page-top min-h-screen">
        <ListingLoadError
          noun="this development"
          retrying={developmentResult.isFetching}
          onRetry={() => void developmentResult.refetch()}
        />
      </div>
    );
  }

  if (!development) {
    return <Navigate to="/developments" replace />;
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="public-page-top @xl:px-6 @5xl:px-8 container mx-auto px-4 pb-0">
        <ListingBreadcrumbs items={breadcrumbItems} />
      </div>
      <DevelopmentHero development={development} />
      <DevelopmentAmenities development={development} />
      <DevelopmentAvailableSection development={development} />
    </div>
  );
}
