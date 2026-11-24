import type { Page, Route } from '@playwright/test';

/**
 * Stateful mocks for the property Maintenance workspace.
 *
 * `maintenance-items` is the only source of truth here: POST / PATCH / DELETE mutate the
 * in-memory list and the summary is recomputed from it, so a create really adds a row and a
 * delete really removes one. That keeps the module tour watchable instead of showing a
 * reminder appear and then vanish when the refetch returns the static fixture.
 */

export type MaintenanceItemFixture = {
  id: string;
  label: string;
  category: string | null;
  scheduled_on: string;
  notes: string | null;
  recurrence_series_id: string | null;
  recurrence_interval: string | null;
  telegram_reminder_enabled: boolean;
  telegram_due_date: string | null;
  telegram_days_before: number;
  telegram_reminder_interval: string;
  telegram_message_template: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const MAINTENANCE_ITEMS_PATH = '**/functions/v1/maintenance-items**';
export const MAINTENANCE_SUMMARY_PATH = '**/functions/v1/maintenance-summary**';
export const MAINTENANCE_ACTIVITY_PATH = '**/functions/v1/list-activity-log**';

export function maintenanceItem(
  overrides: Partial<MaintenanceItemFixture> = {}
): MaintenanceItemFixture {
  return {
    id: 'rem-1',
    label: 'Aircon filter service',
    category: 'Aircon',
    scheduled_on: '2026-11-28',
    notes: 'Replace the washable filter.',
    recurrence_series_id: null,
    recurrence_interval: null,
    telegram_reminder_enabled: false,
    telegram_due_date: null,
    telegram_days_before: 3,
    telegram_reminder_interval: 'daily_noon',
    telegram_message_template: null,
    completed_at: null,
    created_by: 'owner@example.com',
    created_at: '2026-11-01T08:00:00.000Z',
    updated_at: '2026-11-01T08:00:00.000Z',
    ...overrides,
  };
}

/** One pending one-off, one completed Telegram reminder, one recurring pending reminder. */
export const MAINTENANCE_FIXTURES: MaintenanceItemFixture[] = [
  maintenanceItem(),
  maintenanceItem({
    id: 'rem-2',
    label: 'Pool pump inspection',
    category: 'Pool',
    scheduled_on: '2026-11-26',
    notes: null,
    telegram_reminder_enabled: true,
    telegram_due_date: '2026-11-26',
    completed_at: '2026-11-20T04:00:00.000Z',
  }),
  maintenanceItem({
    id: 'rem-3',
    label: 'Deep clean kitchen',
    category: 'Cleaning',
    scheduled_on: '2026-11-20',
    notes: null,
    recurrence_series_id: 'series-1',
    recurrence_interval: 'monthly',
    telegram_reminder_enabled: true,
    telegram_due_date: '2026-11-20',
  }),
];

export function summarizeMaintenance(items: MaintenanceItemFixture[]) {
  const byCategory = new Map<string, number>();
  for (const item of items) {
    const category = item.category?.trim();
    if (!category) continue;
    byCategory.set(category, (byCategory.get(category) ?? 0) + 1);
  }
  const completed = items.filter((item) => item.completed_at).length;
  return {
    period: { from: '2026-11-01', to: '2026-11-30' },
    total: items.length,
    telegramEnabled: items.filter((item) => item.telegram_reminder_enabled).length,
    completed,
    pending: items.length - completed,
    byCategory: [...byCategory.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, count]) => ({ category, count })),
  };
}

const json = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

export async function installMaintenanceMocks(
  page: Page,
  options: { items?: MaintenanceItemFixture[] } = {}
) {
  const items = (options.items ?? MAINTENANCE_FIXTURES).map((item) => ({ ...item }));
  let creates = 0;

  await page.route(MAINTENANCE_SUMMARY_PATH, (route) =>
    json(route, { success: true, data: summarizeMaintenance(items) })
  );

  await page.route(MAINTENANCE_ITEMS_PATH, (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'GET') {
      if (url.searchParams.get('recurrence_series_id')) {
        const seriesId = url.searchParams.get('recurrence_series_id');
        return json(route, {
          success: true,
          data: items.filter((item) => item.recurrence_series_id === seriesId),
        });
      }
      return json(route, { success: true, data: items });
    }

    const body = JSON.parse(request.postData() ?? '{}');

    if (request.method() === 'POST') {
      if (body.action === 'extend_series') {
        return json(route, { success: true, data: [], created_count: 0 });
      }
      creates += 1;
      const row = maintenanceItem({
        id: `rem-new-${creates}`,
        label: String(body.label ?? 'New reminder'),
        category: body.category ? String(body.category) : null,
        scheduled_on: String(body.scheduled_on ?? '2026-11-24'),
        notes: body.notes ? String(body.notes) : null,
        recurrence_series_id: body.recurrence_interval ? `series-new-${creates}` : null,
        recurrence_interval: body.recurrence_interval ?? null,
        telegram_reminder_enabled: Boolean(body.telegram_reminder_enabled),
        telegram_due_date: body.telegram_due_date ?? null,
        telegram_reminder_interval: body.telegram_reminder_interval ?? 'daily_noon',
        completed_at: body.marked_complete ? new Date().toISOString() : null,
      });
      items.unshift(row);
      return json(route, { success: true, data: row, created_count: 1 });
    }

    if (request.method() === 'PATCH') {
      const index = items.findIndex((item) => item.id === body.id);
      if (index < 0)
        return json(route, { success: true, data: maintenanceItem(), updated_count: 1 });
      const patch = { ...body };
      delete patch.id;
      delete patch.scope;
      items[index] = {
        ...items[index],
        ...patch,
        completed_at:
          body.marked_complete === undefined
            ? items[index].completed_at
            : body.marked_complete
              ? (items[index].completed_at ?? new Date().toISOString())
              : null,
      } as MaintenanceItemFixture;
      return json(route, { success: true, data: items[index], updated_count: 1 });
    }

    if (request.method() === 'DELETE') {
      const id = url.searchParams.get('id');
      const index = items.findIndex((item) => item.id === id);
      if (index >= 0) items.splice(index, 1);
      return json(route, { success: true, deleted_count: 1 });
    }

    return json(route, { success: true, data: items });
  });

  await page.route(MAINTENANCE_ACTIVITY_PATH, (route) =>
    json(route, { success: true, data: { events: [], nextCursor: null } })
  );

  return { items };
}

/** Paced hold for tour recordings; no-op unless PLAYWRIGHT_DEMO_PAUSE_MS is set. */
export async function demoPause(page: Page, multiplier = 1): Promise<void> {
  const raw = process.env.PLAYWRIGHT_DEMO_PAUSE_MS;
  const ms = raw ? Number.parseInt(raw, 10) : 0;
  if (!ms || !Number.isFinite(ms)) return;
  await page.waitForTimeout(Math.round(ms * multiplier));
}

/** Consent lives in origin-scoped storage, so a port change loses it. */
export async function dismissConsent(page: Page): Promise<void> {
  for (const name of ['Essential only', 'Necessary only', 'Accept all']) {
    const button = page.getByRole('button', { name });
    if (await button.count()) {
      await button.first().click();
      await page.waitForTimeout(200);
      return;
    }
  }
}
