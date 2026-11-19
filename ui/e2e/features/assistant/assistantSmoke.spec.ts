import { expect, test } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  openPropertyDashboard,
} from '../team/shared/propertyTeamRbacHarness';

import { openAssistantFromQuickAccess, quickAccessFab } from './shared/assistantQuickAccess';

test.describe('@smoke assistant shell', () => {
  test('assistant enabled loads bookings shell', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await installPropertyTeamRbacMocks(page, 'full_access', { assistantEnabled: true });
    page.on('pageerror', (err) => console.log('PAGEERROR', err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('CONSOLE', msg.text());
    });
    await openPropertyDashboard(page);
    await expect(quickAccessFab(page)).toBeVisible({ timeout: 20_000 });
    await openAssistantFromQuickAccess(page);
    await expect(page.getByRole('heading', { name: 'AI Assistant' })).toBeVisible({
      timeout: 20_000,
    });
  });
});
