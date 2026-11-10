import { useEffect, type ReactNode } from 'react';

import { useLocation } from 'react-router-dom';

import { MarketingPublicPageContent } from '@/features/guest/marketing/shared/components/MarketingPublicPageContent';
import { MarketingPublicPageHero } from '@/features/guest/marketing/shared/components/MarketingPublicPageHero';

import { LegalDocumentBody } from '@/components/legal/LegalDocumentBody';
import type { LegalDocument } from '@/lib/legal/legalMeta';

interface LegalSimplePageProps {
  document: LegalDocument;
  eyebrow?: string;
  blobPosition?: 'left' | 'right';
  /** Extra content after the policy sections, e.g. the Cookie Policy's preferences control. */
  afterContent?: ReactNode;
}

export function LegalSimplePage({
  document: policy,
  eyebrow = 'Legal',
  blobPosition = 'left',
  afterContent,
}: LegalSimplePageProps) {
  const { hash } = useLocation();

  // React Router does not scroll to `#section` on its own (deep links from in-app notices).
  useEffect(() => {
    if (!hash) return;
    const frame = window.requestAnimationFrame(() => {
      window.document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({
        block: 'start',
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hash]);

  return (
    <div className="bg-background min-h-screen">
      <MarketingPublicPageHero
        eyebrow={eyebrow}
        title={policy.title}
        description={policy.description}
        blobPosition={blobPosition}
        narrow
      />

      <MarketingPublicPageContent narrow>
        <LegalDocumentBody sections={policy.sections} />
        {afterContent}
      </MarketingPublicPageContent>
    </div>
  );
}
