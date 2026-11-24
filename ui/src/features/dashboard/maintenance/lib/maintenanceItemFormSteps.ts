export type MaintenanceItemFormDetailsStep = {
  kind: 'details';
  id: 'details';
  label: string;
};

export type MaintenanceItemFormPreviewStep = {
  kind: 'preview';
  id: 'preview';
  label: string;
};

export type MaintenanceItemFormStep =
  MaintenanceItemFormDetailsStep | MaintenanceItemFormPreviewStep;

const DETAILS_STEP: MaintenanceItemFormDetailsStep = {
  kind: 'details',
  id: 'details',
  label: 'Details',
};

const PREVIEW_STEP: MaintenanceItemFormPreviewStep = {
  kind: 'preview',
  id: 'preview',
  label: 'Preview',
};

/**
 * Wizard steps for create/edit maintenance reminder: Details → Preview.
 *
 * The repeat + Telegram controls live in Details. They used to own a second step with two
 * controls, which added a tap (and a large empty panel) without adding clarity.
 */
export function buildMaintenanceItemFormSteps(): MaintenanceItemFormStep[] {
  return [DETAILS_STEP, PREVIEW_STEP];
}

export function maintenanceItemFormStepLabels(steps: readonly MaintenanceItemFormStep[]): string[] {
  return steps.map((step) => step.label);
}

export function clampMaintenanceItemFormStepIndex(index: number, stepCount: number): number {
  if (stepCount <= 0) return 0;
  return Math.min(Math.max(0, index), stepCount - 1);
}

export function findMaintenanceItemFormStepIndex(
  steps: readonly MaintenanceItemFormStep[],
  kind: MaintenanceItemFormStep['kind']
): number {
  return steps.findIndex((step) => step.kind === kind);
}

/** RHF field names to validate before leaving a step. */
export const MAINTENANCE_ITEM_STEP_FIELDS: Record<
  MaintenanceItemFormStep['kind'],
  readonly string[]
> = {
  details: [
    'label',
    'category',
    'scheduled_on',
    'notes',
    'recurrence_interval',
    'recurrence_until',
    'edit_scope',
    'telegram_reminder_enabled',
    'telegram_days_before',
    'telegram_reminder_interval',
    'telegram_message_template',
    'marked_complete',
  ],
  preview: [],
};
