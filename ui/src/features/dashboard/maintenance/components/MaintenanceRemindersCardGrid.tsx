import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';

import { CheckCircle2, Clock3, Pencil, Repeat, Trash2 } from 'lucide-react';

import { recurrenceIntervalLabel } from '@/features/dashboard/finance/lib/recurrence';
import type { MaintenanceItem } from '@/features/dashboard/maintenance/lib/types';

import { AdminListCardOverflowMenu } from '@/components/mobile/AdminListCardOverflowMenu';
import { FinanceStaysCardGridSkeleton } from '@/components/skeletons/AdminSkeletons';
import { compactStatusBadgeClasses } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';
import { formatIsoDate } from '@/utils/format/bookingDisplay';

type ItemActions = {
  onEdit?: (item: MaintenanceItem) => void;
  onDelete?: (item: MaintenanceItem) => void;
  onOpenSeries?: (item: MaintenanceItem) => void;
};

type Props = ItemActions & {
  items: MaintenanceItem[];
  isLoading: boolean;
  isRefreshing?: boolean;
  showStatus?: boolean;
};

export function MaintenanceRemindersCardGrid({
  items,
  isLoading,
  isRefreshing = false,
  showStatus = false,
  onEdit,
  onDelete,
  onOpenSeries,
}: Props) {
  if (isLoading) return <FinanceStaysCardGridSkeleton />;

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'grid grid-cols-1 items-stretch gap-2 sm:grid-cols-2 sm:gap-3.5 lg:grid-cols-3 xl:grid-cols-4',
        'transition-opacity duration-300',
        isRefreshing && 'opacity-60'
      )}
    >
      {items.map((item) => (
        <MaintenanceReminderCard
          key={item.id}
          item={item}
          showStatus={showStatus}
          onEdit={onEdit ? () => onEdit(item) : undefined}
          onDelete={onDelete ? () => onDelete(item) : undefined}
          onOpenSeries={onOpenSeries ? () => onOpenSeries(item) : undefined}
        />
      ))}
    </div>
  );
}

