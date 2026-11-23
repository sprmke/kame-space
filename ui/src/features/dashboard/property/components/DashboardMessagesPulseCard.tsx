import { Link } from 'react-router-dom';

import { ArrowRight, MessageSquare } from 'lucide-react';

import { useInboxThreads } from '@/features/dashboard/inbox/hooks/useInbox';
import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Props = {
  className?: string;
};

/**
 * Compact Messages signal for the property home. Uses the same threads query as Inbox.
 */
export function DashboardMessagesPulseCard({ className }: Props) {
  const { org, orgSlug, propertySlug, property } = useOrgContext();
  const inboxHref = propertySectionPath(orgSlug, propertySlug, 'inbox');
  const { data, isLoading } = useInboxThreads(
    orgSlug,
    org?.id ?? null,
    { status: 'all', platform: 'all', search: '' },
    { propertyId: property.id }
  );

  const conversations = data?.pages.flatMap((page) => page.conversations) ?? [];
  const unread = conversations.reduce((sum, row) => sum + (row.unread_count ?? 0), 0);
  const awaitingReply = conversations.filter(
    (row) => row.reply_status === 'pending' && (row.unread_count ?? 0) > 0
  ).length;
  const preview = conversations
    .filter((row) => (row.unread_count ?? 0) > 0 || row.reply_status === 'pending')
    .slice(0, 3);

  return (
    <section
      className={cn(
        'surface-card flex min-h-0 min-w-0 flex-col overflow-hidden p-3 sm:p-4',
        className
      )}
      aria-label="Messages"
    >
      <AdminSurfaceCardHeader
        icon={MessageSquare}
        title="Messages"
        description="Guest inbox"
        iconClassName="bg-muted/80"
        action={
          <Link
            to={inboxHref}
            className="text-primary hover:bg-primary/10 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold transition-colors"
          >
            View
            <ArrowRight className="size-4 shrink-0" aria-hidden />
          </Link>
        }
      />

      {isLoading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading messages">
          <Skeleton className="h-8 w-28 rounded-full" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tabular-nums',
                unread > 0
                  ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200'
                  : 'border-border/60 bg-muted/40 text-foreground'
              )}
            >
              {unread} unread
            </span>
            {awaitingReply > 0 ? (
              <span className="border-border/60 bg-muted/40 text-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tabular-nums">
                {awaitingReply} awaiting reply
              </span>
            ) : null}
          </div>

          {preview.length === 0 ? (
            <div className="border-border/60 flex flex-1 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-6 text-center">
              <MessageSquare className="text-muted-foreground/70 size-6" aria-hidden />
              <p className="text-foreground text-sm font-semibold">Inbox clear</p>
            </div>
          ) : (
            <ul className="border-border/50 divide-border/50 divide-y overflow-hidden rounded-xl border">
              {preview.map((row) => (
                <li key={row.id}>
                  <Link
                    to={`${inboxHref}?c=${encodeURIComponent(row.id)}`}
                    className="hover:bg-muted/35 group flex min-h-11 items-center gap-2 px-3 py-2 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate text-sm font-medium">
                        {row.participant_name || row.subject_preview || 'Guest'}
                      </p>
                      {row.subject_preview ? (
                        <p className="text-muted-foreground mt-0.5 truncate text-[11px] leading-snug">
                          {row.subject_preview}
                        </p>
                      ) : null}
                    </div>
                    {(row.unread_count ?? 0) > 0 ? (
                      <span className="bg-primary-strong text-primary-foreground shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums">
                        {row.unread_count}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
