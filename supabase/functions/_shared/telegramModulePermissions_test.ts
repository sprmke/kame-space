import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  TELEGRAM_ANY_MODULE_EDIT_IDS,
  telegramModuleEditPermission,
} from './telegramModulePermissions.ts';

/*
 * Each Telegram module maps to the notification leaf that owns its settings. A wrong
 * mapping lets a member with one module's settings permission edit another module's bot.
 */

Deno.test('each property module maps to its notifications leaf', () => {
  assertEquals(telegramModuleEditPermission('chat'), 'notifications.chat:edit');
  assertEquals(telegramModuleEditPermission('marketing'), 'notifications.marketing:edit');
  assertEquals(telegramModuleEditPermission('staff'), 'notifications.staff:edit');
  assertEquals(telegramModuleEditPermission('admin'), 'notifications.operations:edit');
  assertEquals(telegramModuleEditPermission('finance'), 'notifications.finance:edit');
  assertEquals(telegramModuleEditPermission('maintenance'), 'notifications.maintenance:edit');
});

Deno.test('the parking channel uses parking permissions, not a notifications leaf', () => {
  assertEquals(telegramModuleEditPermission('parking'), null);
});

Deno.test('the any-module list is non-empty, unique, and omits parking', () => {
  assertEquals(TELEGRAM_ANY_MODULE_EDIT_IDS.length > 0, true);
  assertEquals(new Set(TELEGRAM_ANY_MODULE_EDIT_IDS).size, TELEGRAM_ANY_MODULE_EDIT_IDS.length);

  for (const id of TELEGRAM_ANY_MODULE_EDIT_IDS) {
    assertEquals(id.startsWith('notifications.'), true, `${id} is not a notifications leaf`);
  }

  assertEquals(TELEGRAM_ANY_MODULE_EDIT_IDS.some((id) => id.includes('parking')), false);
});

Deno.test('every property module leaf is part of the any-module list', () => {
  const modules = ['chat', 'marketing', 'staff', 'admin', 'finance', 'maintenance'] as const;

  for (const module of modules) {
    const leaf = telegramModuleEditPermission(module);
    assertEquals(
      TELEGRAM_ANY_MODULE_EDIT_IDS.includes(leaf!),
      true,
      `${module} leaf ${leaf} is missing from TELEGRAM_ANY_MODULE_EDIT_IDS`
    );
  }
});
