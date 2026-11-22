import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import {
  installLiveBrowserMocks,
  installVoiceReceptionistMocks,
  VOICE_CHAT_PATH,
} from './shared/voiceReceptionistHarness';
import {
  expectNoPageHorizontalOverflow,
  expectNoUnnamedInteractiveControls,
} from '../../shared/layoutAssertions';
import { installConsoleMocks } from '../admin/shared/adminAiConsoleHarness';
import {
  installPropertyTeamRbacMocks,
  TEAM_E2E_ORG_SLUG,
} from '../team/shared/propertyTeamRbacHarness';

import type { Page, Route } from '@playwright/test';

/**
 * Slow-motion visual walkthrough for the AI receptionist.
 *
 * Lane: `@demo` (headed, never CI). Run it with:
 *
 *   PLAYWRIGHT_RECORD_VIDEO=1 PLAYWRIGHT_SLOW_MO=350 \
 *     bunx playwright test ui/e2e/features/guest-chat/aiReceptionistWalkthrough.spec.ts \
 *     --project=chromium
 *
 * Screenshots land in `test-results/ai-receptionist-audit/` (override with
 * `AI_RECEPTIONIST_SHOTS`). Every image is referenced by
 * `docs/workflow/for-testing/ai-receptionist-uiux-audit.md`.
 *
 * Behavioural coverage lives in `voiceReceptionistConsent.spec.ts` (the smoke lane). This spec
 * exists to make the interface reviewable at every state and every breakpoint, so it deliberately
 * paces itself.
 */

const SHOT_DIR = path.resolve(
  process.cwd(),
  process.env.AI_RECEPTIONIST_SHOTS ?? 'test-results/ai-receptionist-audit'
);
mkdirSync(SHOT_DIR, { recursive: true });

/** Deliberate pacing for the recorded walkthrough. Not a synchronisation wait. */
const beat = (ms = 420) => new Promise((resolve) => setTimeout(resolve, ms));

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), animations: 'disabled' });
}

async function setMicLevel(page: Page, level: number) {
  await page.evaluate((value) => {
    (window as unknown as { __mockMicLevel?: number }).__mockMicLevel = value;
  }, level);
}

async function sendTurn(page: Page, text: string) {
  await page.evaluate((value) => {
    const send = (window as unknown as { __aiQaVoiceSend?: (text: string) => boolean })
      .__aiQaVoiceSend;
    if (!send) throw new Error('Voice test hook __aiQaVoiceSend is missing');
    send(value);
  }, text);
}

const GLOBAL_VOICE_SETTINGS = {
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
  voiceReceptionistMetrics: {
    days: 7,
    sessions: 148,
    startupMs: { p50: 1180, p95: 2140 },
    firstAudioMs: { p50: 1460, p95: 2870 },
    toolMs: { p50: 640, p95: 1310 },
    sessionSeconds: { p50: 96, p95: 241 },
    reconnects: { p50: 0, p95: 1 },
    completionRatePct: 91.2,
    alerts: {},
  },
  updatedAt: '2026-11-20T10:00:00.000Z',
};

test.describe.configure({ timeout: 150_000 });

