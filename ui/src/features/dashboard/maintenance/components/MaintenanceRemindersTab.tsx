import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Pencil,
  Plus,
  RefreshCw,
  Repeat,
  Trash2,
  Wrench,
} from 'lucide-react';

import { EntityActivityHistory } from '@/features/dashboard/activity/components/EntityActivityHistory';
import {
  AdminDataTable,
  AdminTableActionsTh,
  AdminTableHeadRow,
  AdminTableTh,
  adminTableCell,
  adminTableIconButtonClass,
  adminTableRowClass,
  adminTableBodyText,
} from '@/features/dashboard/bookings/components/AdminDataTable';
import { AdminListPagination } from '@/features/dashboard/bookings/components/AdminListToolbar';
import { useTelegramMaintenanceSettings } from '@/features/dashboard/bookings/hooks/useTelegramMaintenanceSettings';
import {
  recurrenceIntervalLabel,
  recurrenceScheduleUpdateFields,
} from '@/features/dashboard/finance/lib/recurrence';
import {
  MaintenanceItemForm,
  telegramReminderPayloadFromForm,
  type MaintenanceItemFormHandle,
  type MaintenanceItemFormValues,
  type MaintenanceItemFormWizardState,
} from '@/features/dashboard/maintenance/components/MaintenanceItemForm';
import { MaintenanceRemindersCalendarView } from '@/features/dashboard/maintenance/components/MaintenanceRemindersCalendarView';
import {
  MaintenanceRemindersCardGrid,
  MaintenanceStatusBadge,
} from '@/features/dashboard/maintenance/components/MaintenanceRemindersCardGrid';
import { RecurringDeleteDialog } from '@/features/dashboard/maintenance/components/RecurringDeleteDialog';
import { RecurringSeriesModal } from '@/features/dashboard/maintenance/components/RecurringSeriesModal';
import { fetchRecurringSeriesItems } from '@/features/dashboard/maintenance/hooks/useMaintenanceApi';
import {
  useMaintenanceItemMutations,
  useMaintenanceItems,
} from '@/features/dashboard/maintenance/hooks/useMaintenanceItems';
import {
  filterMaintenanceItems,
  maintenanceReminderStatus,
  paginateMaintenanceItems,
  sortMaintenanceItems,
} from '@/features/dashboard/maintenance/lib/maintenanceReminders';
import { MAINTENANCE_DEFAULT_REMINDER_TEMPLATE } from '@/features/dashboard/maintenance/lib/maintenanceReminderTemplate';
import type { MaintenanceItem, MaintenanceQuery } from '@/features/dashboard/maintenance/lib/types';

import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import {
  FinanceOperatingTabSkeleton,
  FinanceStaysCardGridSkeleton,
} from '@/components/skeletons/AdminSkeletons';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { SegmentedStepProgress } from '@/components/wizard/SegmentedStepProgress';
import { WizardModalActions } from '@/components/wizard/WizardModalActions';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { buildPageItems } from '@/lib/table/pagination';
import { cn } from '@/lib/utils';
import { formatIsoDate } from '@/utils/format/bookingDisplay';

const REMINDER_FORM_ID = 'maintenance-reminder-form';

const INITIAL_WIZARD: MaintenanceItemFormWizardState = {
  stepIndex: 0,
  stepLabels: ['Details', 'Preview'],
  isFirstStep: true,
  isLastStep: false,
  canProceed: false,
};

type Props = {
  query: MaintenanceQuery;
  onQueryChange: (next: MaintenanceQuery) => void;
  /** Clears the date range and persists the explicit All dates choice. */
  onShowAllDates: () => void;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
  calendarInitialMonth?: Date;
  onCalendarMonthChange?: (month: Date) => void;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
};

