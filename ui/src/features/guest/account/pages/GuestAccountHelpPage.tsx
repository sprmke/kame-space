import { useMemo, type ReactNode } from 'react';

import { Link } from 'react-router-dom';

import { HelpCircle, LifeBuoy, MessageCircle } from 'lucide-react';

import { GuestAccountContentCard } from '@/features/guest/account/components/GuestAccountContentCard';
import { GUEST_ACCOUNT_TICKETS_PATH } from '@/features/guest/account/lib/guestAccountPaths';
import { usePublicSupportFaqs } from '@/features/guest/marketing/hooks/usePublicSupportFaqs';
import { isGuestFaq } from '@/features/guest/marketing/lib/publicSupportApi';

import { HelpDisclosure } from '@/features/dashboard/help-support/components/HelpDisclosure';
import { HelpEmptyState } from '@/features/dashboard/help-support/components/HelpEmptyState';
import { HelpRichText } from '@/features/dashboard/help-support/components/HelpRichText';
import { sanitizeHelpBody } from '@/features/dashboard/help-support/lib/helpContentDisplay';

import { BrandEmptyState } from '@/components/branding/BrandEmptyState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';

export function GuestAccountHelpPage() {
  usePageTitle(publicPageTitle('Help'));
  const { data, isPending, isError, refetch } = usePublicSupportFaqs();

  const groups = useMemo(() => {
    const faqs = (data?.faqs ?? []).filter(isGuestFaq);
    const byCategory = new Map<string, typeof faqs>();
    for (const faq of faqs) {
      const list = byCategory.get(faq.category) ?? [];
      list.push(faq);
      byCategory.set(faq.category, list);
    }
    return [...byCategory.entries()];
  }, [data?.faqs]);

  let body: ReactNode;
  if (isPending) {
    body = (
      <div className="space-y-6" aria-busy="true" aria-label="Loading help">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        {[0, 1, 2].map((group) => (
          <div key={group} className="space-y-2.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ))}
      </div>
    );
  } else if (isError) {
    body = (
      <HelpEmptyState
        icon={HelpCircle}
        title="Couldn't load help"
        action={
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => void refetch()}
          >
            Try again
          </Button>
        }
      />
    );
  } else if (groups.length === 0) {
    body = (
      <BrandEmptyState
        compact
        markSize="sm"
        title="No help topics yet"
        description="Contact support if you need a hand with your stay."
      >
        <Button variant="default" className="min-h-11 w-full rounded-full sm:w-auto" asChild>
          <Link to={GUEST_ACCOUNT_TICKETS_PATH}>
            <MessageCircle className="mr-2 size-4" aria-hidden />
            Contact support
          </Link>
        </Button>
      </BrandEmptyState>
    );
  } else {
    body = (
      <div className="space-y-7">
        <header className="space-y-1">
          <h1 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">Help</h1>
          <p className="text-muted-foreground text-sm">Answers for guests using Kame Space.</p>
        </header>
        {groups.map(([category, faqs]) => (
          <section key={category} className="space-y-2">
            <h2 className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
              {category}
            </h2>
            <div className="space-y-2">
              {faqs.map((faq) => (
                <HelpDisclosure key={faq.id} title={faq.question}>
                  <HelpRichText text={sanitizeHelpBody(faq.answer)} />
                </HelpDisclosure>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <GuestAccountContentCard>
      {body}
      {groups.length > 0 || isPending ? (
        <div className="border-border/70 mt-8 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <LifeBuoy className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="text-foreground text-sm font-semibold">Still need help?</p>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Send a ticket and we will reply in your account.
              </p>
            </div>
          </div>
          <Button variant="outline" className="min-h-11 shrink-0 rounded-full" asChild>
            <Link to={GUEST_ACCOUNT_TICKETS_PATH}>Contact support</Link>
          </Button>
        </div>
      ) : null}
    </GuestAccountContentCard>
  );
}
