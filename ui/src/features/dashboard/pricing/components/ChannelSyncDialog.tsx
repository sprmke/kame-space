import { useRef, useState, type FormEvent, type MouseEvent, type ReactElement } from 'react';

import {
  AlertTriangle,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
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
  CALENDAR_PROVIDER_LABELS,
  validateChannelCalendarUrl,
  type CalendarSyncEvent,
  type CalendarSyncFeed,
} from '@/features/dashboard/pricing/lib/calendarSyncApi';
import {
  buildChannelRows,
  CHANNEL_COPY,
  CHANNEL_STATUS_LABEL,
  HUB_CHECKLIST,
  showHubChecklist,
  type ChannelRow,
  type ChannelStatus,
  type DialogChannel,
} from '@/features/dashboard/pricing/lib/channelSyncView';
import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { useGuardedClose } from '@/hooks/useGuardedClose';

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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import { toastFeatureUnavailable } from '@/lib/featureAvailability/featureUnavailableError';
import { useFeatureAvailability } from '@/lib/featureAvailability/useFeatureAvailability';
import { cn } from '@/lib/utils';
import { formatRelative } from '@/utils/format/bookingDisplay';

const HEALTH_TONE: Record<
  CalendarSyncFeed['health'],
  { label: string; variant: 'secondary' | 'outline' | 'destructive' }
> = {
  ok: { label: 'Synced', variant: 'secondary' },
  warning: { label: 'Retrying', variant: 'outline' },
  error: { label: 'Needs fix', variant: 'destructive' },
};

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

function eventLine(e: CalendarSyncEvent, channel: string | null): string {
  const prefix = channel ? `${channel}: ` : '';
  return prefix + eventText(e);
}

function eventText(e: CalendarSyncEvent): string {
  const range = e.start_date && e.end_date ? ` ${e.start_date} → ${e.end_date}` : '';
  switch (e.action) {
    case 'block_created':
      return `Imported reservation${range}`;
    case 'block_updated':
      return `Reservation dates changed${range}`;
    case 'block_removed':
      return `Reservation removed${range}`;
    case 'booking_created':
      return `Booking added${range}`;
    case 'booking_linked':
      return `Existing booking linked${range}`;
    case 'booking_rescheduled':
      return `Booking dates changed${range}`;
    case 'booking_cancelled':
      return `Booking cancelled${range}`;
    case 'conflict_detected':
      return `Conflict: overlaps another booking${range}`;
    case 'error':
      return `Sync error: ${String(e.detail?.reason ?? 'unknown')}`;
    case 'skipped':
      return `Skipped: ${String(e.detail?.reason ?? 'no change')}`;
    default:
      return `${e.action}${range}`;
  }
}

type ChannelSyncDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** View-only team members (`pricing.channels:view` without `:edit`). */
  readOnly?: boolean;
};