export function MaintenanceRemindersTab({
  query,
  onQueryChange,
  onShowAllDates,
  createOpen,
  onCreateOpenChange,
  calendarInitialMonth,
  onCalendarMonthChange,
  canAdd = true,
  canEdit = true,
  canDelete = true,
}: Props) {
  const {
    data: items = [],
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useMaintenanceItems(query, {
    includeDueInRange: true,
  });
  const { create, update, remove, setDone } = useMaintenanceItemMutations(query);
  const { data: maintenanceSettings } = useTelegramMaintenanceSettings();
  const globalDefaultMessageTemplate =
    maintenanceSettings?.defaultReminderTemplate ?? MAINTENANCE_DEFAULT_REMINDER_TEMPLATE;
  const [modalOpen, setModalOpen] = useState(false);
  const [createSession, setCreateSession] = useState(0);
  const [editing, setEditing] = useState<MaintenanceItem | null>(null);
  const [editingSeriesUntil, setEditingSeriesUntil] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<MaintenanceItem | null>(null);
  const [seriesAnchor, setSeriesAnchor] = useState<MaintenanceItem | null>(null);
  const [wizard, setWizard] = useState<MaintenanceItemFormWizardState>(INITIAL_WIZARD);
  const [formDirty, setFormDirty] = useState(false);
  const formRef = useRef<MaintenanceItemFormHandle>(null);
  const submitPending = create.isPending || update.isPending;

  const handleWizardStateChange = useCallback((state: MaintenanceItemFormWizardState) => {
    setWizard(state);
  }, []);

  useEffect(() => {
    if (!modalOpen) {
      setWizard(INITIAL_WIZARD);
      setFormDirty(false);
    }
  }, [modalOpen]);

  function openCreate() {
    if (!canAdd) return;
    setEditing(null);
    setCreateSession((n) => n + 1);
    setModalOpen(true);
  }

  useEffect(() => {
    if (!createOpen) return;
    setEditing(null);
    setCreateSession((n) => n + 1);
    setModalOpen(true);
    onCreateOpenChange(false);
  }, [createOpen, onCreateOpenChange]);

  async function openEdit(item: MaintenanceItem) {
    if (!canEdit) return;
    setEditing(item);
    if (item.recurrence_series_id) {
      try {
        const rows = await fetchRecurringSeriesItems(item.recurrence_series_id);
        const last = rows[rows.length - 1];
        setEditingSeriesUntil(last?.scheduled_on ?? null);
      } catch {
        setEditingSeriesUntil(null);
      }
    } else {
      setEditingSeriesUntil(null);
    }
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setEditingSeriesUntil(null);
  }

  function openSeries(item: MaintenanceItem) {
    if (!item.recurrence_series_id) return;
    setSeriesAnchor(item);
  }

  function closeSeries() {
    setSeriesAnchor(null);
  }

  async function markDone(item: MaintenanceItem) {
    if (!canEdit || setDone.isPending) return;
    try {
      await setDone.mutateAsync({ item, done: true });
    } catch {
      /* toast handled by the mutation */
    }
  }

  async function handleSubmit(values: MaintenanceItemFormValues): Promise<boolean> {
    const payload = {
      label: values.label.trim(),
      category: values.category.trim(),
      scheduled_on: values.scheduled_on,
      notes: values.notes?.trim() || null,
      ...telegramReminderPayloadFromForm(values, globalDefaultMessageTemplate),
    };
    if (editing) {
      const schedule = recurrenceScheduleUpdateFields({
        hasSeries: Boolean(editing.recurrence_series_id),
        recurrenceInterval: values.recurrence_interval,
        recurrenceUntil: values.recurrence_until,
        initialInterval: editing.recurrence_interval,
        initialUntil: editingSeriesUntil,
        editScope: values.edit_scope,
      });
      try {
        await update.mutateAsync({
          id: editing.id,
          patch: {
            ...payload,
            ...(schedule.recurrence_interval !== undefined
              ? {
                  recurrence_interval: schedule.recurrence_interval,
                  recurrence_until: schedule.recurrence_until ?? null,
                }
              : {}),
          },
          scope: schedule.scope,
        });
        closeModal();
        return true;
      } catch {
        return false;
      }
    }
    try {
      await create.mutateAsync({
        ...payload,
        recurrence_interval:
          values.recurrence_interval === 'none' ? null : values.recurrence_interval,
        recurrence_until:
          values.recurrence_interval === 'none' ? null : (values.recurrence_until ?? null),
      });
      closeModal();
      return true;
    } catch {
      return false;
    }
  }

  const {
    onOpenChange: onGuardedOpenChange,
    requestClose,
    dialogProps,
  } = useGuardedClose({
    open: modalOpen,
    onOpenChange: (open) => {
      if (!open) closeModal();
    },
    isDirty: formDirty,
    onSave: async () => (await formRef.current?.submit()) ?? false,
  });

  const hasSearch = query.q.trim().length > 0;
  const hasActiveFilters =
    query.statusFilter.length > 0 ||
    query.categoryFilter.length > 0 ||
    query.telegramFilter !== 'all';
  const hasActiveQuery = hasSearch || hasActiveFilters;
  const hasDateRange = Boolean(query.from || query.to);
  const isMobileLayout = useIsBelowLg();
  const showCalendarView = query.view === 'calendar';
  const showTableView = query.view === 'table' && !isMobileLayout;
  const showCardView = query.view === 'card' || (isMobileLayout && query.view !== 'calendar');

  const allItems = items;
  const filteredItems = useMemo(() => filterMaintenanceItems(allItems, query), [allItems, query]);
  const sortedItems = useMemo(
    () => sortMaintenanceItems(filteredItems, query.sort),
    [filteredItems, query.sort]
  );
  const pagedItems = useMemo(() => {
    if (showCalendarView) {
      return { rows: sortedItems, total: sortedItems.length };
    }
    return paginateMaintenanceItems(sortedItems, query.page, query.limit);
  }, [sortedItems, query.page, query.limit, showCalendarView]);

  const displayItems = pagedItems.rows;
  const pageCount = Math.max(1, Math.ceil(pagedItems.total / query.limit));
  const pageItems = useMemo(() => buildPageItems(query.page, pageCount), [query.page, pageCount]);
  const showPagination = !showCalendarView && pageCount > 1;

  useEffect(() => {
    if (query.page <= pageCount) return;
    onQueryChange({ ...query, page: pageCount });
  }, [query, pageCount, onQueryChange]);

  if (isLoading && allItems.length === 0 && !showCalendarView) {
    if (showCardView) {
      return <FinanceStaysCardGridSkeleton />;
    }
    return <FinanceOperatingTabSkeleton />;
  }

  if (isError && allItems.length === 0) {
    return (
      <div className="border-border/50 bg-card flex flex-col items-center justify-center gap-3 rounded-xl border px-4 py-16 text-center">
        <div className="icon-well-sm bg-destructive/10 inline-flex items-center justify-center">
          <AlertCircle className="text-destructive size-[18px]" aria-hidden />
        </div>
        <p className="text-section-title text-foreground font-bold">Could not load reminders</p>
        <button
          type="button"
          className="border-border bg-card text-foreground hover:bg-muted inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold"
          onClick={() => void refetch()}
        >
          <RefreshCw className="size-4" aria-hidden />
          Try again
        </button>
      </div>
    );
  }

  const emptyState = (
    <EmptyState
      hasActiveQuery={hasActiveQuery}
      hasDateRange={hasDateRange}
      canAdd={canAdd}
      onAdd={openCreate}
      onClearFilters={() =>
        onQueryChange({
          ...query,
          page: 1,
          q: '',
          statusFilter: [],
          categoryFilter: [],
          telegramFilter: 'all',
        })
      }
      onShowAllDates={onShowAllDates}
    />
  );

  return (
    <div className="space-y-4">
      <p role="status" aria-live="polite" className="sr-only">
        {sortedItems.length} reminder{sortedItems.length === 1 ? '' : 's'} shown
      </p>

      {showCalendarView ? (
        <MaintenanceRemindersCalendarView
          items={sortedItems}
          isLoading={isLoading}
          isRefreshing={isFetching}
          initialMonth={calendarInitialMonth}
          onMonthChange={onCalendarMonthChange}
          onEdit={canEdit ? openEdit : undefined}
          onDelete={canDelete ? setDeleting : undefined}
          onOpenSeries={openSeries}
          onMarkDone={canEdit ? (item) => void markDone(item) : undefined}
        />
      ) : null}

      {showTableView ? (
        <AdminDataTable minWidth={520}>
          <AdminTableHeadRow>
            <AdminTableTh className="pl-4 pr-3 sm:pl-5">Date</AdminTableTh>
            <AdminTableTh className="px-3 sm:px-4">Label</AdminTableTh>
            <AdminTableTh className="hidden md:table-cell">Category</AdminTableTh>
            <AdminTableTh>Status</AdminTableTh>
            <AdminTableTh className="hidden xl:table-cell">Notes</AdminTableTh>
            <AdminTableActionsTh />
          </AdminTableHeadRow>
          <tbody>
            {displayItems.length === 0 ? (
              <tr>
                <td colSpan={6}>{emptyState}</td>
              </tr>
            ) : (
              displayItems.map((item, index) => {
                const status = maintenanceReminderStatus(item);
                return (
                  <tr key={item.id} className={adminTableRowClass(index, { interactive: false })}>
                    <td className={cn('whitespace-nowrap', adminTableCell.status)}>
                      <p className={adminTableBodyText.primary}>
                        {formatIsoDate(item.scheduled_on)}
                      </p>
                    </td>
                    <td className={adminTableCell.body}>
                      <div className="flex min-w-0 items-center gap-1.5">
                        {item.recurrence_series_id ? (
                          <button
                            type="button"
                            className="hover:text-primary focus-visible:ring-primary/30 max-w-[220px] rounded-md text-left transition-colors focus:outline-none focus-visible:ring-2"
                            onClick={() => openSeries(item)}
                          >
                            <p
                              title={item.label}
                              className={cn(
                                'truncate underline-offset-2 hover:underline',
                                adminTableBodyText.primary
                              )}
                            >
                              {item.label}
                            </p>
                          </button>
                        ) : (
                          <p
                            title={item.label}
                            className={cn('max-w-[220px] truncate', adminTableBodyText.primary)}
                          >
                            {item.label}
                          </p>
                        )}
                        {item.telegram_reminder_enabled ? (
                          <Bell
                            className="text-muted-foreground size-3 shrink-0"
                            aria-label="Telegram reminder on"
                          />
                        ) : null}
                      </div>
                      {item.recurrence_series_id ? (
                        <span className="text-muted-foreground mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide">
                          <Repeat className="size-3 shrink-0" aria-hidden />
                          {recurrenceIntervalLabel(item.recurrence_interval)}
                        </span>
                      ) : null}
                    </td>
                    <td
                      className={cn(
                        'hidden md:table-cell',
                        adminTableBodyText.secondary,
                        adminTableCell.body
                      )}
                    >
                      {item.category ?? '-'}
                    </td>
                    <td className={adminTableCell.body}>
                      <MaintenanceStatusBadge status={status} />
                    </td>
                    <td
                      className={cn(
                        'hidden max-w-[180px] truncate xl:table-cell',
                        adminTableBodyText.secondary,
                        adminTableCell.body
                      )}
                    >
                      {item.notes ?? '-'}
                    </td>
                    <td className={adminTableCell.action}>
                      <div className="flex justify-end gap-0.5">
                        {canEdit && status !== 'completed' ? (
                          <button
                            type="button"
                            className={cn(
                              adminTableIconButtonClass,
                              'hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-300'
                            )}
                            aria-label={`Mark ${item.label} done`}
                            title="Mark done"
                            onClick={() => void markDone(item)}
                          >
                            <CheckCircle2 className="size-4" />
                          </button>
                        ) : null}
                        {canEdit ? (
                          <button
                            type="button"
                            className={adminTableIconButtonClass}
                            aria-label="Edit"
                            title="Edit"
                            onClick={() => openEdit(item)}
                          >
                            <Pencil className="size-4" />
                          </button>
                        ) : null}
                        {canDelete ? (
                          <button
                            type="button"
                            className={cn(
                              adminTableIconButtonClass,
                              'hover:bg-destructive/10 hover:text-destructive'
                            )}
                            aria-label="Delete"
                            title="Delete"
                            onClick={() => setDeleting(item)}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </AdminDataTable>
      ) : null}

      {showCardView ? (
        displayItems.length === 0 ? (
          emptyState
        ) : (
          <MaintenanceRemindersCardGrid
            items={displayItems}
            isLoading={isLoading}
            isRefreshing={isFetching}
            onEdit={canEdit ? openEdit : undefined}
            onDelete={canDelete ? setDeleting : undefined}
            onOpenSeries={openSeries}
            onMarkDone={canEdit ? (item) => void markDone(item) : undefined}
          />
        )
      ) : null}

      {showPagination ? (
        <AdminListPagination
          ariaLabel="Reminders pagination"
          page={query.page}
          pageCount={pageCount}
          pageItems={pageItems}
          onPageChange={(page) => onQueryChange({ ...query, page })}
        />
      ) : null}

      <ResponsiveModal open={modalOpen} onOpenChange={onGuardedOpenChange}>
        <ResponsiveModalContent
          sheetLayout="split"
          className="flex max-h-[min(90dvh,44rem)] max-w-[min(calc(100vw-1.5rem),34rem)] flex-col gap-0 overflow-hidden p-0 max-lg:h-[min(92dvh,44rem)] sm:max-w-[min(calc(100vw-2rem),36rem)] sm:p-0"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onPointerDownOutside={(e) => {
            const target = e.target as Element | null;
            if (target?.closest('[data-radix-popper-content-wrapper]')) {
              e.preventDefault();
              return;
            }
            if (submitPending) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (submitPending) e.preventDefault();
          }}
        >
          <ResponsiveModalHeader className="border-border shrink-0 space-y-0 border-b px-4 pb-3 pt-[max(env(safe-area-inset-top,0px),1rem)] text-left sm:px-5 sm:pt-5">
            <ResponsiveModalTitle>
              {editing ? 'Edit reminder' : 'Add reminder'}
            </ResponsiveModalTitle>
            {wizard.stepLabels.length > 1 ? (
              <nav aria-label="Reminder steps" className="mt-3">
                <SegmentedStepProgress
                  labels={wizard.stepLabels}
                  currentIndex={wizard.stepIndex}
                  ariaLabel="Reminder steps"
                />
              </nav>
            ) : null}
          </ResponsiveModalHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            <MaintenanceItemForm
              ref={formRef}
              formId={REMINDER_FORM_ID}
              key={
                editing
                  ? `${editing.id}:${editing.telegram_reminder_interval}`
                  : `new-${createSession}`
              }
              initial={editing}
              seriesRecurrenceUntil={editingSeriesUntil}
              onSubmit={handleSubmit}
              onWizardStateChange={handleWizardStateChange}
              onDirtyChange={setFormDirty}
            />
            {editing && wizard.isLastStep ? (
              <EntityActivityHistory
                targetType="maintenance_item"
                targetId={editing.id}
                className="border-border/60 mt-5 border-t pt-4"
                initialLimit={4}
              />
            ) : null}
          </div>
          <ResponsiveModalFooter className="border-border shrink-0 border-t px-4 py-3 sm:px-5">
            <WizardModalActions
              onCancel={requestClose}
              onBack={() => formRef.current?.goBack()}
              onNext={() => {
                void formRef.current?.goNext();
              }}
              onSubmit={() => formRef.current?.submit()}
              isFirstStep={wizard.isFirstStep}
              isLastStep={wizard.isLastStep}
              submitPending={submitPending}
              submitLabel={editing ? 'Save' : 'Add reminder'}
              pendingLabel={editing ? 'Saving…' : 'Adding…'}
              canGoNext={wizard.canProceed}
              canSubmit={wizard.canProceed}
            />
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <UnsavedChangesDialog {...dialogProps} />

      <RecurringSeriesModal
        anchor={seriesAnchor}
        open={seriesAnchor != null}
        onClose={closeSeries}
        query={query}
        canEdit={canEdit}
        canDelete={canDelete}
      />

      <RecurringDeleteDialog
        item={deleting}
        open={deleting != null}
        onClose={() => setDeleting(null)}
        isPending={remove.isPending}
        onConfirm={(scope) => {
          if (!deleting) return;
          remove.mutate({ id: deleting.id, scope }, { onSuccess: () => setDeleting(null) });
        }}
      />
    </div>
  );
}

function EmptyState({
  hasActiveQuery,
  hasDateRange,
  canAdd,
  onAdd,
  onClearFilters,
  onShowAllDates,
}: {
  hasActiveQuery: boolean;
  hasDateRange: boolean;
  canAdd: boolean;
  onAdd: () => void;
  onClearFilters: () => void;
  onShowAllDates: () => void;
}) {
  const title = hasActiveQuery
    ? 'No reminders match your filters'
    : hasDateRange
      ? 'No reminders in this period'
      : 'No reminders yet';

  const action = hasActiveQuery
    ? { label: 'Clear filters', onClick: onClearFilters, icon: RefreshCw }
    : hasDateRange
      ? { label: 'View all dates', onClick: onShowAllDates, icon: RefreshCw }
      : canAdd
        ? { label: 'Add reminder', onClick: onAdd, icon: Plus }
        : null;

  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <div className="icon-well-sm bg-muted/80 inline-flex items-center justify-center">
        <Wrench className="text-muted-foreground size-[18px]" aria-hidden />
      </div>
      <p className="text-section-title text-foreground font-bold">{title}</p>
      {action ? (
        <button
          type="button"
          className={cn(
            'mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4',
            'gradient-primary text-primary-foreground shadow-soft text-[13px] font-semibold'
          )}
          onClick={action.onClick}
        >
          <action.icon className="size-4" aria-hidden />
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
