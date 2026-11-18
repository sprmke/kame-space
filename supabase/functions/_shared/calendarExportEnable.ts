/**
 * Two-way from the first minute: connecting a channel also starts sending our dates to it.
 * Pure orchestration with injected effects so the rule is unit-tested without a database.
 *
 * Plan: docs/workflow/in-progress/multi-channel-calendar-sync.md §21
 */

export type EnableExportOutcome = 'enabled' | 'already_on' | 'paused';

export interface EnableExportDeps {
  /** Whether date sharing is already on for the property. */
  isEnabled: () => Promise<boolean>;
  /** The super-admin switch for `pricing.channel_sync` is off. */
  isPaused: () => Promise<boolean>;
  enable: () => Promise<void>;
  /** Audit trail, called only after a successful enable. */
  record: () => Promise<void>;
}

export async function enableExportOnConnect(deps: EnableExportDeps): Promise<EnableExportOutcome> {
  if (await deps.isEnabled()) return 'already_on';
  if (await deps.isPaused()) return 'paused';
  await deps.enable();
  await deps.record();
  return 'enabled';
}
