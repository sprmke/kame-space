import {
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
  type ReactElement,
} from 'react';

import {
  CalendarOff,
  CalendarPlus,
  CalendarRange,
  Check,
  Copy,
  Loader2,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { FeatureAvailabilityButton } from '@/components/feature-availability/FeatureAvailabilityButton';
import { FeatureUnavailableNotice } from '@/components/feature-availability/FeatureUnavailableNotice';
import { FeatureUnavailablePanel } from '@/components/feature-availability/FeatureUnavailablePanel';
import { TierBadge, TierBadgeAnchor } from '@/features/dashboard/plans/components/TierBadge';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';
import {
  useAddCalendarFeed,
  useCalendarSyncSettings,
  useRemoveCalendarFeed,
  useSetExportEnabled,
  useSetCreateBookings,
  useSyncFeedNow,
} from '@/features/dashboard/pricing/hooks/useCalendarSync';
import {
  buildCalendarSyncActivityRows,
  type CalendarSyncActivityTone,
} from '@/features/dashboard/pricing/lib/calendarSyncActivity';
import {
  CALENDAR_PROVIDER_LABELS,
  validateAirbnbCalendarUrl,
  type CalendarSyncFeed,
} from '@/features/dashboard/pricing/lib/calendarSyncApi';

import { FieldLabel } from '@/components/forms/FieldLabel';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toastFeatureUnavailable } from '@/lib/featureAvailability/featureUnavailableError';
import { useFeatureAvailability } from '@/lib/featureAvailability/useFeatureAvailability';
import { cn } from '@/lib/utils';
import { formatRelative } from '@/utils/format/bookingDisplay';

function feedHealthBadge(feed: CalendarSyncFeed): {
  label: string;
  variant: 'secondary' | 'outline' | 'destructive';
} {
  if (feed.health === 'error') return { label: 'Needs fix', variant: 'destructive' };
  if (feed.health === 'warning') return { label: 'Retrying', variant: 'outline' };
  if (feed.lastSuccessAt) return { label: 'Synced', variant: 'secondary' };
  return { label: 'Connected', variant: 'outline' };
}

function ChannelSyncBodySkeleton() {
  return (
    <div className="space-y-5" role="status" aria-live="polite" aria-label="Loading channel sync">
      <div
        className="bg-muted grid h-10 w-full grid-cols-2 gap-1 rounded-lg p-1 max-lg:h-9"
        aria-hidden
      >
        <Skeleton className="bg-background h-full rounded-md" />
        <Skeleton className="h-full rounded-md" />
      </div>
      <div className="divide-border divide-y overflow-hidden rounded-xl border" aria-hidden>
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-start gap-2 p-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="size-11 shrink-0 rounded-md" />
          </div>
        ))}
      </div>
      <Skeleton className="min-h-[44px] w-full rounded-lg" aria-hidden />
    </div>
  );
}

const FROM_AIRBNB_URL_HELP =
  'In Airbnb: open the listing Calendar → Availability → Connect calendars → Export calendar. Copy the link (starts with airbnb.com/calendar/ical/) and paste it here so those booked dates block here.';

const SHARE_WITH_AIRBNB_HELP =
  'Turns on a private calendar link for this property. Airbnb can then import your booked and blocked dates from our app.';

const PASTE_INTO_AIRBNB_HELP =
  'In Airbnb: listing Calendar → Availability → Connect calendars → Import calendar. Paste this link, name it, and save. Airbnb refreshes every few hours.';

const CREATE_BOOKINGS_HELP =
  'When on, each Airbnb reservation becomes a Pending review booking. Dates still block either way.';

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 min-w-[44px] shrink-0 gap-1.5"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error('Could not copy');
        }
      }}
    >
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
      <span className="sr-only">{label}</span>
    </Button>
  );
}

const ACTIVITY_TONE_CLASS: Record<CalendarSyncActivityTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-800 dark:text-amber-400',
  danger: 'bg-destructive/10 text-destructive',
};