const STATUS_VARIANT: Record<ChannelStatus, 'secondary' | 'outline' | 'destructive'> = {
  not_connected: 'outline',
  syncing: 'secondary',
  needs_attention: 'destructive',
  paused: 'outline',
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
  const [adding, setAdding] = useState(false);
  const [icsUrl, setIcsUrl] = useState('');
  const [urlTouched, setUrlTouched] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<CalendarSyncFeed | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  /** Nested AlertDialog dismiss can bubble and close the parent modal — suppress briefly. */
  const suppressParentCloseRef = useRef(false);
  const nestedConfirmOpen = !!pendingRemove;

  const data = settings.data;
  const feeds = data?.feeds ?? [];
  const exportEnabled = data?.export.enabled ?? false;
  const recentEvents = data?.recentEvents ?? [];
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
  const channelFeeds = row?.feeds ?? [];
  const showAddForm = !readOnly && !!row?.connectable && (adding || channelFeeds.length === 0);
  const validationError = selected ? validateChannelCalendarUrl(selected, icsUrl) : null;
  /** Show errors only after the host types/changes the field (not on view switch / blur). */
  const urlError = urlTouched ? validationError : null;
  const canConnect = !validationError && !addFeed.isPending;
  const selectedPaused = row?.status === 'paused';

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
    setAdding(false);
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

  const selectChannel = (provider: DialogChannel | null) => {
    resetAddForm();
    setSelected(provider);
  };

  const [confirmBack, setConfirmBack] = useState(false);
  const handleBack = () => {
    // A typed link is an unsaved draft: leaving the setup view asks first, same as closing.
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
    }
    setEnabled.mutate(enabled);
  };

  const channelName = copy?.label ?? 'channel';

  const addForm =
    copy && selected ? (
      <form
        className={cn(
          'space-y-3',
          channelFeeds.length > 0 && 'border-border rounded-xl border p-3'
        )}
        onSubmit={handleAdd}
        noValidate
      >
        <div className="space-y-1.5">
          <FieldLabel
            htmlFor="channel-url"
            label={`${channelName} calendar URL`}
            required
            help={copy.importStep}
          />
          <Input
            id="channel-url"
            value={icsUrl}
            onChange={(e) => {
              setIcsUrl(e.target.value);
              setUrlTouched(true);
            }}
            placeholder={copy.importPlaceholder}
            className="h-11"
            inputMode="url"
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
        <div className="flex gap-2 pt-1">
          {channelFeeds.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] flex-1"
              onClick={resetAddForm}
              disabled={addFeed.isPending}
            >
              Cancel
            </Button>
          ) : null}
          {wrapImportAction(
            <Button type="submit" className="min-h-[44px] w-full" disabled={!canConnect}>
              {addFeed.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Connect'}
            </Button>
          )}
        </div>
      </form>
    ) : null;

  const feedName = (feed: CalendarSyncFeed) =>
    feed.label || CALENDAR_PROVIDER_LABELS[feed.provider];

  const activityList = (
    <Collapsible open={activityOpen} onOpenChange={setActivityOpen}>
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex min-h-[44px] w-full items-center justify-between text-left text-sm font-medium">
        Recent activity
        <span className="text-xs tabular-nums">{recentEvents.length}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="space-y-1.5 pb-1">
          {recentEvents.slice(0, 8).map((e) => {
            const feed = feeds.find((f) => f.id === e.feed_id);
            return (
              <li key={e.id} className="text-muted-foreground flex justify-between gap-3 text-xs">
                <span className="truncate">
                  {eventLine(e, feed ? CALENDAR_PROVIDER_LABELS[feed.provider] : null)}
                </span>
                <span className="shrink-0">{formatRelative(e.created_at)}</span>
              </li>
            );
          })}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );

  const channelList = (
    <div className="space-y-4">
      {showHubChecklist(rows) ? (
        <div className="border-primary/20 bg-primary/5 rounded-xl border p-3">
          <p className="text-foreground text-xs font-medium">Keep every channel in sync</p>
          <ul className="text-muted-foreground mt-1 list-disc space-y-0.5 pl-4 text-xs">
            {HUB_CHECKLIST.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="border-primary/20 bg-primary/5 rounded-xl border p-3">
          <p className="text-foreground text-xs font-medium">How channel sync works</p>
          <ol className="text-muted-foreground mt-1 list-decimal space-y-0.5 pl-4 text-xs">
            <li>Booked dates from a channel block here within 30 minutes.</li>
            <li>New reservations become bookings you can review.</li>
            <li>Dates booked here close on every other channel.</li>
          </ol>
        </div>
      )}
      <ul className="divide-border divide-y overflow-hidden rounded-xl border">
        {rows.map((r) => (
          <li key={r.provider}>
            <button
              type="button"
              onClick={() => selectChannel(r.provider)}
              className="hover:bg-muted/50 flex min-h-[56px] w-full items-center gap-3 p-3 text-left"
              aria-label={`${r.label}, ${CHANNEL_STATUS_LABEL[r.status]}`}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{r.label}</span>
                  <Badge variant={STATUS_VARIANT[r.status]}>{CHANNEL_STATUS_LABEL[r.status]}</Badge>
                </div>
                <p className="text-muted-foreground text-xs">
                  {r.lastImportAt
                    ? `Imported ${formatRelative(r.lastImportAt)}`
                    : 'Not imported yet'}
                  {exportEnabled && r.lastReadAt
                    ? ` · ${r.label} read your link ${formatRelative(r.lastReadAt)}`
                    : ''}
                </p>
              </div>
              <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {recentEvents.length > 0 ? activityList : null}
    </div>
  );

  const channelDetail =
    row && copy ? (
      <div className="space-y-5">
        <button
          type="button"
          onClick={handleBack}
          className="text-muted-foreground hover:text-foreground -ml-1 flex min-h-[44px] items-center gap-1 text-sm"
        >
          <ChevronLeft className="size-4" aria-hidden />
          All channels
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold">{row.label}</h3>
          <Badge variant={STATUS_VARIANT[row.status]}>{CHANNEL_STATUS_LABEL[row.status]}</Badge>
        </div>

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

        {row.warnings.length > 0 ? (
          <ul className="space-y-1.5" aria-label={`${row.label} warnings`}>
            {row.warnings.map((w) => (
              <li
                key={w.kind}
                className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border p-2.5 text-xs"
              >
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>{w.message}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {copy.eligibility ? (
          <p className="text-muted-foreground text-xs">{copy.eligibility}</p>
        ) : null}

        <section className="space-y-3" aria-labelledby="channel-step-1">
          <h4 id="channel-step-1" className="text-sm font-medium">
            1. Bring {row.label} in
          </h4>
          <p className="text-muted-foreground text-xs">{copy.importStep}</p>

          {channelFeeds.length === 0 && readOnly ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="bg-muted/80 flex size-12 items-center justify-center rounded-full">
                <CalendarRange className="text-muted-foreground size-5" aria-hidden />
              </div>
              <p className="text-foreground text-sm font-medium">No {row.label} calendar</p>
              <p className="text-muted-foreground max-w-[18rem] text-xs">
                No {row.label} calendar is connected for this property.
              </p>
            </div>
          ) : (
            <>
              {channelFeeds.length > 0 ? (
                <ul className="divide-border divide-y overflow-hidden rounded-xl border">
                  {channelFeeds.map((feed) => {
                    const tone = HEALTH_TONE[feed.health];
                    const name = feedName(feed);
                    return (
                      <li key={feed.id} className="flex items-start gap-2 p-3">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{name}</span>
                            <Badge variant={tone.variant}>{tone.label}</Badge>
                          </div>
                          <p className="text-muted-foreground text-xs">
                            {feed.lastSuccessAt
                              ? `Synced ${formatRelative(feed.lastSuccessAt)}`
                              : 'Not synced yet'}
                            {feed.health === 'error' && feed.lastError
                              ? ` · ${feed.lastError}`
                              : ''}
                          </p>
                          <div className="flex items-center justify-between gap-3 pt-1.5">
                            <span className="text-muted-foreground text-xs">Create bookings</span>
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
                                  provider: feed.provider,
                                });
                              }}
                              aria-label={`Create bookings from ${name}`}
                            />
                          </div>
                          {copy.createBookingsNote ? (
                            <p className="text-muted-foreground text-xs">
                              {copy.createBookingsNote}
                            </p>
                          ) : null}
                        </div>
                        {!readOnly ? (
                          <div className="flex shrink-0 items-center gap-0.5">
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
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              {showAddForm
                ? addForm
                : !readOnly && row.connectable
                  ? wrapImportAction(
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-[44px] w-full gap-1.5"
                        onClick={() => setAdding(true)}
                      >
                        <Plus className="size-4" aria-hidden />
                        Connect another {row.label} calendar
                      </Button>
                    )
                  : null}
            </>
          )}
        </section>

        <section className="space-y-3" aria-labelledby="channel-step-2">
          <h4 id="channel-step-2" className="text-sm font-medium">
            2. Send Kame Space to {row.label}
          </h4>
          <p className="text-muted-foreground text-xs">
            {copy.exportStep} {copy.refreshNote}
          </p>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <FieldLabel
                htmlFor="channel-export-enabled"
                label="Share this property's dates"
                help="Turns on one private calendar link for this property. Every channel you connect reads its own copy of it."
                className="mb-0"
              />
              {showChannelSyncTierBadge ? <TierBadge feature="calendarSync" /> : null}
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
          {exportEnabled && exportUrl ? (
            <div className="space-y-1.5">
              <FieldLabel
                htmlFor="channel-export-url"
                label={`Paste into ${row.label}`}
                help={copy.exportStep}
              />
              <div className="flex gap-2">
                <Input
                  id="channel-export-url"
                  readOnly
                  value={exportUrl}
                  className="h-11 min-w-0 flex-1 font-mono text-xs"
                />
                <CopyButton value={exportUrl} label={`Copy ${row.label} export link`} />
              </div>
              {row.lastReadAt ? (
                <p className="text-muted-foreground text-xs">
                  {row.label} read your link {formatRelative(row.lastReadAt)}.
                </p>
              ) : null}
            </div>
          ) : data?.export.urls ? (
            <p className="text-muted-foreground text-sm">Turn on to copy a link for {row.label}.</p>
          ) : (
            <p className="text-muted-foreground text-sm">Export link unavailable.</p>
          )}
        </section>
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
                    <FieldLabel
                      htmlFor="channel-export-url-readonly"
                      label="Airbnb export link"
                      help={CHANNEL_COPY.airbnb.exportStep}
                    />
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
