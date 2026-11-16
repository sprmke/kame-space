import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
  type ReactElement,
} from 'react';

import {
  AlertTriangle,
  CalendarOff,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Info,
  Loader2,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

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
  validateChannelCalendarUrl,
  type CalendarSyncFeed,
} from '@/features/dashboard/pricing/lib/calendarSyncApi';
import {
  buildChannelRows,
  CHANNEL_COPY,
  CHANNEL_STATUS_LABEL,
  HUB_TIP,
  showHubChecklist,
  type ChannelRow,
  type ChannelStatus,
  type DialogChannel,
} from '@/features/dashboard/pricing/lib/channelSyncView';

import { FeatureAvailabilityButton } from '@/components/feature-availability/FeatureAvailabilityButton';
import { FeatureUnavailableNotice } from '@/components/feature-availability/FeatureUnavailableNotice';
import { FeatureUnavailablePanel } from '@/components/feature-availability/FeatureUnavailablePanel';
import { FieldHelpTooltip } from '@/components/forms/FieldLabel';
import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
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
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { toastFeatureUnavailable } from '@/lib/featureAvailability/featureUnavailableError';
import { useFeatureAvailability } from '@/lib/featureAvailability/useFeatureAvailability';
import { cn } from '@/lib/utils';
import { formatRelative } from '@/utils/format/bookingDisplay';

/** One line about a feed: what a host needs to know at a glance. */
function feedStatus(feed: CalendarSyncFeed): { text: string; tone: 'ok' | 'warn' | 'error' } {
  if (feed.health === 'error') {
    return { text: feed.lastError ? `Needs fix: ${feed.lastError}` : 'Needs fix', tone: 'error' };
  }
  if (feed.health === 'warning') return { text: 'Retrying', tone: 'warn' };
  if (feed.lastSuccessAt)
    return { text: `Synced ${formatRelative(feed.lastSuccessAt)}`, tone: 'ok' };
  return { text: 'Waiting for first sync', tone: 'warn' };
}

const STATUS_DOT: Record<ChannelStatus, string> = {
  not_connected: 'bg-muted-foreground/40',
  syncing: 'bg-emerald-500',
  needs_attention: 'bg-destructive',
  paused: 'bg-amber-500',
};

function StatusLabel({ status, className }: { status: ChannelStatus; className?: string }) {
  return (
    <span
      className={cn(
        'text-muted-foreground inline-flex items-center gap-1.5 text-xs font-medium',
        className
      )}
    >
      <span className={cn('size-1.5 rounded-full', STATUS_DOT[status])} aria-hidden />
      {CHANNEL_STATUS_LABEL[status]}
    </span>
  );
}

function ChannelSyncBodySkeleton() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading channel sync">
      <div className="divide-border divide-y overflow-hidden rounded-xl border" aria-hidden>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex min-h-[60px] items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

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

