import { Link, useLocation, useNavigate } from 'react-router-dom';

import { ArrowLeft, Compass } from 'lucide-react';

import { BrandEmptyState } from '@/components/branding/BrandEmptyState';
import { Button } from '@/components/ui/button';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';
import { usePageMeta } from '@/lib/seo/usePageMeta';

/** App-wide catch-all — matched when no other route claims the path. */
export function NotFoundPage() {
  usePageTitle(publicPageTitle('Page not found'));
  usePageMeta({ description: 'This page does not exist.', noindex: true });
  const navigate = useNavigate();
  const location = useLocation();
  const canGoBack = location.key !== 'default';

  return (
    <section className="border-border relative overflow-hidden border-b">
      <div className="container relative mx-auto flex min-h-[70vh] flex-col items-center justify-center px-4 py-16 sm:px-6 sm:py-24">
        <BrandEmptyState
          markSize="lg"
          titleAs="h1"
          eyebrow="Error 404"
          title="This page wandered off"
          description="We couldn't find the page you're looking for."
          className="w-full max-w-lg py-0 sm:py-0"
        >
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            {canGoBack ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-12 gap-2"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="h-4 w-4" />
                Go back
              </Button>
            ) : null}
            <Button asChild size="lg" className="h-12 gap-2">
              <Link to="/">
                <Compass className="h-4 w-4" />
                Take me home
              </Link>
            </Button>
          </div>
        </BrandEmptyState>
      </div>
    </section>
  );
}
