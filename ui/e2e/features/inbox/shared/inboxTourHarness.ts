import {
  installPropertyTeamRbacMocks,
  TEAM_E2E_ORG_SLUG,
  TEAM_E2E_PROPERTY_SLUG,
} from '../../team/shared/propertyTeamRbacHarness';

import type { Page } from '@playwright/test';

export const INBOX_E2E_PATH = `/org/${TEAM_E2E_ORG_SLUG}/property/${TEAM_E2E_PROPERTY_SLUG}/messages`;

/** Holds the current screen so a headed tour is watchable. No-op unless the demo env is set. */
export async function demoPause(page: Page, multiplier = 1): Promise<void> {
  const raw = process.env.PLAYWRIGHT_DEMO_PAUSE_MS;
  const ms = raw ? Number.parseInt(raw, 10) : 0;
  if (!ms || !Number.isFinite(ms)) return;
  await page.waitForTimeout(Math.round(ms * multiplier));
}

/** Let a frozen-motion screen paint before a screenshot. Capture helper, not an assertion wait. */
export async function settleForCapture(page: Page, ms = 300): Promise<void> {
  await page.waitForTimeout(ms);
}

/** Consent storage only applies to the origin it was recorded on, so clear it explicitly. */
export async function dismissConsent(page: Page): Promise<void> {
  for (const name of ['Essential only', 'Necessary only', 'Accept all']) {
    const button = page.getByRole('button', { name });
    if (await button.isVisible().catch(() => false)) {
      await button.first().click();
      return;
    }
  }
}

/**
 * Host inbox with mock conversation data. `?mock=true` keeps the module on its
 * in-repo fixtures (`inboxMockData`) so a tour and the UX specs never depend on
 * a live Meta connection or local seed rows.
 */
export async function installInboxMocks(page: Page): Promise<void> {
  await installPropertyTeamRbacMocks(page, 'full_access', {
    // The team harness grants read/reply and Channels only; the inbox manage surface
    // needs the remaining leaves to exercise Quick replies and Automation.
    extraPermissions: [
      'inbox.quickReplies:add',
      'inbox.quickReplies:edit',
      'inbox.quickReplies:delete',
      'inbox.automation:edit',
    ],
  });
}
