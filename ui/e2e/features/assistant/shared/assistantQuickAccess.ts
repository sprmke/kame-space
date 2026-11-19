import { expect, type Page } from '@playwright/test';

/** Quick Access FAB (aria-label may include an unread count). */
export function quickAccessFab(page: Page) {
  return page.getByRole('button', { name: /Quick access/i });
}

/** Open the Advanced-mode AI assistant panel via the Quick Access toolbar. */
export async function openAssistantFromQuickAccess(page: Page) {
  const hub = quickAccessFab(page);
  await expect(hub).toBeVisible({ timeout: 20_000 });
  await hub.click();
  await page.getByRole('button', { name: 'AI assistant' }).click();
}
