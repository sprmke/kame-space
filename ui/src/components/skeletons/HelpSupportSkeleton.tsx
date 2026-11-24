import { useLocation } from 'react-router-dom';

import { useSupportTicketScope } from '@/features/dashboard/help-support/hooks/useSupportTicketScope';
import {
  isHelpSupportTicketDetailPath,
  type HelpSupportSection,
} from '@/features/dashboard/help-support/lib/helpSupportPaths';
import {
  readTicketsWorkspaceLayoutHint,
  ticketsWorkspaceLayoutStorageKey,
} from '@/features/dashboard/help-support/lib/ticketsWorkspaceLayout';

import { TicketsWorkspaceSkeleton } from '@/components/skeletons/TicketsWorkspaceSkeleton';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Help documentation topic list (icon + title + description rows). */
export function HelpDocumentationTopicsSkeleton() {
  return (
    <div role="status" className="space-y-3" aria-busy="true" aria-label="Loading guides">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="border-border/50 flex items-start gap-3 rounded-xl border p-4"
          style={{ opacity: 1 - i * 0.08 }}
        >
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="h-3 w-full max-w-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** `HelpSupportModuleNav`: four StatCard tiles, 2×2 below xl. */
function HelpSupportModuleNavSkeleton() {
  return (
    <div
      className={cn(
        'flex flex-wrap justify-center gap-3 xl:gap-4',
        '[&>*]:min-w-[9.25rem] [&>*]:max-w-[calc((100%-0.75rem)/2)] [&>*]:flex-[1_1_calc((100%-0.75rem)/2)]',
        'xl:[&>*]:min-w-0 xl:[&>*]:max-w-[calc((100%-3rem)/4)] xl:[&>*]:flex-[1_1_calc((100%-3rem)/4)]'
      )}
      aria-hidden
    >
      {[
        { title: 'FAQs', value: 'Common Q&As' },
        { title: 'Guides', value: 'How each page works' },
        { title: 'Tickets', value: 'Write to our team' },
        { title: 'Ask AI', value: 'Answers from your data' },
      ].map((card) => (
        <div key={card.title} className="surface-card h-full p-3 sm:p-3.5 md:p-4">
          <div className="flex items-start justify-between gap-2.5 sm:gap-3">
            <div className="min-w-0 flex-1 space-y-1.5 sm:space-y-2">
              <p className="text-muted-foreground text-xs font-medium sm:text-sm">{card.title}</p>
              <div className="min-h-[2.5rem] sm:min-h-[2.75rem]">
                <p className="text-foreground truncate text-sm font-semibold sm:text-base">
                  {card.value}
                </p>
              </div>
            </div>
            <Skeleton className="hidden size-8 shrink-0 rounded-lg sm:size-10 sm:rounded-xl lg:block" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TicketsSectionRouteSkeleton() {
  const location = useLocation();
  const scope = useSupportTicketScope();
  const hint = readTicketsWorkspaceLayoutHint(
    ticketsWorkspaceLayoutStorageKey([
      scope.channel ?? 'host',
      scope.orgSlug,
      scope.orgId,
      scope.propertyId,
      scope.parkingId,
    ])
  );
  // A deep link to one ticket opens the two-pane workspace, not the empty chrome.
  const layout = isHelpSupportTicketDetailPath(location.pathname) ? 'list' : (hint ?? 'empty');

  return <TicketsWorkspaceSkeleton layout={layout} />;
}

/** Content under the section intro: FAQ / guide rows in a card, or the tickets workspace. */
/** Landing body parity: optional search field + 2-up topic tiles. */
export function HelpTopicGridSkeleton({ withSearch = false }: { withSearch?: boolean }) {
  return (
    <div className="p-4 sm:p-5">
      {withSearch ? <Skeleton className="h-11 w-full rounded-md" /> : null}
      <div
        className={cn('bg-border/70 grid grid-cols-1 gap-px sm:grid-cols-2', withSearch && 'mt-4')}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-card flex min-h-[7.5rem] flex-col items-center justify-center gap-2 px-4 py-5 sm:min-h-[8.5rem]"
            style={{ opacity: 1 - i * 0.08 }}
          >
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="h-4 w-32 max-w-full" />
            <Skeleton className="h-3 w-20 max-w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function HelpSupportSectionSkeleton({ section }: { section: HelpSupportSection }) {
  if (section === 'tickets') {
    return <TicketsSectionRouteSkeleton />;
  }

  return (
    <Card
      className="overflow-hidden"
      aria-busy="true"
      aria-label={section === 'guides' ? 'Loading guides' : 'Loading FAQs'}
    >
      <HelpTopicGridSkeleton withSearch={section === 'faqs'} />
    </Card>
  );
}

const SECTION_INTRO = {
  faqs: {
    title: 'FAQs',
    description: 'Short answers to the questions hosts ask most.',
  },
  guides: {
    title: 'Guides',
    description: 'Walkthroughs for each page in the dashboard.',
  },
  tickets: {
    title: 'Tickets',
    description: 'Send a request to our team and track replies here.',
  },
} as const;

/** Help & Support body: module nav, centered section intro, then section content. */
export function HelpSupportPageSkeleton({ section }: { section: HelpSupportSection }) {
  const intro = SECTION_INTRO[section];

  return (
    <div className="flex min-w-0 flex-col gap-5 sm:gap-6">
      <HelpSupportModuleNavSkeleton />
      <div className="flex min-w-0 flex-col gap-3 sm:gap-4">
        <div className="flex flex-col items-center gap-1.5 px-1" aria-hidden>
          <h2 className="text-section-title text-center">{intro.title}</h2>
          <p className="text-muted-foreground max-w-full text-center text-sm sm:text-base">
            {intro.description}
          </p>
        </div>
        <HelpSupportSectionSkeleton section={section} />
      </div>
    </div>
  );
}
