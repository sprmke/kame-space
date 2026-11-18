import type { CancelReason } from '@/features/dashboard/plans/lib/orgPlanApi';

/** Why a host leaves. Optional, single choice; feeds the platform's churn picture. */
export const CANCEL_REASON_OPTIONS: { value: CancelReason; label: string }[] = [
  { value: 'too_expensive', label: 'It costs too much' },
  { value: 'missing_features', label: 'It is missing something I need' },
  { value: 'fewer_properties', label: 'I have fewer properties now' },
  { value: 'switching_tool', label: 'I am switching to another tool' },
  { value: 'temporary', label: 'I only needed it for a while' },
  { value: 'other', label: 'Something else' },
];
