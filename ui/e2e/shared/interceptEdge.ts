import type { Page, Route } from '@playwright/test';

export type EdgeMock = {
  /** Function name segment after `/functions/v1/` */
  name: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'OPTIONS';
  status?: number;
  body?: unknown;
  /** When set, invoked instead of default JSON body. */
  handler?: (route: Route) => Promise<void>;
};

export type MockEdgeOptions = {
  /**
   * Fail the test on a `functions/v1` call that no mock covers.
   *
   * Off by default because most specs still share harnesses that rely on pass-through.
   * Turn it on for a spec whose endpoint set is fully known: a silent pass-through hides a
   * real dependency and can hit `127.0.0.1:54321` (or production) from a test.
   */
  strict?: boolean;
};

/** The function name is the path segment after `/functions/v1/`, matched exactly. */
function functionName(url: string): string | null {
  try {
    const segments = new URL(url).pathname.split('/').filter(Boolean);
    const index = segments.indexOf('v1');
    return index >= 0 ? (segments[index + 1] ?? null) : null;
  } catch {
    return null;
  }
}

/**
 * Register Playwright route handlers for Supabase edge functions.
 * Call before `page.goto`.
 */
export async function mockEdgeFunctions(
  page: Page,
  mocks: EdgeMock[],
  options: MockEdgeOptions = {}
) {
  await page.route('**/functions/v1/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    const name = functionName(url);
    const mock = mocks.find((m) => m.name === name && (!m.method || m.method === method));

    if (!mock) {
      if (!options.strict) {
        await route.continue();
        return;
      }

      // Fail loudly instead of reaching the network. The body is still a valid response so
      // a page cannot hang waiting for it, and the thrown error is what fails the test.
      await route.fulfill({
        status: 599,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: `Unmocked edge function in a strict spec: ${method} ${name ?? url}`,
        }),
      });
      throw new Error(
        `Unmocked edge function in a strict spec: ${method} ${name ?? url}. Add a mock, or a typed one from ui/e2e/shared/edgeMocks/.`
      );
    }

    if (mock.handler) {
      await mock.handler(route);
      return;
    }
    await route.fulfill({
      status: mock.status ?? 200,
      contentType: 'application/json',
      body: JSON.stringify(mock.body ?? {}),
    });
  });
}
