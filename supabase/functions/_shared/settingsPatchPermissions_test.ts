import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  appSettingsPatchPermissions,
  updatePropertyPatchPermissions,
} from './settingsPatchPermissions.ts';

/*
 * Maps a PATCH body to the permission leaves it needs. A missing leaf here means a
 * member without that permission can still write the field, so this is authorization
 * logic, not formatting.
 */

Deno.test('an empty update-property body needs no permission', () => {
  assertEquals(updatePropertyPatchPermissions({}), []);
});

Deno.test('identity fields need settings.basicInfo:edit, once', () => {
  assertEquals(updatePropertyPatchPermissions({ name: 'Monaco 2604' }), ['settings.basicInfo:edit']);
  assertEquals(
    updatePropertyPatchPermissions({
      name: 'Monaco 2604',
      tower: 'T1',
      unitNumber: '2604',
      residenceName: 'Azure North',
      maxGuests: 4,
    }),
    ['settings.basicInfo:edit']
  );
});

Deno.test('towerAndUnit is the legacy shape of the same fields', () => {
  assertEquals(updatePropertyPatchPermissions({ towerAndUnit: 'T1-2604' }), [
    'settings.basicInfo:edit',
  ]);
});

Deno.test('address needs settings.location:edit', () => {
  assertEquals(updatePropertyPatchPermissions({ address: '1 Azure Way' }), [
    'settings.location:edit',
  ]);
});

Deno.test('status is not mapped here: lifecycle changes go through property-lifecycle', () => {
  assertEquals(updatePropertyPatchPermissions({ status: 'archived' }), []);
});

Deno.test('settings keys map to the leaf that owns the section', () => {
  assertEquals(updatePropertyPatchPermissions({ settings: { description: 'A flat' } }), [
    'settings.basicInfo:edit',
  ]);
  assertEquals(updatePropertyPatchPermissions({ settings: { media: [] } }), [
    'settings.media:edit',
  ]);
  assertEquals(updatePropertyPatchPermissions({ settings: { checkInTime: '14:00' } }), [
    'settings.propertyDetails:edit',
  ]);
  assertEquals(updatePropertyPatchPermissions({ settings: { enabledAmenities: ['pool'] } }), [
    'settings.amenities:edit',
  ]);
  assertEquals(updatePropertyPatchPermissions({ settings: { customHouseRules: [] } }), [
    'settings.houseRules:edit',
  ]);
  assertEquals(updatePropertyPatchPermissions({ settings: { allowPets: true } }), [
    'settings.guestForm:edit',
  ]);
  assertEquals(
    updatePropertyPatchPermissions({ settings: { cancellationPolicy: { presetId: 'moderate' } } }),
    ['settings.cancellationPolicy:edit']
  );
  assertEquals(updatePropertyPatchPermissions({ settings: { latitude: 15.1 } }), [
    'settings.location:edit',
  ]);
  assertEquals(updatePropertyPatchPermissions({ settings: { inboxPinnedSnippets: [] } }), [
    'inbox.quickReplies:edit',
  ]);
});

Deno.test('several settings in one patch need every leaf, deduplicated', () => {
  assertEquals(
    updatePropertyPatchPermissions({
      settings: {
        description: 'A flat',
        contactName: 'Ana',
        media: [],
        city: 'Angeles',
        province: 'Pampanga',
      },
    }),
    ['settings.basicInfo:edit', 'settings.media:edit', 'settings.location:edit']
  );
});

Deno.test('unknown settings keys and non-object settings are ignored', () => {
  assertEquals(updatePropertyPatchPermissions({ settings: { notAField: 1 } }), []);
  assertEquals(updatePropertyPatchPermissions({ settings: 'nope' }), []);
  assertEquals(updatePropertyPatchPermissions({ settings: [] }), []);
  assertEquals(updatePropertyPatchPermissions({ settings: null }), []);
});

Deno.test('app settings map to their owning sections', () => {
  assertEquals(appSettingsPatchPermissions({ brandColor: '#e8752a' }), ['settings.basicInfo:edit']);
  assertEquals(appSettingsPatchPermissions({ instagramUrl: 'https://ig.test/x' }), [
    'settings.socials:edit',
  ]);
  assertEquals(appSettingsPatchPermissions({ paymentProvider: 'paymongo' }), [
    'settings.payment:edit',
  ]);
  assertEquals(appSettingsPatchPermissions({ gafUnitOwner: 'Ana' }), [
    'settings.buildingForms:edit',
  ]);
  assertEquals(appSettingsPatchPermissions({ emailReplyTo: 'host@example.test' }), [
    'settings.emailAutomations:edit',
  ]);
});

Deno.test('verification and autosave plumbing never demand a settings leaf', () => {
  assertEquals(
    appSettingsPatchPermissions({
      settingsVerificationToken: 'token',
      publicPagesAutosaveGate: true,
    }),
    []
  );
});

Deno.test('an app-settings patch deduplicates leaves across keys', () => {
  assertEquals(
    appSettingsPatchPermissions({
      facebookPageUrl: 'https://fb.test/x',
      instagramUrl: 'https://ig.test/x',
      vouchersEnabled: true,
    }),
    ['settings.socials:edit']
  );
});

Deno.test('unknown app-settings keys are ignored', () => {
  assertEquals(appSettingsPatchPermissions({ madeUpSetting: 1 }), []);
});
