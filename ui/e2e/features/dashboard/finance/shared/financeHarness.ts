import {
  installPropertyTeamRbacMocks,
  teamRbacPaths,
} from '../../../team/shared/propertyTeamRbacHarness';

import type { Page, Route } from '@playwright/test';

/**
 * Finance module harness.
 *
 * Layers deterministic finance fixtures over the shared property RBAC mocks so the
 * same page renders: a completed stay, a pending stay, a cancelled stay, a one-off
 * expense, a one-off income entry, and one recurring monthly expense. The previous
 * period returns a smaller summary so the "vs last period" deltas are stable.
 *
 * Every test pins the period to March 2026 so fixtures never drift with the clock.
 */

export const FINANCE_RANGE = { from: '2026-03-01', to: '2026-03-31' } as const;

export function financePath(extra = ''): string {
  const base = `${teamRbacPaths.finance}?from=${FINANCE_RANGE.from}&to=${FINANCE_RANGE.to}`;
  return extra ? `${base}&${extra}` : base;
}

export const FINANCE_SERIES_ID = 'series-finance-e2e-001';

export type FinanceMockCalls = {
  lineItemPosts: number;
  lineItemPatches: number;
  lineItemDeletes: number;
  summaryRequests: string[];
  seriesRequests: string[];
};

function lineItem(
  overrides: Partial<Record<string, unknown>> & {
    id: string;
    kind: 'expense' | 'income';
    label: string;
    amount: number;
    category: string;
    occurred_on: string;
  }
) {
  return {
    notes: null,
    receipt_path: null,
    recurrence_series_id: null,
    recurrence_interval: null,
    telegram_reminder_enabled: false,
    telegram_due_date: null,
    telegram_days_before: 3,
    telegram_reminder_interval: 'daily_noon',
    telegram_message_template: null,
    paid_at: null,
    created_by: null,
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-03-01T00:00:00.000Z',
    ...overrides,
  };
}

export function financeLineItemsFixture() {
  return [
    lineItem({
      id: 'fin-e2e-electricity',
      kind: 'expense',
      label: 'Electricity bill',
      amount: 2400,
      category: 'Utilities',
      occurred_on: '2026-03-05',
    }),
    lineItem({
      id: 'fin-e2e-guest-income',
      kind: 'income',
      label: 'Guest booking payment',
      amount: 3500,
      category: 'Guest Income',
      occurred_on: '2026-03-08',
      notes: 'Bank transfer',
    }),
    lineItem({
      id: 'fin-e2e-internet',
      kind: 'expense',
      label: 'Internet plan',
      amount: 1500,
      category: 'Utilities',
      occurred_on: '2026-03-10',
      recurrence_series_id: FINANCE_SERIES_ID,
      recurrence_interval: 'monthly',
      telegram_reminder_enabled: true,
      telegram_due_date: '2026-03-10',
      telegram_days_before: 3,
      telegram_reminder_interval: 'every_12_hours',
      telegram_message_template: 'Internet plan due',
    }),
  ];
}

export function financeRecurringSeriesFixture() {
  return [
    lineItem({
      id: 'fin-e2e-internet',
      kind: 'expense',
      label: 'Internet plan',
      amount: 1500,
      category: 'Utilities',
      occurred_on: '2026-03-10',
      recurrence_series_id: FINANCE_SERIES_ID,
      recurrence_interval: 'monthly',
    }),
    lineItem({
      id: 'fin-e2e-internet-apr',
      kind: 'expense',
      label: 'Internet plan',
      amount: 1500,
      category: 'Utilities',
      occurred_on: '2026-04-10',
      recurrence_series_id: FINANCE_SERIES_ID,
      recurrence_interval: 'monthly',
    }),
    lineItem({
      id: 'fin-e2e-internet-may',
      kind: 'expense',
      label: 'Internet plan',
      amount: 1500,
      category: 'Utilities',
      occurred_on: '2026-05-10',
      recurrence_series_id: FINANCE_SERIES_ID,
      recurrence_interval: 'monthly',
    }),
  ];
}