function MaintenanceReminderCard({
  item,
  showStatus,
  onEdit,
  onDelete,
  onOpenSeries,
}: {
  item: MaintenanceItem;
  showStatus: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onOpenSeries?: () => void;
}) {
  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onEdit) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onEdit();
    }
  };

  const recurrenceLabel = recurrenceIntervalLabel(item.recurrence_interval);
  const isRecurring = Boolean(item.recurrence_series_id);
  const notes = item.notes?.trim() || '';
  const metaParts = [
    formatIsoDate(item.scheduled_on),
    item.category || null,
    recurrenceLabel,
  ].filter(Boolean);

  const phoneActions = [
    ...(isRecurring && onOpenSeries
      ? [
          {
            key: 'series',
            label: 'View series',
            icon: <Repeat className="size-5" aria-hidden />,
            onSelect: () => onOpenSeries(),
          },
        ]
      : []),
    ...(onEdit
      ? [
          {
            key: 'edit',
            label: 'Edit',
            icon: <Pencil className="size-5" aria-hidden />,
            onSelect: () => onEdit(),
          },
        ]
      : []),
    ...(onDelete
      ? [
          {
            key: 'delete',
            label: 'Delete',
            icon: <Trash2 className="size-5" aria-hidden />,
            destructive: true,
            onSelect: () => onDelete(),
          },
        ]
      : []),
  ];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onEdit?.()}
      onKeyDown={handleKey}
      aria-label={`Edit reminder ${item.label}`}
      className={cn(
        'surface-card-interactive flex cursor-pointer flex-col overflow-hidden',
        'focus-visible:ring-sidebar-primary/40 outline-none focus-visible:ring-2',
        'sm:border-border/50 sm:bg-card sm:min-h-0 sm:rounded-xl sm:border sm:shadow-none',
        'sm:hover:border-border sm:transition-all sm:duration-200 sm:hover:-translate-y-0.5'
      )}
    >
      {/* Phone: title; status · meta; actions behind ⋯ */}
      <div className="px-3 py-2.5 sm:hidden">
        <div className="flex items-center gap-2">
          <p className="text-foreground min-w-0 flex-1 truncate text-[13px] font-semibold leading-tight">
            {item.label}
          </p>
          {phoneActions.length > 0 ? (
            <AdminListCardOverflowMenu
              label={`Actions for ${item.label}`}
              sheetTitle="Reminder"
              actions={phoneActions}
            />
          ) : null}
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-1.5">
          {showStatus && item.telegram_reminder_enabled ? (
            <MaintenanceStatusBadge isComplete={Boolean(item.completed_at)} />
          ) : null}
          <p className="text-muted-foreground min-w-0 flex-1 truncate text-[11px] leading-tight">
            {metaParts.join(' · ')}
          </p>
        </div>
      </div>

      {/* sm+: fixed slots so date / title / meta / notes align across the grid */}
      <div className="hidden h-full min-h-[11.5rem] flex-col sm:flex">
        <div className="flex min-h-0 flex-1 flex-col gap-2 px-4 pb-3 pt-4">
          <div className="flex min-h-[1.25rem] shrink-0 items-center justify-between gap-2">
            <p className="text-muted-foreground min-w-0 truncate text-[11px] font-medium leading-none tabular-nums">
              {formatIsoDate(item.scheduled_on)}
            </p>
            {showStatus && item.telegram_reminder_enabled ? (
              <MaintenanceStatusBadge isComplete={Boolean(item.completed_at)} />
            ) : null}
          </div>

          <div className="min-h-[1.25rem] min-w-0 shrink-0">
            {isRecurring && onOpenSeries ? (
              <button
                type="button"
                className="max-w-full text-left"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSeries();
                }}
              >
                <p className="text-foreground truncate text-sm font-bold leading-tight underline-offset-2 hover:underline">
                  {item.label}
                </p>
              </button>
            ) : (
              <p className="text-foreground truncate text-sm font-bold leading-tight">{item.label}</p>
            )}
          </div>

          <div className="flex min-h-[1.25rem] min-w-0 shrink-0 items-center gap-2 overflow-hidden">
            {recurrenceLabel ? (
              <span className="text-muted-foreground inline-flex max-w-[45%] shrink-0 items-center gap-1 truncate text-[10px] font-medium uppercase tracking-wide">
                <Repeat className="size-3 shrink-0" aria-hidden />
                {recurrenceLabel}
              </span>
            ) : null}
            {item.category ? (
              <p className="text-data-secondary min-w-0 flex-1 truncate text-xs leading-none">
                {item.category}
              </p>
            ) : null}
          </div>

          <div className="mt-auto min-h-[2.5rem]">
            {notes ? (
              <p className="text-data-secondary line-clamp-2 text-xs leading-snug">{notes}</p>
            ) : null}
          </div>
        </div>

        <div className="border-separator bg-muted/20 dark:bg-muted/30 flex shrink-0 justify-end border-t">
          {isRecurring && onOpenSeries ? (
            <CardIconAction
              label="View recurring series"
              onClick={(e) => {
                e.stopPropagation();
                onOpenSeries();
              }}
            >
              <Repeat className="size-4" />
            </CardIconAction>
          ) : null}
          {onEdit ? (
            <CardIconAction
              label="Edit"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Pencil className="size-4" />
            </CardIconAction>
          ) : null}
          {onDelete ? (
            <CardIconAction
              label="Delete"
              destructive
              edge="right"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="size-4" />
            </CardIconAction>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CardIconAction({
  label,
  onClick,
  destructive,
  edge,
  children,
}: {
  label: string;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  destructive?: boolean;
  edge?: 'left' | 'right';
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'text-muted-foreground hover:bg-muted/80 hover:text-foreground inline-flex min-h-[44px] min-w-[44px] items-center justify-center p-2.5 transition-colors',
        destructive && 'hover:bg-destructive/10 hover:text-destructive',
        edge === 'right' && 'rounded-br-xl'
      )}
    >
      {children}
    </button>
  );
}

export function MaintenanceStatusBadge({ isComplete }: { isComplete: boolean }) {
  if (isComplete) {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-1',
          compactStatusBadgeClasses('success')
        )}
      >
        <CheckCircle2 className="size-3 shrink-0" aria-hidden />
        Done
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1',
        compactStatusBadgeClasses('pending')
      )}
    >
      <Clock3 className="size-3 shrink-0" aria-hidden />
      Pending
    </span>
  );
}