function ActivityToneIcon({ tone }: { tone: CalendarSyncActivityTone }) {
  const className = 'size-3.5 shrink-0';
  switch (tone) {
    case 'success':
      return <CalendarPlus className={className} aria-hidden />;
    case 'warning':
      return <CalendarOff className={className} aria-hidden />;
    case 'danger':
      return <XCircle className={className} aria-hidden />;
    default:
      return <RefreshCw className={className} aria-hidden />;
  }
}

type ChannelSyncDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** View-only team members (`pricing.channels:view` without `:edit`). */
  readOnly?: boolean;
};

export function ChannelSyncDialog({
  open,
  onOpenChange,
  readOnly = false,
}: ChannelSyncDialogProps) {
  const gate = useFeatureGate('calendarSync');
  const { open: openUpgradeModal } = useUpgradeModal();
  const channelSyncAvailability = useFeatureAvailability('pricing.channel_sync');
  const importAvailability = useFeatureAvailability('pricing.channel_sync.import');
  const showChannelSyncTierBadge =
    channelSyncAvailability.available && !channelSyncAvailability.isLoading;
  const settings = useCalendarSyncSettings({
    enabled: open,
  });

  const addFeed = useAddCalendarFeed();
  const removeFeed = useRemoveCalendarFeed();
  const setEnabled = useSetExportEnabled();
  const setCreateBookings = useSetCreateBookings();
  const syncNow = useSyncFeedNow();

  const [tab, setTab] = useState<'import' | 'export'>('import');
  const [icsUrl, setIcsUrl] = useState('');
  const [urlTouched, setUrlTouched] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<CalendarSyncFeed | null>(null);
  /** Nested AlertDialog dismiss can bubble and close the parent modal — suppress briefly. */
  const suppressParentCloseRef = useRef(false);
  const nestedConfirmOpen = !!pendingRemove;

  const data = settings.data;
  const feeds = data?.feeds ?? [];
  const exportUrl = data?.export.urls?.airbnb ?? '';
  const exportEnabled = data?.export.enabled ?? false;
  const activityRows = useMemo(
    () => buildCalendarSyncActivityRows(data?.recentEvents ?? [], formatRelative, 5),
    [data?.recentEvents]
  );
  const showAddForm = !readOnly && feeds.length === 0;
  const validationError = validateAirbnbCalendarUrl(icsUrl);
  /** Show errors only after the host types/changes the field (not on tab switch / blur). */
  const urlError = urlTouched ? validationError : null;
  /** Connect stays disabled until the URL passes Airbnb validation. */
  const canConnect = !validationError && !addFeed.isPending;

  type ImportActionButton = ReactElement<{
    className?: string;
    disabled?: boolean;
    onClick?: (e: MouseEvent) => void;
  }>;

  const wrapImportAction = (button: ImportActionButton) => {
    if (!importAvailability.available) {
      return (
        <FeatureAvailabilityButton featureKey="pricing.channel_sync.import">
          {button}
        </FeatureAvailabilityButton>
      );
    }
    if (!gate.canUse) {
      return <TierBadgeAnchor feature="calendarSync">{button}</TierBadgeAnchor>;
    }
    return button;
  };

  const requireCalendarSyncPlan = (): boolean => {
    if (!importAvailability.available) {
      toastFeatureUnavailable(importAvailability.message);
      return false;
    }
    if (gate.canUse) return true;
    if (!gate.isLoading) openUpgradeModal('calendarSync');
    return false;
  };

  const resetAddForm = () => {
    setIcsUrl('');
    setUrlTouched(false);
  };

  const closeNestedConfirm = (close: () => void) => {
    suppressParentCloseRef.current = true;
    close();
    window.setTimeout(() => {
      suppressParentCloseRef.current = false;
    }, 150);
  };

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    setUrlTouched(true);
    const error = validateAirbnbCalendarUrl(icsUrl);
    if (error) {
      toast.error(error);
      return;
    }
    if (!requireCalendarSyncPlan()) return;
    addFeed.mutate(
      { provider: 'airbnb', icsUrl: icsUrl.trim() },
      { onSuccess: () => resetAddForm() }
    );
  };

  const handleExportEnabledChange = (enabled: boolean) => {
    if (enabled) {
      if (!channelSyncAvailability.available) {
        toastFeatureUnavailable(channelSyncAvailability.message);
        return;
      }
      if (!requireCalendarSyncPlan()) return;
    }
    setEnabled.mutate(enabled);
  };

  const addForm = (
    <form className="space-y-3" onSubmit={handleAdd} noValidate>
      <div className="space-y-1.5">
        <FieldLabel
          htmlFor="channel-url"
          label="Airbnb calendar URL"
          required
          help={FROM_AIRBNB_URL_HELP}
        />
        <Input
          id="channel-url"
          value={icsUrl}
          onChange={(e) => {
            setIcsUrl(e.target.value);
            setUrlTouched(true);
          }}
          placeholder="https://www.airbnb.com/calendar/ical/…"
          className="h-11"
          inputMode="url"
          autoFocus={showAddForm && tab === 'import'}
          error={!!urlError}
          aria-invalid={urlError ? true : undefined}
          aria-describedby={urlError ? 'channel-url-error' : undefined}
        />
        {urlError ? (
          <p id="channel-url-error" className="text-destructive text-xs">
            {urlError}
          </p>
        ) : null}
      </div>
      <div className="pt-1">
        {wrapImportAction(
          <Button type="submit" className="min-h-[44px] w-full" disabled={!canConnect}>
            {addFeed.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Connect'}
          </Button>
        )}
      </div>
    </form>
  );

  return (
    <>
      <ResponsiveModal
        open={open}
        onOpenChange={(next) => {
          if (!next && (suppressParentCloseRef.current || nestedConfirmOpen)) return;
          if (!next) {
            resetAddForm();
            setTab('import');
          }
          onOpenChange(next);
        }}
      >
        <ResponsiveModalContent
          sheetLayout="split"
          className={cn(
            'flex max-h-[min(92dvh,44rem)] w-[min(calc(100vw-1.5rem),36rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(95vw,36rem)] sm:p-0'
          )}
          onEscapeKeyDown={(event) => {
            if (nestedConfirmOpen) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (nestedConfirmOpen) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (nestedConfirmOpen) event.preventDefault();
          }}
          onFocusOutside={(event) => {
            if (nestedConfirmOpen) event.preventDefault();
          }}
        >
          <ResponsiveModalHeader className="border-border/60 shrink-0 space-y-0 border-b px-4 py-3 text-left sm:px-5 sm:py-3">
            <ResponsiveModalTitle className="text-base sm:text-lg">
              Channel sync
            </ResponsiveModalTitle>
            <ResponsiveModalDescription className="sr-only">
              Connect your Airbnb calendar so availability stays in sync.
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch] sm:px-5">
            {gate.isLoading || settings.isLoading ? (
              <ChannelSyncBodySkeleton />
            ) : !channelSyncAvailability.available && !channelSyncAvailability.isLoading ? (
              <div className="space-y-4">
                <FeatureUnavailablePanel
                  label={channelSyncAvailability.label}
                  message={channelSyncAvailability.message}
                  expectedBackLabel={channelSyncAvailability.expectedBackLabel}
                  reason={channelSyncAvailability.reason}
                  tone={channelSyncAvailability.tone}
                />
                {exportUrl ? (
                  <div className="space-y-1.5">
                    <FieldLabel
                      htmlFor="channel-export-url-readonly"
                      label="Airbnb export link"
                      help={PASTE_INTO_AIRBNB_HELP}
                    />
                    <div className="flex gap-2">
                      <Input
                        id="channel-export-url-readonly"
                        readOnly
                        value={exportUrl}
                        className="h-11 min-w-0 flex-1 font-mono text-xs"
                      />
                      <CopyButton value={exportUrl} label="Copy Airbnb export link" />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : settings.isError ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-destructive text-sm">
                  {(settings.error as Error)?.message ?? 'Could not load channel sync'}
                </p>
                <Button type="button" variant="outline" onClick={() => settings.refetch()}>
                  Retry
                </Button>
              </div>
            ) : (
              <Tabs
                value={tab}
                onValueChange={(v) => {
                  const next = v as 'import' | 'export';
                  setTab(next);
                  // Blur/tab switch must not leave a Required error on an empty field.
                  if (next !== 'import' && !icsUrl.trim()) setUrlTouched(false);
                }}
                className="space-y-5"
              >
                <TabsList className="grid h-10 w-full grid-cols-2 max-lg:h-9">
                  <TabsTrigger value="import" className="h-8 max-lg:h-7 max-lg:text-xs">
                    From Airbnb
                  </TabsTrigger>
                  <TabsTrigger value="export" className="h-8 max-lg:h-7 max-lg:text-xs">
                    To Airbnb
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="import" className="mt-0 space-y-4 focus-visible:ring-0">
                  {!importAvailability.available && !importAvailability.isLoading ? (
                    <FeatureUnavailableNotice
                      title={importAvailability.label}
                      label={importAvailability.message || 'Imports from Airbnb are paused.'}
                      expectedBackLabel={importAvailability.expectedBackLabel}
                      tone={importAvailability.tone}
                    />
                  ) : null}

                  {feeds.length === 0 ? (
                    <div className="space-y-4">
                      <div className="flex flex-col items-center gap-3 pt-2 text-center">
                        <div className="bg-muted/80 flex size-12 items-center justify-center rounded-full">
                          <CalendarRange className="text-muted-foreground size-5" aria-hidden />
                        </div>
                        <div className="space-y-1">
                          <p className="text-foreground text-sm font-medium">
                            Pull Airbnb dates into this calendar
                          </p>
                          <p className="text-muted-foreground mx-auto max-w-[22rem] text-xs leading-relaxed">
                            {readOnly
                              ? 'No Airbnb calendar is connected for this property.'
                              : 'Connect once. Airbnb stays block here, and new reservations can become bookings you review.'}
                          </p>
                        </div>
                      </div>
                      {!readOnly ? (
                        <ol className="text-muted-foreground space-y-2 rounded-xl border px-3 py-3 text-xs leading-relaxed">
                          <li className="flex gap-2">
                            <span className="text-foreground w-4 shrink-0 font-medium tabular-nums">
                              1
                            </span>
                            <span>Paste Airbnb's Export calendar link below.</span>
                          </li>
                          <li className="flex gap-2">
                            <span className="text-foreground w-4 shrink-0 font-medium tabular-nums">
                              2
                            </span>
                            <span>Busy dates appear here within about 30 minutes.</span>
                          </li>
                          <li className="flex gap-2">
                            <span className="text-foreground w-4 shrink-0 font-medium tabular-nums">
                              3
                            </span>
                            <span>
                              With Create bookings on, each reservation becomes a Pending review
                              booking.
                            </span>
                          </li>
                        </ol>
                      ) : null}
                      {showAddForm ? addForm : null}
                    </div>
                  ) : (
                    <>
                      <ul className="space-y-3">
                        {feeds.map((feed) => {
                          const badge = feedHealthBadge(feed);
                          const name = feed.label || CALENDAR_PROVIDER_LABELS[feed.provider];
                          const statusLine = feed.lastSuccessAt
                            ? `Synced ${formatRelative(feed.lastSuccessAt)}`
                            : 'Waiting for first sync';
                          return (
                            <li key={feed.id} className="overflow-hidden rounded-xl border">
                              <div className="flex items-start gap-2 px-3 py-3">
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-medium">{name}</span>
                                    <Badge variant={badge.variant}>{badge.label}</Badge>
                                  </div>
                                  <p className="text-muted-foreground text-xs leading-snug">
                                    {statusLine}
                                    {feed.health === 'error' && feed.lastError
                                      ? ` · ${feed.lastError}`
                                      : ''}
                                  </p>
                                </div>
                                {!readOnly ? (
                                  <div className="-mr-1 flex shrink-0 items-center">
                                    {wrapImportAction(
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-11"
                                        disabled={
                                          syncNow.isPending && syncNow.variables === feed.id
                                        }
                                        onClick={() => syncNow.mutate(feed.id)}
                                        aria-label={`Sync ${name} now`}
                                      >
                                        {syncNow.isPending && syncNow.variables === feed.id ? (
                                          <Loader2 className="size-4 animate-spin" />
                                        ) : (
                                          <RefreshCw className="size-4" />
                                        )}
                                      </Button>
                                    )}
                                    {wrapImportAction(
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="text-muted-foreground hover:text-destructive size-11"
                                        onClick={() => setPendingRemove(feed)}
                                        aria-label={`Remove ${name}`}
                                      >
                                        <Trash2 className="size-4" />
                                      </Button>
                                    )}
                                  </div>
                                ) : null}
                              </div>
                              <div className="border-border/60 flex items-center justify-between gap-3 border-t px-3 py-2.5">
                                <div className="min-w-0">
                                  <p className="text-foreground text-sm">Create bookings</p>
                                  <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
                                    {CREATE_BOOKINGS_HELP}
                                  </p>
                                </div>
                                <Switch
                                  checked={feed.createBookings}
                                  disabled={
                                    readOnly ||
                                    (setCreateBookings.isPending &&
                                      setCreateBookings.variables?.feedId === feed.id)
                                  }
                                  onCheckedChange={(checked) => {
                                    if (!requireCalendarSyncPlan()) return;
                                    setCreateBookings.mutate({
                                      feedId: feed.id,
                                      enabled: checked,
                                    });
                                  }}
                                  aria-label={`Create bookings from ${name}`}
                                />
                              </div>
                            </li>
                          );
                        })}
                      </ul>

                      {activityRows.length > 0 ? (
                        <section className="space-y-2" aria-label="Recent activity">
                          <h3 className="text-foreground text-sm font-medium">Recent activity</h3>
                          <ul className="divide-border divide-y overflow-hidden rounded-xl border">
                            {activityRows.map((row) => (
                              <li key={row.id} className="flex items-start gap-2.5 px-3 py-2.5">
                                <span
                                  className={cn(
                                    'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full',
                                    ACTIVITY_TONE_CLASS[row.tone]
                                  )}
                                  aria-hidden
                                >
                                  <ActivityToneIcon tone={row.tone} />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-foreground text-sm leading-snug">
                                    {row.title}
                                  </p>
                                  {row.rangeLabel ? (
                                    <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
                                      {row.rangeLabel}
                                    </p>
                                  ) : null}
                                </div>
                                <time
                                  dateTime={row.createdAt}
                                  className="text-muted-foreground shrink-0 pt-0.5 text-[11px] tabular-nums"
                                >
                                  {row.relativeAt}
                                </time>
                              </li>
                            ))}
                          </ul>
                        </section>
                      ) : null}
                    </>
                  )}
                </TabsContent>

                <TabsContent value="export" className="mt-0 space-y-4 focus-visible:ring-0">
                  {!exportEnabled ? (
                    <div className="space-y-4">
                      <div className="flex flex-col items-center gap-3 pt-2 text-center">
                        <div className="bg-muted/80 flex size-12 items-center justify-center rounded-full">
                          <CalendarOff className="text-muted-foreground size-5" aria-hidden />
                        </div>
                        <div className="space-y-1">
                          <p className="text-foreground text-sm font-medium">
                            Block Airbnb when guests book here
                          </p>
                          <p className="text-muted-foreground mx-auto max-w-[22rem] text-xs leading-relaxed">
                            Share a private calendar link so Airbnb learns about Kame bookings and
                            manual blocks. Airbnb's own nights are not sent back.
                          </p>
                        </div>
                      </div>
                      <ol className="text-muted-foreground space-y-2 rounded-xl border px-3 py-3 text-xs leading-relaxed">
                        <li className="flex gap-2">
                          <span className="text-foreground w-4 shrink-0 font-medium tabular-nums">
                            1
                          </span>
                          <span>Turn on Share with Airbnb below.</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-foreground w-4 shrink-0 font-medium tabular-nums">
                            2
                          </span>
                          <span>Copy the link into Airbnb → Import calendar.</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-foreground w-4 shrink-0 font-medium tabular-nums">
                            3
                          </span>
                          <span>
                            Airbnb refreshes every few hours. New Kame stays then show as busy
                            there.
                          </span>
                        </li>
                      </ol>
                    </div>
                  ) : null}

                  <div className="overflow-hidden rounded-xl border">
                    <div className="flex items-center justify-between gap-3 px-3 py-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <FieldLabel
                            htmlFor="channel-export-enabled"
                            label="Share with Airbnb"
                            help={SHARE_WITH_AIRBNB_HELP}
                            className="mb-0"
                          />
                          {showChannelSyncTierBadge ? <TierBadge feature="calendarSync" /> : null}
                        </div>
                        {!exportEnabled ? (
                          <p className="text-muted-foreground mt-1 text-xs leading-snug">
                            Off until you turn it on. No link is shared with Airbnb yet.
                          </p>
                        ) : null}
                      </div>
                      <Switch
                        id="channel-export-enabled"
                        checked={exportEnabled}
                        onCheckedChange={handleExportEnabledChange}
                        disabled={
                          readOnly ||
                          setEnabled.isPending ||
                          !data?.export.urls ||
                          (!channelSyncAvailability.available && !channelSyncAvailability.isLoading)
                        }
                      />
                    </div>

                    {exportEnabled ? (
                      <div className="border-border/60 space-y-1.5 border-t px-3 py-3">
                        {exportUrl ? (
                          <>
                            <FieldLabel
                              htmlFor="channel-export-url"
                              label="Paste into Airbnb"
                              help={PASTE_INTO_AIRBNB_HELP}
                            />
                            <div className="flex gap-2">
                              <Input
                                id="channel-export-url"
                                readOnly
                                value={exportUrl}
                                className="h-11 min-w-0 flex-1 font-mono text-xs"
                              />
                              <CopyButton value={exportUrl} label="Copy Airbnb export link" />
                            </div>
                          </>
                        ) : (
                          <p className="text-muted-foreground text-sm">Export link unavailable.</p>
                        )}
                      </div>
                    ) : null}
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <AlertDialog
        open={!!pendingRemove}
        onOpenChange={(next) => {
          if (!next) closeNestedConfirm(() => setPendingRemove(null));
        }}
      >
        <AlertDialogContent onCloseAutoFocus={(event) => event.preventDefault()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this calendar?</AlertDialogTitle>
            <AlertDialogDescription>
              Imported dates stay as blocks so stays aren’t lost. Tick below to delete them too.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <RemoveFeedChoice
            key={pendingRemove?.id ?? 'none'}
            onConfirm={(deleteData) => {
              if (!pendingRemove) return;
              removeFeed.mutate(
                { feedId: pendingRemove.id, deleteData },
                {
                  onSettled: () => closeNestedConfirm(() => setPendingRemove(null)),
                }
              );
            }}
            pending={removeFeed.isPending}
          />
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function RemoveFeedChoice({
  onConfirm,
  pending,
}: {
  onConfirm: (deleteData: boolean) => void;
  pending: boolean;
}) {
  const [deleteData, setDeleteData] = useState(false);
  return (
    <>
      <label className="flex min-h-[44px] items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={deleteData}
          onChange={(e) => setDeleteData(e.target.checked)}
          className="size-4"
        />
        Also delete dates this calendar added
      </label>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={(e) => {
            e.preventDefault();
            onConfirm(deleteData);
          }}
          disabled={pending}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : 'Remove'}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}
