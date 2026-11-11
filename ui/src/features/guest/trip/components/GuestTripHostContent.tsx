import { ChevronDown } from 'lucide-react';

import { GuestTripSection } from '@/features/guest/trip/components/GuestTripSection';
import { sanitizeRichTextHtml } from '@/lib/sanitizeHtml';
import { cn } from '@/lib/utils';

/** Host-authored HTML, sanitized. Used for check-in steps and "From your host" chapters. */
function HostHtml({ html, className }: { html: string; className?: string }) {
  if (!html.trim()) return null;
  return (
    <div
      className={cn(
        'text-muted-foreground [&_a]:text-primary space-y-2 text-sm leading-relaxed',
        '[&_h2]:text-foreground [&_h3]:text-foreground [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold',
        '[&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-semibold',
        '[&_li]:ml-4 [&_li]:list-disc [&_ol_li]:list-decimal',
        '[&_p]:m-0 [&_ul]:space-y-1 [&_ol]:space-y-1',
        className
      )}
      // Host content from the property template editor, sanitized like the stay guide.
      dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(html) }}
    />
  );
}

/**
 * Check-in and check-out steps, inline on the trip page.
 *
 * The stay guide is Pro+, but arrival steps are operational: a guest on any plan needs to
 * know how to get in (plan D6). Shows once the booking is confirmed.
 */
export function GuestTripStepsSection({
  checkInHtml,
  checkOutHtml,
  showCheckOut,
}: {
  checkInHtml: string | null;
  checkOutHtml: string | null;
  /** Check-out steps only matter near the end of the stay. */
  showCheckOut: boolean;
}) {
  const showCheckOutBlock = showCheckOut && Boolean(checkOutHtml);
  const showCheckInBlock = Boolean(checkInHtml);
  if (!checkInHtml && !showCheckOutBlock) return null;

  // "Getting in" next to the page's "Getting there" section read as two names for one thing.
  const title =
    showCheckInBlock && showCheckOutBlock
      ? 'Check-in and check-out'
      : showCheckOutBlock
        ? 'Check-out steps'
        : 'Check-in steps';

  return (
    <GuestTripSection id="trip-steps" title={title}>
      {checkInHtml ? (
        <div className="space-y-2">
          <p className="text-foreground text-sm font-semibold">Check-in</p>
          <HostHtml html={checkInHtml} />
        </div>
      ) : null}
      {showCheckOutBlock && checkOutHtml ? (
        <div className="mt-4 space-y-2">
          <p className="text-foreground text-sm font-semibold">Check-out</p>
          <HostHtml html={checkOutHtml} />
        </div>
      ) : null}
    </GuestTripSection>
  );
}

/**
 * "From your host": custom templates the host marked guest-visible.
 *
 * Collapsed by default so a long house guide does not push the arrival details off the
 * first screen (plan 3.6 / D8).
 */
export function GuestTripHostSections({
  sections,
}: {
  sections: Array<{ id: string; name: string; html: string }>;
}) {
  if (sections.length === 0) return null;

  return (
    <GuestTripSection id="trip-from-host" title="From your host">
      <div className="border-border/60 divide-border/60 divide-y rounded-xl border">
        {sections.map((section) => (
          <details key={section.id} className="group">
            <summary className="hover:bg-muted/50 flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-medium transition-colors [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 truncate">{section.name}</span>
              <ChevronDown
                className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <div className="px-3 pb-3">
              <HostHtml html={section.html} />
            </div>
          </details>
        ))}
      </div>
    </GuestTripSection>
  );
}
