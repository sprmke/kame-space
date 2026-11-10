import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  SETTINGS_PHASE5_LEAF_IDS,
  SETTINGS_SECTION_EDIT_IDS,
  expandSettingsPhase5PermissionIds,
} from './settingsPermissionExpansion.ts';

/*
 * Legacy settings/templates umbrella ids are still stored on live member rows. Expansion
 * must preserve access exactly: too little and a host loses a settings tab, too much and a
 * retired umbrella silently grants a leaf nobody approved.
 */

Deno.test('settings:edit expands to every section leaf and nothing else', () => {
  const expanded = expandSettingsPhase5PermissionIds(['settings:edit']);

  assertEquals(expanded.length, SETTINGS_SECTION_EDIT_IDS.length);
  for (const leaf of SETTINGS_SECTION_EDIT_IDS) {
    assertEquals(expanded.includes(leaf), true, `${leaf} missing`);
  }
  assertEquals(expanded.includes('settings:view'), false);
  assertEquals(expanded.includes('settings.integrations:view'), false);
});

Deno.test('settings:view keeps the view id and adds the integrations leaf', () => {
  assertEquals(expandSettingsPhase5PermissionIds(['settings:view']), [
    'settings:view',
    'settings.integrations:view',
  ]);
});

Deno.test('templates:view adds the public pages view leaf', () => {
  assertEquals(expandSettingsPhase5PermissionIds(['templates:view']), [
    'templates:view',
    'publicPages:view',
  ]);
});

Deno.test('templates:edit expands to the template and public page edit leaves', () => {
  const expanded = expandSettingsPhase5PermissionIds(['templates:edit']);

  assertEquals(expanded.includes('templates.standard:edit'), true);
  assertEquals(expanded.includes('templates.custom:delete'), true);
  assertEquals(expanded.includes('publicPages.showcase:edit'), true);
  assertEquals(expanded.includes('publicPages:view'), false);
});

Deno.test('a granular id passes through unchanged', () => {
  assertEquals(expandSettingsPhase5PermissionIds(['settings.media:edit']), [
    'settings.media:edit',
  ]);
  assertEquals(expandSettingsPhase5PermissionIds(['not.a.leaf']), ['not.a.leaf']);
});

Deno.test('ids are trimmed and empties dropped', () => {
  assertEquals(expandSettingsPhase5PermissionIds(['  settings.media:edit  ', '   ', '']), [
    'settings.media:edit',
  ]);
  assertEquals(expandSettingsPhase5PermissionIds([]), []);
});

Deno.test('duplicates collapse across umbrella and leaf input', () => {
  const expanded = expandSettingsPhase5PermissionIds([
    'settings:edit',
    'settings.media:edit',
  ]);

  assertEquals(expanded.length, SETTINGS_SECTION_EDIT_IDS.length);
  assertEquals(expanded.filter((id) => id === 'settings.media:edit').length, 1);
});

Deno.test('the catalog covers every leaf an umbrella can produce', () => {
  // The view umbrellas keep their own id alongside the leaves they add, and those preserved
  // ids are deliberately absent from SETTINGS_PHASE5_LEAF_IDS.
  const preservedUmbrellaIds = new Set(['settings:view', 'templates:view']);

  for (const umbrella of ['settings:view', 'settings:edit', 'templates:view', 'templates:edit']) {
    for (const leaf of expandSettingsPhase5PermissionIds([umbrella])) {
      if (preservedUmbrellaIds.has(leaf)) continue;
      assertEquals(
        (SETTINGS_PHASE5_LEAF_IDS as readonly string[]).includes(leaf),
        true,
        `${umbrella} produced ${leaf}, which is missing from SETTINGS_PHASE5_LEAF_IDS`
      );
    }
  }
});

Deno.test('the leaf catalog has no duplicates', () => {
  assertEquals(new Set(SETTINGS_PHASE5_LEAF_IDS).size, SETTINGS_PHASE5_LEAF_IDS.length);
});
