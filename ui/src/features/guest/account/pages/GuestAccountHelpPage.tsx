import { useMemo, useState, type ReactNode } from 'react';

import { Link } from 'react-router-dom';

import { HelpCircle, LifeBuoy, MessageCircle, RefreshCw, Search } from 'lucide-react';

import { GuestAccountContentCard } from '@/features/guest/account/components/GuestAccountContentCard';
import { GUEST_ACCOUNT_TICKETS_PATH } from '@/features/guest/account/lib/guestAccountPaths';
import { resolveGuestHelpFaqs } from '@/features/guest/account/lib/guestHelpFaqs';
import { usePublicSupportFaqs } from '@/features/guest/marketing/hooks/usePublicSupportFaqs';
import {
  isGuestFaq,
  type PublicSupportFaq,
} from '@/features/guest/marketing/lib/publicSupportApi';

import { HelpBackControl } from '@/features/dashboard/help-support/components/HelpBackControl';
import { HelpDisclosure } from '@/features/dashboard/help-support/components/HelpDisclosure';
import { HelpEmptyState } from '@/features/dashboard/help-support/components/HelpEmptyState';
import { HelpRichText } from '@/features/dashboard/help-support/components/HelpRichText';
import { HelpSearchField } from '@/features/dashboard/help-support/components/HelpSearchField';
import {
  HelpTopicList,
  HelpTopicRow,
} from '@/features/dashboard/help-support/components/HelpTopicList';
import { sanitizeHelpBody } from '@/features/dashboard/help-support/lib/helpContentDisplay';

import { KameMascotImage } from '@/components/branding/KameMascotImage';
import { GuestAccountHelpPageSkeleton } from '@/components/skeletons/GuestAccountSkeletons';
import { Button } from '@/components/ui/button';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';

function matchesTerm(faq: PublicSupportFaq, term: string): boolean {
  if (!term) return true;
  const needle = term.toLowerCase();
  return (
    faq.question.toLowerCase().includes(needle) ||
    faq.answer.toLowerCase().includes(needle) ||
    faq.category.toLowerCase().includes(needle)
  );
}

export function GuestAccountHelpPage() {
  usePageTitle(publicPageTitle('Help'));
  const { data, isPending, isError, refetch } = usePublicSupportFaqs();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const faqs = useMemo(
    () => resolveGuestHelpFaqs((data?.faqs ?? []).filter(isGuestFaq)),
    [data?.faqs]
  );

  const categories = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const faq of faqs) {
      if (!seen.has(faq.category)) {
        seen.add(faq.category);
        ordered.push(faq.category);
      }
    }
    return ordered;
  }, [faqs]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const faq of faqs) {
      map.set(faq.category, (map.get(faq.category) ?? 0) + 1);
    }
    return map;
  }, [faqs]);

  const term = search.trim();
  const browseResults = useMemo(() => {
    return faqs.filter((faq) => {
      if (selectedCategory && faq.category !== selectedCategory) return false;
      return matchesTerm(faq, term);
    });
  }, [faqs, selectedCategory, term]);

  const openCategory = (category: string) => {
    setSearch('');
    setSelectedCategory(category);
  };

  const closeCategory = () => {
    setSearch('');
    setSelectedCategory(null);
  };

  const showHomeIntro = !selectedCategory && !term;

  const mascotHeader = (
    <div className="flex flex-col items-center px-4 pt-6 text-center sm:px-5 sm:pt-8">
      <div className="motion-safe:animate-float relative w-28 sm:w-32" aria-hidden>
        <KameMascotImage pose="help-support" />
      </div>
      {showHomeIntro ? (
        <div className="mt-4 max-w-sm space-y-1.5">
          <h1 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">Help</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Answers about trips, messages, vouchers, etc.
          </p>
        </div>
      ) : null}
    </div>
  );

  const contactFooter = (
    <div className="border-border/70 flex flex-col gap-3 border-t px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex items-start gap-2.5">
        <LifeBuoy className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="text-foreground text-sm font-semibold">Still need help?</p>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Send a ticket and we will reply in your account.
          </p>
        </div>
      </div>
      <Button variant="outline" className="min-h-11 shrink-0 gap-2 rounded-full px-5" asChild>
        <Link to={GUEST_ACCOUNT_TICKETS_PATH}>
          <MessageCircle className="size-4 shrink-0" aria-hidden />
          Contact support
        </Link>
      </Button>
    </div>
  );

  let body: ReactNode;
  if (isPending) {
    body = <GuestAccountHelpPageSkeleton />;
  } else if (isError) {
    body = (
      <HelpEmptyState
        icon={HelpCircle}
        title="Couldn't load help"
        description="Check your connection and try again."
        action={
          <Button
            type="button"
            className="min-h-11 gap-2 rounded-full px-5"
            onClick={() => void refetch()}
          >
            <RefreshCw className="size-4 shrink-0" aria-hidden />
            Try again
          </Button>
        }
      />
    );
  } else if (selectedCategory || term) {
    body = (
      <div className="pb-1">
        {mascotHeader}
        <div className="px-4 pt-4 sm:px-5">
          <div className="relative flex min-h-11 items-center">
            {selectedCategory ? (
              <div className="absolute inset-y-0 left-0 z-10 flex items-center">
                <HelpBackControl label="All topics" onClick={closeCategory} />
              </div>
            ) : null}
            <h2 className="text-foreground w-full px-12 text-center text-lg font-semibold tracking-tight sm:px-28 sm:text-xl">
              {selectedCategory ?? 'Search'}
            </h2>
          </div>
          <div className="mt-4">
            <HelpSearchField
              value={search}
              onChange={setSearch}
              placeholder={selectedCategory ? 'Search this topic' : 'Search help'}
              label={selectedCategory ? `Search ${selectedCategory}` : 'Search help'}
            />
          </div>
        </div>
        <div className="mt-3 px-4 sm:px-5">
          {browseResults.length === 0 ? (
            <HelpEmptyState
              icon={term ? Search : HelpCircle}
              title={term ? 'No answers match that search' : 'No answers in this topic yet'}
              compact
            />
          ) : (
            browseResults.map((faq) => (
              <HelpDisclosure key={faq.id} title={faq.question}>
                <HelpRichText text={sanitizeHelpBody(faq.answer)} />
              </HelpDisclosure>
            ))
          )}
        </div>
      </div>
    );
  } else {
    body = (
      <div className="pb-1">
        {mascotHeader}
        <div className="px-4 pt-4 sm:px-5">
          <HelpSearchField
            value={search}
            onChange={setSearch}
            placeholder="Search help"
            label="Search help"
          />
        </div>
        <div className="mt-4">
          <HelpTopicList>
            {categories.map((category) => {
              const count = counts.get(category) ?? 0;
              return (
                <HelpTopicRow
                  key={category}
                  title={category}
                  description={`${count} ${count === 1 ? 'question' : 'questions'}`}
                  Icon={HelpCircle}
                  onClick={() => openCategory(category)}
                />
              );
            })}
          </HelpTopicList>
        </div>
      </div>
    );
  }

  return (
    <GuestAccountContentCard bodyClassName="p-0">
      {body}
      {/* Help skeleton already includes the contact footer chrome. */}
      {!isPending && !isError ? contactFooter : null}
    </GuestAccountContentCard>
  );
}