function stayRow(input: {
  id: string;
  guest: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  status: string;
  hostNet: number;
}) {
  return {
    id: input.id,
    guest_facebook_name: '',
    primary_guest_name: input.guest,
    guest_email: `${input.guest.split(' ')[0].toLowerCase()}@example.test`,
    valid_id_url: null,
    need_parking: false,
    has_pets: false,
    guest_requests_surprise_decor: null,
    check_in_date: input.checkIn,
    check_out_date: input.checkOut,
    number_of_nights: input.nights,
    status: input.status,
    status_updated_at: null,
    pricing: {
      check_in_date: input.checkIn,
      check_out_date: input.checkOut,
      number_of_nights: input.nights,
      nightly_rate: 2500,
      down_payment: 2000,
      additional_guest_fee: 0,
      pet_fee: 0,
      parking_fee: 0,
      security_deposit: 3000,
      total_guest_balance: Math.max(0, input.hostNet - 2000),
      source: 'direct',
    },
    financials: {
      bookingRate: input.hostNet,
      otherFees: 0,
      totalGuestBalance: input.hostNet,
      guestCollected: 2000,
      guestUnpaid: Math.max(0, input.hostNet - 2000),
      stayRevenue: input.hostNet,
      parkingMargin: null,
      sdExpenseTotal: 0,
      sdProfitTotal: 0,
      voucherCost: 0,
      hostProfit: input.hostNet,
      hostExpenses: 0,
      hostNet: input.hostNet,
    },
  };
}

export function financeBookingsFixture() {
  return [
    stayRow({
      id: 'booking-fin-e2e-completed',
      guest: 'Maria Santos',
      checkIn: '03-01-2026',
      checkOut: '03-03-2026',
      nights: 2,
      status: 'COMPLETED',
      hostNet: 5000,
    }),
    stayRow({
      id: 'booking-fin-e2e-pending',
      guest: 'Paolo Reyes',
      checkIn: '03-12-2026',
      checkOut: '03-15-2026',
      nights: 3,
      status: 'READY_FOR_CHECKIN',
      hostNet: 7000,
    }),
    stayRow({
      id: 'booking-fin-e2e-cancelled',
      guest: 'Ana Cruz',
      checkIn: '03-20-2026',
      checkOut: '03-22-2026',
      nights: 2,
      status: 'CANCELLED',
      hostNet: 0,
    }),
  ];
}

/** Current period: income 15,500 (3,500 operating + 5,000 completed + 7,000 pipeline). */
export function financeSummaryFixture(period: { from: string | null; to: string | null }) {
  return {
    period: { basis: 'check_in', from: period.from, to: period.to },
    stays: {
      count: 3,
      completedCount: 1,
      bookingRate: 12000,
      otherFees: 0,
      parkingMargin: 0,
      sdExpenses: 500,
      hostNetCompleted: 5000,
      projectedNetPipeline: 7000,
      outstandingGuestBalance: 4000,
    },
    operating: { income: 3500, expenses: 3900, net: -400 },
    grandNet: 11100,
  };
}

/** Comparable previous period: income 10,000, expenses 3,000. */
function financePreviousSummaryFixture(period: { from: string | null; to: string | null }) {
  return {
    period: { basis: 'check_in', from: period.from, to: period.to },
    stays: {
      count: 2,
      completedCount: 1,
      bookingRate: 7500,
      otherFees: 0,
      parkingMargin: 0,
      sdExpenses: 0,
      hostNetCompleted: 3000,
      projectedNetPipeline: 1000,
      outstandingGuestBalance: 0,
    },
    operating: { income: 6000, expenses: 3000, net: 3000 },
    grandNet: 7000,
  };
}