/** Section title with its ? help. Everything that explains a step lives in the ?. */
function SectionTitle({
  id,
  children,
  help,
  trailing,
}: {
  id: string;
  children: string;
  help: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[44px] items-center justify-between gap-3">
      <div className="flex items-center gap-1">
        <h3 id={id} className="text-sm font-semibold">
          {children}
        </h3>
        <FieldHelpTooltip label={children} help={help} />
      </div>
      {trailing}
    </div>
  );
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
  const airbnbAvailability = useFeatureAvailability('pricing.channel_sync.airbnb');
  const agodaAvailability = useFeatureAvailability('pricing.channel_sync.agoda');
  const bookingComAvailability = useFeatureAvailability('pricing.channel_sync.booking_com');
  const channelAvailability: Record<DialogChannel, typeof airbnbAvailability> = {
    airbnb: airbnbAvailability,
    agoda: agodaAvailability,
    booking_com: bookingComAvailability,
  };
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

  const [selected, setSelected] = useState<DialogChannel | null>(null);
  const [icsUrl, setIcsUrl] = useState('');
  const [urlTouched, setUrlTouched] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<CalendarSyncFeed | null>(null);
  const [confirmBack, setConfirmBack] = useState(false);
  const [confirmShareOff, setConfirmShareOff] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  /** Nested AlertDialog dismiss can bubble and close the parent modal, so suppress briefly. */
  const suppressParentCloseRef = useRef(false);
  const nestedConfirmOpen = !!pendingRemove || confirmShareOff;
  const backButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastSelectedRef = useRef<DialogChannel | null>(null);

  const data = settings.data;
  const feeds = data?.feeds ?? [];
  const exportEnabled = data?.export.enabled ?? false;
  const rows = buildChannelRows(data, {
    airbnb: !airbnbAvailability.available && !airbnbAvailability.isLoading,
    agoda: !agodaAvailability.available && !agodaAvailability.isLoading,
    booking_com: !bookingComAvailability.available && !bookingComAvailability.isLoading,
  });
  const row: ChannelRow | null = selected
    ? (rows.find((r) => r.provider === selected) ?? null)
    : null;
  const copy = selected ? CHANNEL_COPY[selected] : null;
  const exportUrl = selected ? (data?.export.urls?.[selected] ?? '') : '';
  const channelFeeds = useMemo(() => row?.feeds ?? [], [row?.feeds]);
  const showAddForm = !readOnly && !!row?.connectable && channelFeeds.length === 0;
  const validationError = selected ? validateChannelCalendarUrl(selected, icsUrl) : null;
  /** Show errors only after the host types/changes the field (not on view switch / blur). */
  const urlError = urlTouched ? validationError : null;
  const canConnect = !validationError && !addFeed.isPending;
  const selectedPaused = row?.status === 'paused';
  const anyActiveFeed = feeds.some((f) => f.isActive);

  // Activity for the open channel only: last few host-facing events, closed by default.
  const activityRows = useMemo(() => {
    const ids = new Set(channelFeeds.map((f) => f.id));
    const events = (data?.recentEvents ?? []).filter((e) => ids.has(e.feed_id));
    return buildCalendarSyncActivityRows(events, formatRelative, 4);
  }, [data?.recentEvents, channelFeeds]);

  // Keep focus where the host expects it when the view changes.
  useEffect(() => {
    if (selected) {
      lastSelectedRef.current = selected;
      backButtonRef.current?.focus();
    } else if (lastSelectedRef.current) {
      document.getElementById(`channel-row-${lastSelectedRef.current}`)?.focus();
    }
  }, [selected]);

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
    if (selected && !channelAvailability[selected].available) {
      return (
        <FeatureAvailabilityButton
          featureKey={`pricing.channel_sync.${selected}` as 'pricing.channel_sync.airbnb'}
        >
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
    if (selected && !channelAvailability[selected].available) {
      toastFeatureUnavailable(channelAvailability[selected].message);
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

  const finishClose = (next: boolean) => {
    if (!next) {
      resetAddForm();
      setSelected(null);
      setActivityOpen(false);
    }
    onOpenChange(next);
  };

  // A pasted link is the only editable draft here. Closing with one typed asks first.
  const guarded = useGuardedClose({
    open,
    onOpenChange: finishClose,
    isDirty: icsUrl.trim().length > 0,
    onDiscard: resetAddForm,
  });

  const selectChannel = (provider: DialogChannel) => {
    resetAddForm();
    setActivityOpen(false);
    setSelected(provider);
  };

  const handleBack = () => {
    // A typed link is an unsaved draft: leaving the channel view asks first, same as closing.
    if (icsUrl.trim()) {
      setConfirmBack(true);
      return;
    }
    setSelected(null);
  };

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setUrlTouched(true);
    const error = validateChannelCalendarUrl(selected, icsUrl);
    if (error) {
      toast.error(error);
      return;
    }
    if (!requireCalendarSyncPlan()) return;
    addFeed.mutate(
      { provider: selected, icsUrl: icsUrl.trim() },
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
    } else if (anyActiveFeed) {
      // Turning sharing off stops every channel from learning about new bookings.
      setConfirmShareOff(true);
      return;
    }
    setEnabled.mutate(enabled);
  };

  // ── Channel list ─────────────────────────────────────────────────────────
  const channelList = (
    <div className="space-y-4">
      <ul className="divide-border divide-y overflow-hidden rounded-xl border">
        {rows.map((r) => {
          const meta =
            r.status === 'needs_attention'
              ? (r.warnings[0]?.message ?? null)
              : r.status === 'syncing' && r.lastImportAt
                ? `Synced ${formatRelative(r.lastImportAt)}`
                : null;
          const invite = r.status === 'not_connected' && r.connectable && !readOnly;
          return (
            <li key={r.provider}>
              <button
                id={`channel-row-${r.provider}`}
                type="button"
                onClick={() => selectChannel(r.provider)}
                className="hover:bg-muted/50 focus-visible:ring-ring flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
                aria-label={`${r.label}, ${CHANNEL_STATUS_LABEL[r.status]}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{r.label}</p>
                  {meta ? (
                    <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">{meta}</p>
                  ) : null}
                </div>
                {invite ? (
                  <span className="text-primary text-xs font-medium">Connect</span>
                ) : (
                  <StatusLabel status={r.status} />
                )}
                <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
      {showHubChecklist(rows) ? (
        <p className="text-muted-foreground flex items-start gap-2 text-xs">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {HUB_TIP}
        </p>
      ) : null}
    </div>
  );

  // ── One channel ──────────────────────────────────────────────────────────
  const channelDetail =
    row && copy ? (
      <div className="divide-border divide-y [&>section:first-child]:pt-0 [&>section:last-child]:pb-0 [&>section]:py-4">
        {selectedPaused || (!importAvailability.available && !importAvailability.isLoading) ? (
          <section className="space-y-3">
            {selectedPaused && selected ? (
              <FeatureUnavailableNotice
                title={channelAvailability[selected].label}
                label={channelAvailability[selected].message || `${row.label} sync is paused.`}
                expectedBackLabel={channelAvailability[selected].expectedBackLabel}
                tone={channelAvailability[selected].tone}
              />
            ) : null}
            {!importAvailability.available && !importAvailability.isLoading ? (
              <FeatureUnavailableNotice
                title={importAvailability.label}
                label={importAvailability.message || 'Calendar imports are paused.'}
                expectedBackLabel={importAvailability.expectedBackLabel}
                tone={importAvailability.tone}
              />
            ) : null}
          </section>
        ) : null}

        {row.warnings.length > 0 ? (
          <section>
            <ul
              className="bg-destructive/5 text-destructive space-y-1.5 rounded-lg px-3 py-2.5 text-xs"
              aria-label={`${row.label} warnings`}
            >
              {row.warnings.map((w) => (
                <li key={w.kind} className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span>{w.message}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="channel-from">
          <SectionTitle id="channel-from" help={copy.importHelp}>
            {`From ${row.label}`}
          </SectionTitle>

          {channelFeeds.length === 0 ? (
            showAddForm ? (
              <form onSubmit={handleAdd} noValidate className="space-y-1.5">
                <Label htmlFor="channel-url" className="sr-only">
                  {`${row.label} calendar link`}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="channel-url"
                    value={icsUrl}
                    onChange={(e) => {
                      setIcsUrl(e.target.value);
                      setUrlTouched(true);
                    }}
                    placeholder={copy.importPlaceholder}
                    className="h-11 min-w-0 flex-1"
                    inputMode="url"
                    error={!!urlError}
                    aria-invalid={urlError ? true : undefined}
                    aria-describedby={urlError ? 'channel-url-error' : undefined}
                  />
                  {wrapImportAction(
                    <Button type="submit" className="h-11 shrink-0 px-4" disabled={!canConnect}>
                      {addFeed.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Connect'}
                    </Button>
                  )}
                </div>
                {urlError ? (
                  <p id="channel-url-error" className="text-destructive text-xs">
                    {urlError}
                  </p>
                ) : null}
              </form>
            ) : (
              <p className="text-muted-foreground text-sm">No calendar connected</p>
            )
          ) : (
            <ul className="space-y-1">
              {channelFeeds.map((feed) => {
                const status = feedStatus(feed);
                const name = feed.label || CALENDAR_PROVIDER_LABELS[feed.provider];
                return (
                  <li key={feed.id}>
                    <div className="flex items-center gap-2">
                      <p
                        className={cn(
                          'line-clamp-2 min-w-0 flex-1 text-sm',
                          status.tone === 'error' && 'text-destructive',
                          status.tone === 'warn' && 'text-muted-foreground'
                        )}
                      >
                        {status.text}
                      </p>
                      {!readOnly ? (
                        <div className="-mr-2 flex shrink-0 items-center">
                          {wrapImportAction(
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-11"
                              disabled={syncNow.isPending && syncNow.variables === feed.id}
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
                    <div className="flex min-h-[44px] items-center justify-between gap-3">
                      <div className="flex items-center gap-1">
                        <Label
                          htmlFor={`create-bookings-${feed.id}`}
                          className="text-sm font-normal"
                        >
                          Create bookings
                        </Label>
                        <FieldHelpTooltip label="Create bookings" help={copy.createBookingsHelp} />
                      </div>
                      <Switch
                        id={`create-bookings-${feed.id}`}
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
                            provider: feed.provider,
                          });
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-label={`Share dates with ${row.label}`}>
          <SectionTitle
            id="channel-to"
            help={`${copy.exportHelp} One switch covers every channel.`}
            trailing={
              <div className="flex items-center gap-2">
                {showChannelSyncTierBadge ? <TierBadge feature="calendarSync" /> : null}
                <Switch
                  checked={exportEnabled}
                  onCheckedChange={handleExportEnabledChange}
                  aria-label={`Share dates with ${row.label}`}
                  disabled={
                    readOnly ||
                    setEnabled.isPending ||
                    !data?.export.urls ||
                    (!channelSyncAvailability.available && !channelSyncAvailability.isLoading)
                  }
                />
              </div>
            }
          >
            {`To ${row.label}`}
          </SectionTitle>
          {exportEnabled && exportUrl ? (
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={exportUrl}
                  aria-label={`${row.label} export link`}
                  className="h-11 min-w-0 flex-1 font-mono text-xs"
                />
                <CopyButton value={exportUrl} label={`Copy ${row.label} export link`} />
              </div>
              {row.lastReadAt ? (
                <p className="text-muted-foreground text-xs">
                  {`Read ${formatRelative(row.lastReadAt)}`}
                </p>
              ) : null}
            </div>
          ) : !data?.export.urls ? (
            <p className="text-muted-foreground text-sm">Link unavailable</p>
          ) : null}
        </section>

        {activityRows.length > 0 ? (
          <section>
            <Collapsible open={activityOpen} onOpenChange={setActivityOpen}>
              <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex min-h-[44px] w-full items-center justify-between text-sm font-medium">
                Recent activity
                <ChevronDown
                  className={cn('size-4 transition-transform', activityOpen && 'rotate-180')}
                  aria-hidden
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="divide-border divide-y">
                  {activityRows.map((its) => (
                    <li key={its.id} className="flex items-start gap-2.5 py-2.5">
                      <span
                        className={cn(
                          'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full',
                          ACTIVITY_TONE_CLASS[its.tone]
                        )}
                        aria-hidden
                      >
                        <ActivityToneIcon tone={its.tone} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-snug">{its.title}</p>
                        {its.rangeLabel ? (
                          <p className="text-muted-foreground text-xs">{its.rangeLabel}</p>
                        ) : null}
                      </div>
                      <time
                        dateTime={its.createdAt}
                        className="text-muted-foreground shrink-0 text-[11px] tabular-nums"
                      >
                        {its.relativeAt}
                      </time>
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          </section>
        ) : null}
      </div>
    ) : null;

  const unavailableLink = data?.export.urls?.airbnb ?? '';

  return (
    <>
      <ResponsiveModal
        open={open}
        onOpenChange={(next) => {
          if (!next && (suppressParentCloseRef.current || nestedConfirmOpen)) return;
          guarded.onOpenChange(next);
        }}
      >
        <ResponsiveModalContent
          sheetLayout="split"
          className={cn(
            'flex max-h-[min(92dvh,44rem)] w-[min(calc(100vw-1.5rem),32rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(95vw,32rem)] sm:p-0'
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
          <ResponsiveModalHeader className="border-border/60 shrink-0 space-y-0 border-b px-4 py-2 text-left sm:px-5">
            <div className="flex min-h-[44px] items-center gap-1 pr-10">
              {row ? (
                <Button
                  ref={backButtonRef}
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="-ml-2 size-11 shrink-0"
                  onClick={handleBack}
                  aria-label="All channels"
                >
                  <ChevronLeft className="size-5" aria-hidden />
                </Button>
              ) : null}
              <ResponsiveModalTitle className="text-base sm:text-lg">
                {row ? row.label : 'Channel sync'}
              </ResponsiveModalTitle>
              {row ? <StatusLabel status={row.status} className="ml-2" /> : null}
            </div>
            <ResponsiveModalDescription className="sr-only">
              Connect your channel calendars so availability stays in sync.
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
                {unavailableLink ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="channel-export-url-readonly" className="text-sm">
                      Airbnb export link
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="channel-export-url-readonly"
                        readOnly
                        value={unavailableLink}
                        className="h-11 min-w-0 flex-1 font-mono text-xs"
                      />
                      <CopyButton value={unavailableLink} label="Copy Airbnb export link" />
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
              (channelDetail ?? channelList)
            )}
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <UnsavedChangesDialog {...guarded.dialogProps} />
      <UnsavedChangesDialog
        open={confirmBack}
        action="leave"
        onKeepEditing={() => setConfirmBack(false)}
        onDiscard={() => {
          resetAddForm();
          setConfirmBack(false);
          setSelected(null);
        }}
      />

      <AlertDialog
        open={confirmShareOff}
        onOpenChange={(next) => {
          if (!next) closeNestedConfirm(() => setConfirmShareOff(false));
        }}
      >
        <AlertDialogContent onCloseAutoFocus={(event) => event.preventDefault()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop sharing dates?</AlertDialogTitle>
            <AlertDialogDescription>
              Connected channels stop getting your bookings and can be double booked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep sharing</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                setEnabled.mutate(false, {
                  onSettled: () => closeNestedConfirm(() => setConfirmShareOff(false)),
                });
              }}
            >
              Stop sharing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
