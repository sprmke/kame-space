import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { useTelegramMaintenanceSettings } from '@/features/dashboard/bookings/hooks/useTelegramMaintenanceSettings';
import { CategoryCombobox } from '@/features/dashboard/finance/components/CategoryCombobox';
import { TelegramReminderSchedulePreview } from '@/features/dashboard/finance/components/TelegramReminderSchedulePreview';
import {
  countRecurrenceOccurrences,
  defaultRecurrenceUntil,
  FINANCE_REMINDER_INTERVAL_OPTIONS,
  normalizeFinanceReminderInterval,
  RECURRENCE_INTERVAL_OPTIONS,
  RECURRENCE_SCOPE_OPTIONS,
  isRecurrenceScheduleDirty,
} from '@/features/dashboard/finance/lib/recurrence';
import { MaintenanceItemFormPreview } from '@/features/dashboard/maintenance/components/MaintenanceItemFormPreview';
import { MAINTENANCE_CATEGORY_SUGGESTIONS } from '@/features/dashboard/maintenance/lib/maintenanceCategories';
import { canProceedMaintenanceItemFormStep } from '@/features/dashboard/maintenance/lib/maintenanceItemFormCanProceed';
import {
  buildMaintenanceItemFormSteps,
  clampMaintenanceItemFormStepIndex,
  MAINTENANCE_ITEM_STEP_FIELDS,
  maintenanceItemFormStepLabels,
} from '@/features/dashboard/maintenance/lib/maintenanceItemFormSteps';
import { manilaTodayIso } from '@/features/dashboard/maintenance/lib/maintenancePeriod';
import {
  MAINTENANCE_DEFAULT_REMINDER_TEMPLATE,
  maintenanceMessageTemplateForApi,
  maintenanceMessageTemplateForForm,
} from '@/features/dashboard/maintenance/lib/maintenanceReminderTemplate';
import type { MaintenanceItem } from '@/features/dashboard/maintenance/lib/types';

import { FormFieldBlock } from '@/components/forms/FormFieldBlock';
import { Checkbox } from '@/components/ui/checkbox';
import { IsoDateInput } from '@/components/ui/iso-date-input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WizardStepHeading } from '@/components/wizard/WizardStepHeading';
import { cn } from '@/lib/utils';

const schema = z
  .object({
    label: z.string().trim().min(1, 'Label is required').max(200),
    category: z.string().trim().min(1, 'Category is required').max(80),
    scheduled_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid date required'),
    notes: z.string().max(2000).optional(),
    recurrence_interval: z.enum([
      'none',
      'daily',
      'weekly',
      'monthly',
      'twice_monthly',
      'every_2_months',
      'quarterly',
      'every_6_months',
      'yearly',
    ]),
    recurrence_until: z.string().optional(),
    edit_scope: z.enum(['this', 'this_and_future', 'all']),
    telegram_reminder_enabled: z.boolean(),
    telegram_days_before: z.coerce.number().int().min(0).max(90),
    telegram_reminder_interval: z.enum([
      'hourly',
      'every_2_hours',
      'every_4_hours',
      'every_12_hours',
      'daily_noon',
    ]),
    telegram_message_template: z.string().max(4000).optional(),
    marked_complete: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.recurrence_interval !== 'none') {
      if (!data.recurrence_until?.match(/^\d{4}-\d{2}-\d{2}$/)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'End date required for recurring reminders',
          path: ['recurrence_until'],
        });
      } else if (data.recurrence_until < data.scheduled_on) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'End date must be on or after the start date',
          path: ['recurrence_until'],
        });
      }
    }
  });

export type MaintenanceItemFormValues = z.infer<typeof schema>;

export function telegramReminderPayloadFromForm(
  values: MaintenanceItemFormValues,
  globalDefaultMessageTemplate = MAINTENANCE_DEFAULT_REMINDER_TEMPLATE
) {
  return {
    telegram_reminder_enabled: values.telegram_reminder_enabled,
    telegram_due_date: values.telegram_reminder_enabled ? values.scheduled_on : null,
    telegram_days_before: values.telegram_days_before,
    telegram_reminder_interval: values.telegram_reminder_interval,
    telegram_message_template: maintenanceMessageTemplateForApi(
      values.telegram_message_template,
      values.telegram_reminder_enabled,
      globalDefaultMessageTemplate
    ),
    marked_complete: values.marked_complete,
  };
}