function readPositiveIntEnv(name: string): number {
  const raw = process.env[name];
  if (!raw) return 0;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * Hold on the current screen so a headed demo is watchable.
 * No-op unless `PLAYWRIGHT_DEMO_PAUSE_MS` is set (`test:e2e:finance:tour`).
 * `slowMo` alone only delays Playwright actions; navigations and assertions stay fast.
 */
export async function demoPause(page: Page, multiplier = 1): Promise<void> {
  const ms = readPositiveIntEnv('PLAYWRIGHT_DEMO_PAUSE_MS');
  if (!ms) return;
  await page.waitForTimeout(Math.round(ms * multiplier));
}

/**
 * Scroll a container in steps with a pause each step, so a recorded tour shows the
 * whole page instead of a jump cut.
 */
export async function demoScroll(
  page: Page,
  selector: string,
  options?: { step?: number; steps?: number }
): Promise<void> {
  const step = options?.step ?? 320;
  const steps = options?.steps ?? 6;
  await page.evaluate(
    async ({ selector: sel, step: stepSize, steps: count }) => {
      const target =
        document.querySelector(sel) ??
        (document.scrollingElement as HTMLElement | null) ??
        document.body;
      for (let i = 0; i < count; i += 1) {
        target.scrollBy({ top: stepSize, behavior: 'smooth' });
        await new Promise((resolve) => {
          window.setTimeout(resolve, 420);
        });
      }
      target.scrollTo({ top: 0, behavior: 'smooth' });
      await new Promise((resolve) => {
        window.setTimeout(resolve, 420);
      });
    },
    { selector, step, steps }
  );
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

/**
 * Installs the finance fixtures on top of the RBAC mocks.
 * Register order matters: these routes are added last, so they win over the shared ones.
 */
export async function installFinanceMocks(
  page: Page,
  options?: { permissions?: 'full_access' | 'read_only' }
): Promise<FinanceMockCalls> {
  const calls: FinanceMockCalls = {
    lineItemPosts: 0,
    lineItemPatches: 0,
    lineItemDeletes: 0,
    summaryRequests: [],
    seriesRequests: [],
  };

  await installPropertyTeamRbacMocks(page, options?.permissions ?? 'full_access');

  await page.route('**/functions/v1/finance-summary*', async (route) => {
    const url = new URL(route.request().url());
    const to = url.searchParams.get('to');
    calls.summaryRequests.push(url.search);
    const period = { from: url.searchParams.get('from'), to };
    // The page asks for the current period plus the period immediately before it.
    const summary =
      to === '2026-02-28' ? financePreviousSummaryFixture(period) : financeSummaryFixture(period);
    await fulfillJson(route, { success: true, data: summary });
  });

  await page.route('**/functions/v1/finance-bookings*', async (route) => {
    const rows = financeBookingsFixture();
    await fulfillJson(route, {
      success: true,
      data: rows,
      total: rows.length,
      page: 1,
      limit: 100,
    });
  });

  await page.route('**/functions/v1/finance-line-items*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (method === 'POST') {
      calls.lineItemPosts += 1;
      const body = request.postDataJSON() as Record<string, unknown>;
      await fulfillJson(route, {
        success: true,
        created_count: body.recurrence_interval ? 24 : 1,
        data: lineItem({
          id: 'fin-e2e-created',
          kind: (body.kind as 'expense' | 'income') ?? 'expense',
          label: String(body.label ?? 'New transaction'),
          amount: Number(body.amount ?? 0),
          category: String(body.category ?? ''),
          occurred_on: String(body.occurred_on ?? FINANCE_RANGE.from),
          notes: (body.notes as string | null) ?? null,
          recurrence_series_id: body.recurrence_interval ? FINANCE_SERIES_ID : null,
          recurrence_interval: (body.recurrence_interval as string | null) ?? null,
        }),
      });
      return;
    }

    if (method === 'PATCH') {
      calls.lineItemPatches += 1;
      const body = request.postDataJSON() as Record<string, unknown>;
      const existing = financeLineItemsFixture().find((item) => item.id === body.id) ?? null;
      await fulfillJson(route, {
        success: true,
        updated_count: 1,
        data: {
          ...(existing ?? financeLineItemsFixture()[0]),
          label: String(body.label ?? existing?.label ?? 'Updated transaction'),
          amount: Number(body.amount ?? existing?.amount ?? 0),
        },
      });
      return;
    }

    if (method === 'DELETE') {
      calls.lineItemDeletes += 1;
      await fulfillJson(route, { success: true, deleted_count: 1 });
      return;
    }

    const seriesId = url.searchParams.get('recurrence_series_id');
    if (seriesId) {
      calls.seriesRequests.push(url.search);
      await fulfillJson(route, { success: true, data: financeRecurringSeriesFixture() });
      return;
    }

    await fulfillJson(route, { success: true, data: financeLineItemsFixture() });
  });

  return calls;
}
