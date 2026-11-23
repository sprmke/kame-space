import { expect } from '@playwright/test';

import { installConsoleMocks } from './adminAiConsoleHarness';

import type { Page, Route } from '@playwright/test';

const initialGlobalSettings = () => ({
  enabled: true,
  enforceQuotas: true,
  allowedFeatures: [],
  defaultDailyCallLimit: 200,
  defaultMonthlyCallLimit: 4000,
  defaultDailyCostUsdLimit: 12,
  creditUnitUsd: 0.0001,
  voiceReceptionistCostPerMinuteUsd: 0.06,
  voiceReceptionistRolloutPercentage: 100,
  voiceReceptionistRolloutPropertyIds: [],
  voiceReceptionistTranscriptRetentionDays: 30,
  voiceReceptionistHealthStatus: 'healthy',
  voiceReceptionistHealthCheckedAt: '2026-11-23T08:00:00.000Z',
  voiceReceptionistHealthFailureCode: null,
  voiceReceptionistHealthTokenMintMs: 812,
  voiceReceptionistHealthSetupMs: 1240,
  voiceReceptionistHealthModel: 'gemini-2.5-flash-native-audio',
  voiceReceptionistHealthProtocolVersion: 'v1beta',
  voiceReceptionistMetrics: null,
  updatedAt: '2026-11-20T10:00:00.000Z',
});

async function json(route: Route, data: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data }),
  });
}

/**
 * Super Admin → AI → Controls with a mutable global-settings mock, so a spec can assert how many
 * PATCHes a field sends and what they contain.
 */
export async function installAiControlsMocks(
  page: Page,
  patches: Array<Record<string, unknown>>
) {
  const settings = initialGlobalSettings();
  await installConsoleMocks(page);
  await page.route('**/functions/v1/ai-platform-global-settings**', async (route) => {
    if (route.request().method() === 'PATCH') {
      const body = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
      patches.push(body);
      Object.assign(settings, body);
      await json(route, settings);
      return;
    }
    await json(route, settings);
  });
  await page.route('**/functions/v1/dashboard-assistant-global-settings**', async (route) => {
    await json(route, {
      enabled: true,
      aiModeEnabled: false,
      agenticModeEnabled: false,
      planApprovalEnabled: true,
      guestActionsEnabled: false,
      updatedBy: null,
      updatedAt: '2026-11-20T10:00:00.000Z',
    });
  });
  await page.goto('/admin/ai?tab=controls');
  await expect(page.getByText('Platform AI', { exact: true })).toBeVisible({ timeout: 20_000 });
}