export type MaintenanceItemFormWizardState = {
  stepIndex: number;
  stepLabels: string[];
  isFirstStep: boolean;
  isLastStep: boolean;
  /** Current step fields are valid enough to advance (or submit on the last step). */
  canProceed: boolean;
};

export type MaintenanceItemFormHandle = {
  goNext: () => Promise<boolean>;
  goBack: () => void;
  /** Resolves true when validation passed and the submit handler did not report a failure. */
  submit: () => Promise<boolean>;
  getWizardState: () => MaintenanceItemFormWizardState;
};

type Props = {
  formId: string;
  initial?: MaintenanceItem | null;
  seriesRecurrenceUntil?: string | null;
  onSubmit: (values: MaintenanceItemFormValues) => void | boolean | Promise<boolean | void>;
  onWizardStateChange?: (state: MaintenanceItemFormWizardState) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

function defaultValues(
  initial: MaintenanceItem | null | undefined,
  globalDefaultMessageTemplate: string,
  seriesRecurrenceUntil?: string | null
): MaintenanceItemFormValues {
  const start = initial?.scheduled_on ?? manilaTodayIso();
  const interval = initial?.recurrence_interval ?? 'none';
  return {
    label: initial?.label ?? '',
    category: initial?.category ?? '',
    scheduled_on: start,
    notes: initial?.notes ?? '',
    recurrence_interval: interval === null ? 'none' : interval,
    recurrence_until:
      interval && interval !== 'none'
        ? (seriesRecurrenceUntil?.slice(0, 10) ?? defaultRecurrenceUntil(start, interval))
        : '',
    edit_scope: 'this',
    telegram_reminder_enabled: initial?.telegram_reminder_enabled ?? false,
    telegram_days_before: initial?.telegram_days_before ?? 3,
    telegram_reminder_interval: normalizeFinanceReminderInterval(
      initial?.telegram_reminder_interval
    ),
    telegram_message_template: maintenanceMessageTemplateForForm(
      initial?.telegram_message_template,
      globalDefaultMessageTemplate
    ),
    marked_complete: Boolean(initial?.completed_at),
  };
}

export const MaintenanceItemForm = forwardRef<MaintenanceItemFormHandle, Props>(
  function MaintenanceItemForm(
    { formId, initial, seriesRecurrenceUntil, onSubmit, onWizardStateChange, onDirtyChange },
    ref
  ) {
    const isRecurringEdit = Boolean(initial?.recurrence_series_id);
    const isEdit = Boolean(initial);
    const showRepeat = !isEdit || isRecurringEdit;
    const { data: maintenanceSettings } = useTelegramMaintenanceSettings();
    const globalDefaultMessageTemplate =
      maintenanceSettings?.defaultReminderTemplate ?? MAINTENANCE_DEFAULT_REMINDER_TEMPLATE;

    const [stepIndex, setStepIndex] = useState(0);
    const stepHeadingRef = useRef<HTMLHeadingElement>(null);

    const steps = useMemo(() => buildMaintenanceItemFormSteps(), []);
    const stepLabels = useMemo(() => maintenanceItemFormStepLabels(steps), [steps]);
    const safeStepIndex = clampMaintenanceItemFormStepIndex(stepIndex, steps.length);
    const activeStep = steps[safeStepIndex] ?? steps[0];
    const isFirstStep = safeStepIndex === 0;
    const isLastStep = safeStepIndex === steps.length - 1;

    const {
      register,
      control,
      handleSubmit,
      reset,
      watch,
      setValue,
      getValues,
      trigger,
      formState: { errors, isDirty },
    } = useForm<MaintenanceItemFormValues>({
      resolver: zodResolver(schema),
      mode: 'onTouched',
      reValidateMode: 'onChange',
      defaultValues: defaultValues(initial, globalDefaultMessageTemplate, seriesRecurrenceUntil),
    });

    useEffect(() => {
      reset(defaultValues(initial, globalDefaultMessageTemplate, seriesRecurrenceUntil), {
        keepDefaultValues: false,
      });
      setStepIndex(0);
    }, [initial, globalDefaultMessageTemplate, seriesRecurrenceUntil, reset]);

    useEffect(() => {
      onDirtyChange?.(isDirty);
    }, [isDirty, onDirtyChange]);

    useEffect(() => {
      const id = window.requestAnimationFrame(() => {
        stepHeadingRef.current?.focus();
      });
      return () => window.cancelAnimationFrame(id);
    }, [safeStepIndex]);

    const recurrenceInterval = watch('recurrence_interval');
    const recurrenceUntil = watch('recurrence_until') ?? '';
    const scheduledOn = watch('scheduled_on') ?? '';
    const telegramReminderEnabled = watch('telegram_reminder_enabled');
    const telegramDaysBefore = watch('telegram_days_before');
    const telegramReminderInterval = watch('telegram_reminder_interval');
    const previewValues = watch();

    const recurrenceCount = useMemo(() => {
      if (!showRepeat || recurrenceInterval === 'none') return 1;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(recurrenceUntil)) return 0;
      return countRecurrenceOccurrences(scheduledOn, recurrenceInterval, recurrenceUntil);
    }, [recurrenceInterval, recurrenceUntil, scheduledOn, showRepeat]);

    const canProceed = useMemo(() => {
      const stepKind = activeStep?.kind ?? 'details';
      return canProceedMaintenanceItemFormStep({
        stepKind,
        isLastStep,
        formValid: schema.safeParse(previewValues).success,
        label: String(previewValues.label ?? ''),
        category: String(previewValues.category ?? ''),
        scheduledOn: String(previewValues.scheduled_on ?? ''),
        recurrenceInterval: String(previewValues.recurrence_interval ?? 'none'),
        recurrenceUntil: String(previewValues.recurrence_until ?? ''),
        showRepeat,
      });
    }, [activeStep?.kind, isLastStep, previewValues, showRepeat]);

    useEffect(() => {
      onWizardStateChange?.({
        stepIndex: safeStepIndex,
        stepLabels,
        isFirstStep,
        isLastStep,
        canProceed,
      });
    }, [safeStepIndex, stepLabels, isFirstStep, isLastStep, canProceed, onWizardStateChange]);

    const scheduleDirty = isRecurrenceScheduleDirty({
      isRecurringEdit,
      recurrenceInterval,
      recurrenceUntil,
      initialInterval: initial?.recurrence_interval,
      initialUntil: seriesRecurrenceUntil,
    });

    const repeatOptions = RECURRENCE_INTERVAL_OPTIONS.filter(
      (opt) => !isRecurringEdit || opt.value !== 'none'
    );

    useEffect(() => {
      if (scheduleDirty && getValues('edit_scope') === 'this') {
        setValue('edit_scope', 'this_and_future');
      }
    }, [scheduleDirty, getValues, setValue]);

    useEffect(() => {
      if (!telegramReminderEnabled) return;
      const current = getValues('telegram_message_template')?.trim();
      if (!current) {
        setValue('telegram_message_template', globalDefaultMessageTemplate);
      }
    }, [telegramReminderEnabled, globalDefaultMessageTemplate, getValues, setValue]);

    useEffect(() => {
      if (!isEdit && recurrenceInterval !== 'none' && scheduledOn) {
        setValue('recurrence_until', defaultRecurrenceUntil(scheduledOn, recurrenceInterval));
      }
    }, [recurrenceInterval, scheduledOn, isEdit, setValue]);

    useImperativeHandle(
      ref,
      () => ({
        goNext: async () => {
          const fields = MAINTENANCE_ITEM_STEP_FIELDS[activeStep?.kind ?? 'details'];
          if (fields.length > 0) {
            const ok = await trigger(fields as (keyof MaintenanceItemFormValues)[]);
            if (!ok) return false;
          }
          setStepIndex((prev) => clampMaintenanceItemFormStepIndex(prev + 1, steps.length));
          return true;
        },
        goBack: () => {
          setStepIndex((prev) => clampMaintenanceItemFormStepIndex(prev - 1, steps.length));
        },
        submit: async () => {
          let saved = false;
          await handleSubmit(async (values) => {
            saved = (await onSubmit(values)) !== false;
          })();
          return saved;
        },
        getWizardState: () => ({
          stepIndex: safeStepIndex,
          stepLabels,
          isFirstStep,
          isLastStep,
          canProceed,
        }),
      }),
      [
        activeStep?.kind,
        canProceed,
        handleSubmit,
        isFirstStep,
        isLastStep,
        onSubmit,
        safeStepIndex,
        stepLabels,
        steps.length,
        trigger,
      ]
    );

    return (
      <form
        id={formId}
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (isLastStep) {
            void handleSubmit(onSubmit)(event);
          }
        }}
      >
        <WizardStepHeading
          title={activeStep?.label ?? 'Details'}
          headingRef={stepHeadingRef}
          className="mb-1"
        />

        {activeStep?.kind === 'details' ? (
          <div className="space-y-4">
            <FormFieldBlock label="Label" required error={errors.label?.message}>
              <input
                className="border-input bg-card text-foreground field-focus h-10 w-full rounded-lg border px-3 text-sm transition-colors"
                aria-invalid={errors.label ? true : undefined}
                aria-label="Label"
                {...register('label')}
              />
            </FormFieldBlock>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormFieldBlock label="Category" required error={errors.category?.message}>
                <Controller
                  name="category"
                  control={control}
                  render={({ field }) => (
                    <CategoryCombobox
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      invalid={Boolean(errors.category)}
                      suggestions={MAINTENANCE_CATEGORY_SUGGESTIONS}
                    />
                  )}
                />
              </FormFieldBlock>

              <FormFieldBlock label="Date" error={errors.scheduled_on?.message}>
                <Controller
                  name="scheduled_on"
                  control={control}
                  render={({ field }) => (
                    <IsoDateInput
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      aria-label="Scheduled date"
                      aria-invalid={errors.scheduled_on ? true : undefined}
                    />
                  )}
                />
              </FormFieldBlock>
            </div>

            <FormFieldBlock label="Notes" error={errors.notes?.message}>
              <textarea
                rows={3}
                className="border-input bg-card text-foreground field-focus w-full rounded-lg border px-3 py-2 text-sm transition-colors"
                aria-invalid={errors.notes ? true : undefined}
                aria-label="Notes"
                {...register('notes')}
              />
            </FormFieldBlock>

            {showRepeat ? (
              <div className="space-y-3">
                <FormFieldBlock label="Repeat" error={errors.recurrence_interval?.message}>
                  <Controller
                    name="recurrence_interval"
                    control={control}
                    render={({ field: { value, onChange } }) => (
                      <Select value={value} onValueChange={onChange}>
                        <SelectTrigger
                          aria-label="Repeat"
                          aria-invalid={errors.recurrence_interval ? true : undefined}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {repeatOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormFieldBlock>

                {recurrenceInterval !== 'none' ? (
                  <FormFieldBlock
                    label="Repeats until"
                    error={errors.recurrence_until?.message}
                    hint={
                      recurrenceCount >= 500
                        ? 'Creates 500 reminders (the maximum for one series).'
                        : recurrenceCount > 0
                          ? `Creates ${recurrenceCount} reminder${recurrenceCount === 1 ? '' : 's'}.`
                          : undefined
                    }
                  >
                    <Controller
                      name="recurrence_until"
                      control={control}
                      render={({ field }) => (
                        <IsoDateInput
                          {...field}
                          aria-label="Repeats until"
                          aria-invalid={errors.recurrence_until ? true : undefined}
                        />
                      )}
                    />
                  </FormFieldBlock>
                ) : null}
              </div>
            ) : null}

            {isEdit && isRecurringEdit ? (
              <fieldset className="space-y-2">
                <legend className="text-overline mb-1.5 block">Apply changes to</legend>
                {scheduleDirty ? (
                  <p className="text-muted-foreground text-caption -mt-1 mb-1.5">
                    A repeat schedule change can&apos;t apply to one occurrence only.
                  </p>
                ) : null}
                <Controller
                  name="edit_scope"
                  control={control}
                  render={({ field: { value, onChange } }) => (
                    <RadioGroup value={value} onValueChange={onChange} className="space-y-2">
                      {RECURRENCE_SCOPE_OPTIONS.filter(
                        (opt) => !scheduleDirty || opt.value !== 'this'
                      ).map((opt) => (
                        <label
                          key={opt.value}
                          className={cn(
                            'flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors',
                            value === opt.value
                              ? 'border-primary/40 bg-primary/5'
                              : 'border-border bg-muted/30 hover:bg-muted/50'
                          )}
                        >
                          <RadioGroupItem value={opt.value} className="mt-1" />
                          <span className="min-w-0">
                            <span className="text-foreground block text-sm font-semibold">
                              {opt.label}
                            </span>
                            <span className="text-caption text-muted-foreground mt-0.5 block">
                              {opt.description}
                            </span>
                          </span>
                        </label>
                      ))}
                    </RadioGroup>
                  )}
                />
              </fieldset>
            ) : null}

            {isEdit ? (
              <Controller
                name="marked_complete"
                control={control}
                render={({ field: { value, onChange, onBlur, name } }) => (
                  <label className="border-border/50 bg-muted/20 flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5">
                    <Checkbox
                      name={name}
                      checked={value}
                      onCheckedChange={onChange}
                      onBlur={onBlur}
                      className="mt-1"
                    />
                    <span className="min-w-0">
                      <span className="text-foreground block text-sm font-semibold">
                        Mark as done
                      </span>
                    </span>
                  </label>
                )}
              />
            ) : null}

            <fieldset className="border-border/50 bg-muted/20 space-y-3 rounded-xl border p-3">
              <legend className="sr-only">Telegram reminders</legend>
              <Controller
                name="telegram_reminder_enabled"
                control={control}
                render={({ field: { value, onChange, onBlur, name } }) => (
                  <label className="flex min-h-[44px] cursor-pointer items-start gap-3">
                    <Checkbox
                      name={name}
                      checked={value}
                      onCheckedChange={onChange}
                      onBlur={onBlur}
                      className="mt-1"
                    />
                    <span className="min-w-0">
                      <span className="text-foreground block text-sm font-semibold">
                        Telegram reminders
                      </span>
                    </span>
                  </label>
                )}
              />

              {telegramReminderEnabled ? (
                <div className="space-y-4">
                  <FormFieldBlock
                    label="Days before due"
                    error={errors.telegram_days_before?.message}
                  >
                    <input
                      type="number"
                      min={0}
                      max={90}
                      aria-label="Days before due"
                      className="border-input bg-card text-foreground field-focus h-10 w-full rounded-lg border px-3 text-sm"
                      aria-invalid={errors.telegram_days_before ? true : undefined}
                      {...register('telegram_days_before', { valueAsNumber: true })}
                    />
                  </FormFieldBlock>

                  <FormFieldBlock
                    label="How often to remind"
                    error={errors.telegram_reminder_interval?.message}
                  >
                    <Controller
                      name="telegram_reminder_interval"
                      control={control}
                      render={({ field: { value, onChange, onBlur } }) => (
                        <RadioGroup
                          value={value}
                          onValueChange={onChange}
                          className="space-y-2"
                          aria-label="How often to remind"
                        >
                          {FINANCE_REMINDER_INTERVAL_OPTIONS.map((opt) => (
                            <label
                              key={opt.value}
                              className={cn(
                                'flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors',
                                value === opt.value
                                  ? 'border-primary/40 bg-primary/5'
                                  : 'border-border bg-muted/30 hover:bg-muted/50'
                              )}
                            >
                              <RadioGroupItem value={opt.value} className="mt-1" onBlur={onBlur} />
                              <span className="min-w-0">
                                <span className="text-foreground block text-sm font-semibold">
                                  {opt.label}
                                </span>
                                <span className="text-caption text-muted-foreground mt-0.5 block">
                                  {opt.description}
                                </span>
                              </span>
                            </label>
                          ))}
                        </RadioGroup>
                      )}
                    />
                  </FormFieldBlock>

                  <TelegramReminderSchedulePreview
                    anchorDate={scheduledOn}
                    recurrenceInterval={recurrenceInterval}
                    recurrenceUntil={recurrenceUntil}
                    daysBefore={telegramDaysBefore}
                    reminderInterval={telegramReminderInterval}
                    singleOccurrenceOnly={isEdit}
                  />

                  <FormFieldBlock label="Message" error={errors.telegram_message_template?.message}>
                    <textarea
                      rows={5}
                      aria-label="Message"
                      className="border-input bg-card text-foreground field-focus w-full rounded-lg border px-3 py-2 font-mono text-xs"
                      aria-invalid={errors.telegram_message_template ? true : undefined}
                      {...register('telegram_message_template')}
                    />
                  </FormFieldBlock>
                </div>
              ) : null}
            </fieldset>
          </div>
        ) : null}

        {activeStep?.kind === 'preview' ? (
          <MaintenanceItemFormPreview
            values={previewValues}
            isEdit={isEdit}
            isRecurringEdit={isRecurringEdit}
            showRepeat={showRepeat}
          />
        ) : null}
      </form>
    );
  }
);