test.describe('@demo AI receptionist walkthrough', () => {
  test('guest calls the receptionist and returns to the thread', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await installVoiceReceptionistMocks(page, { liveSession: true, toolDelayMs: 2600 });
    await installLiveBrowserMocks(page, { staged: true });

    await page.goto(VOICE_CHAT_PATH);
    await expect(page.getByRole('button', { name: 'Chat options' })).toBeVisible({
      timeout: 20_000,
    });
    await beat();
    await shot(page, '01-chat-1440');

    await page.getByRole('button', { name: 'Chat options' }).click();
    await expect(page.getByText('Talk to receptionist', { exact: true })).toBeVisible();
    await beat(250);
    await shot(page, '02-chat-menu-1440');

    await page.getByText('Talk to receptionist', { exact: true }).click();
    await expect(page.getByRole('heading', { name: 'AI voice receptionist' })).toBeVisible();
    await beat();
    await shot(page, '03-disclosure-1440');

    await page.getByRole('button', { name: 'Start call' }).click();
    await expect(
      page
        .getByTestId('voice-caption')
        .filter({ hasText: 'Hi, I am Kame. Ask me anything about your stay.' })
    ).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Speaking', { exact: true })).toBeVisible();
    await expectNoUnnamedInteractiveControls(page);
    await expectNoPageHorizontalOverflow(page);
    await beat(700);
    await shot(page, '04-greeting-1440');

    await expect(page.getByText('Listening', { exact: true })).toBeVisible({ timeout: 10_000 });
    await beat(500);
    await shot(page, '05-listening-1440');

    await setMicLevel(page, 0.4);
    await expect(page.getByText("You're speaking", { exact: true })).toBeVisible();
    await beat(700);
    await shot(page, '06-you-are-speaking-1440');

    await setMicLevel(page, 0);
    await expect(page.getByText('Thinking…', { exact: true })).toBeVisible({ timeout: 5_000 });
    await beat(700);
    await shot(page, '07-thinking-1440');

    await sendTurn(page, 'What time is the pool open?');
    await expect(
      page
        .getByTestId('voice-caption')
        .filter({ hasText: 'The pool is open from 6 AM to 9 PM daily.' })
    ).toBeVisible();
    await expect(page.getByText('Speaking', { exact: true })).toBeVisible();
    await beat(800);
    await shot(page, '08-speaking-1440');

    await expect(page.getByText('Listening', { exact: true })).toBeVisible({ timeout: 10_000 });
    await sendTurn(page, 'Where can I park?');
    await expect(
      page
        .getByTestId('voice-caption')
        .filter({ hasText: 'Let me check the parking details for you.' })
    ).toBeVisible();
    await expect(page.getByText('Looking that up…', { exact: true })).toBeVisible();
    await beat(700);
    await shot(page, '09-looking-up-1440');

    await expect(page.getByRole('link', { name: 'Open property' })).toBeVisible({
      timeout: 10_000,
    });
    await beat(500);
    await shot(page, '10-actions-1440');

    await page.getByRole('button', { name: 'End call' }).click();
    await expect(page.getByText('Call ended', { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Delete captions' })).toBeVisible();
    await beat(600);
    await shot(page, '11-call-ended-1440');

    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByText('Listening', { exact: true })).toHaveCount(0);
    await beat(500);
    await shot(page, '12-back-to-thread-1440');
  });

  test('the booth at every breakpoint', async ({ page }) => {
    await installVoiceReceptionistMocks(page, { liveSession: true, toolDelayMs: 2600 });
    await installLiveBrowserMocks(page, { staged: true });

    const viewports = [
      { name: '375', width: 375, height: 812 },
      { name: '768', width: 768, height: 1024 },
      { name: '1024', width: 1024, height: 768 },
      { name: '1440', width: 1440, height: 960 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(VOICE_CHAT_PATH);
      await expect(page.getByRole('button', { name: 'Chat options' })).toBeVisible({
        timeout: 20_000,
      });
      await page.getByRole('button', { name: 'Chat options' }).click();
      await page.getByText('Talk to receptionist', { exact: true }).click();
      await expect(page.getByRole('heading', { name: 'AI voice receptionist' })).toBeVisible();
      await beat(350);
      await shot(page, `20-disclosure-${viewport.name}`);
      await expectNoPageHorizontalOverflow(page);

      await page.getByRole('button', { name: 'Start call' }).click();
      await expect(page.getByText('Listening', { exact: true })).toBeVisible({ timeout: 20_000 });
      await sendTurn(page, 'What time is the pool open?');
      await expect(
        page
          .getByTestId('voice-caption')
          .filter({ hasText: 'The pool is open from 6 AM to 9 PM daily.' })
      ).toBeVisible();
      await beat(700);
      await shot(page, `21-in-call-${viewport.name}`);
      await expectNoPageHorizontalOverflow(page);

      await page.getByRole('button', { name: 'End call' }).click();
      await expect(page.getByRole('button', { name: 'Done' })).toBeVisible({ timeout: 20_000 });
      await setMicLevel(page, 0);
    }
  });

  test('dark theme booth', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await installVoiceReceptionistMocks(page, { liveSession: true });
    await installLiveBrowserMocks(page);
    await page.goto(VOICE_CHAT_PATH);
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.getByRole('button', { name: 'Chat options' }).click();
    await page.getByText('Talk to receptionist', { exact: true }).click();
    await expect(page.getByRole('heading', { name: 'AI voice receptionist' })).toBeVisible();
    await beat(400);
    await shot(page, '30-disclosure-dark-1440');
    await page.getByRole('button', { name: 'Start call' }).click();
    await expect(page.getByText('Listening', { exact: true })).toBeVisible({ timeout: 20_000 });
    await beat(600);
    await shot(page, '31-in-call-dark-1440');
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
  });

  test('failure states: blocked microphone and provider outage', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await installVoiceReceptionistMocks(page, { providerUnavailable: true });
    await installLiveBrowserMocks(page);

    await page.goto(VOICE_CHAT_PATH);
    await page.getByRole('button', { name: 'Chat options' }).click();
    await page.getByText('Talk to receptionist', { exact: true }).click();
    await page.getByRole('button', { name: 'Start call' }).click();
    await expect(page.getByRole('alert')).toContainText('temporarily unavailable');
    await beat(400);
    await shot(page, '40-provider-unavailable-1440');

    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: () => Promise.reject(new DOMException('Denied', 'NotAllowedError')),
        },
      });
    });
    await page.goto(VOICE_CHAT_PATH);
    await page.getByRole('button', { name: 'Chat options' }).click();
    await page.getByText('Talk to receptionist', { exact: true }).click();
    await page.getByRole('button', { name: 'Start call' }).click();
    await expect(page.getByRole('alert')).toContainText('Microphone access is blocked');
    await beat(400);
    await shot(page, '41-microphone-blocked-1440');
  });

  test('host controls: org AI features and the super-admin kill switch', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await installPropertyTeamRbacMocks(page, 'full_access', { orgHub: true, multiProperty: true });
    await page.goto(`/org/${TEAM_E2E_ORG_SLUG}/settings`);
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible({
      timeout: 20_000,
    });
    const aiSection = page.locator('#section-ai');
    await aiSection.scrollIntoViewIfNeeded();
    await expect(page.getByText('Voice receptionist', { exact: true })).toBeVisible();
    await page.getByText('Dashboard assistant', { exact: true }).scrollIntoViewIfNeeded();
    await beat(400);
    await shot(page, '50-org-assistant-group-1440');
    await page.getByText('Voice receptionist', { exact: true }).scrollIntoViewIfNeeded();
    await beat(400);
    await shot(page, '51-org-voice-group-1440');
    await expectNoUnnamedInteractiveControls(page);

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/org/${TEAM_E2E_ORG_SLUG}/settings`);
    await aiSection.scrollIntoViewIfNeeded();
    await expect(page.getByText('Voice receptionist', { exact: true })).toBeVisible();
    await page.getByText('Voice receptionist', { exact: true }).scrollIntoViewIfNeeded();
    await beat(400);
    await shot(page, '52-org-voice-group-375');
    await expectNoPageHorizontalOverflow(page);

    await page.setViewportSize({ width: 1440, height: 960 });
    await installConsoleMocks(page);
    await page.route('**/functions/v1/ai-platform-global-settings**', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: GLOBAL_VOICE_SETTINGS }),
      });
    });
    await page.goto('/admin/ai?tab=controls');
    await expect(page.getByText('Platform AI', { exact: true })).toBeVisible({ timeout: 20_000 });
    await beat(500);
    await shot(page, '53-super-admin-platform-ai-top-1440');
    await page.getByText('Voice retention (days)').scrollIntoViewIfNeeded();
    await beat(400);
    await shot(page, '54-super-admin-platform-ai-bottom-1440');
    await expectNoUnnamedInteractiveControls(page);

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/admin/ai?tab=controls');
    await expect(page.getByText('Platform AI', { exact: true })).toBeVisible({ timeout: 20_000 });
    await beat(500);
    await shot(page, '55-super-admin-platform-ai-375');
    await page.getByText('Voice receptionist', { exact: true }).last().scrollIntoViewIfNeeded();
    await beat(400);
    await shot(page, '56-super-admin-features-375');
    await expectNoPageHorizontalOverflow(page);
  });
});
