import {
  EMPTY_SETUP_GUIDE_STATE,
  SETUP_GUIDE_STATE_VERSION,
  type SetupGuidePersistedState,
} from '@/features/dashboard/setup-guide/lib/setupGuideTypes';

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

function asNullableIso(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  return value;
}

/**
 * Reads `organizations.settings.setupGuide` into a typed state object.
 * Unknown / partial shapes degrade to empty defaults (never throw).
 */
export function readSetupGuidePersistedState(
  settings: Record<string, unknown> | null | undefined
): SetupGuidePersistedState {
  const raw = settings?.setupGuide;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...EMPTY_SETUP_GUIDE_STATE };
  }
  const v = raw as Record<string, unknown>;
  return {
    version: SETUP_GUIDE_STATE_VERSION,
    dismissedAt: asNullableIso(v.dismissedAt),
    completedAt: asNullableIso(v.completedAt),
    lastStepId: typeof v.lastStepId === 'string' && v.lastStepId ? v.lastStepId : null,
    skippedSteps: asStringArray(v.skippedSteps),
    reviewedSteps: asStringArray(v.reviewedSteps),
  };
}

/** Patch shape accepted by the future `setup-guide-state` edge function. */
export type SetupGuideStatePatch = Partial<{
  dismissedAt: string | null;
  completedAt: string | null;
  lastStepId: string | null;
  skippedSteps: string[];
  reviewedSteps: string[];
}>;

export function mergeSetupGuidePersistedState(
  current: SetupGuidePersistedState,
  patch: SetupGuideStatePatch | null | undefined
): SetupGuidePersistedState {
  // A success response with no `setupGuide` used to throw here, which surfaced as an
  // uncaught page error on any org page carrying a cached-but-empty state.
  const next = patch ?? {};
  return {
    version: SETUP_GUIDE_STATE_VERSION,
    dismissedAt: next.dismissedAt !== undefined ? next.dismissedAt : current.dismissedAt,
    completedAt: next.completedAt !== undefined ? next.completedAt : current.completedAt,
    lastStepId: next.lastStepId !== undefined ? next.lastStepId : current.lastStepId,
    skippedSteps: next.skippedSteps !== undefined ? next.skippedSteps : current.skippedSteps,
    reviewedSteps: next.reviewedSteps !== undefined ? next.reviewedSteps : current.reviewedSteps,
  };
}

const SESSION_SNOOZE_PREFIX = 'setup-guide:snooze:';

export function setupGuideSessionSnoozeKey(orgId: string): string {
  return `${SESSION_SNOOZE_PREFIX}${orgId}`;
}

export function isSetupGuideSessionSnoozed(orgId: string): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  try {
    return sessionStorage.getItem(setupGuideSessionSnoozeKey(orgId)) === '1';
  } catch {
    return false;
  }
}

export function setSetupGuideSessionSnoozed(orgId: string, snoozed: boolean): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const key = setupGuideSessionSnoozeKey(orgId);
    if (snoozed) sessionStorage.setItem(key, '1');
    else sessionStorage.removeItem(key);
  } catch {
    // Private mode / blocked storage — ignore.
  }
}
