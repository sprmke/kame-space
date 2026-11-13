import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  addItemSchema,
  attachSchema,
  generateSchema,
  postedSchema,
  prepareSchema,
  refreshSchema,
  settingsSchema,
  skipSchema,
  updateSchema,
} from './marketingPlannerSchemas.ts';

const ITEM_ID = '11111111-1111-4111-8111-111111111111';
const ASSET_ID = '22222222-2222-4222-8222-222222222222';

Deno.test('generate: mode defaults to rules and rejects an unknown mode', () => {
  const parsed = generateSchema.parse({ action: 'generate' });
  assertEquals(parsed.mode, 'rules');
  assertEquals(generateSchema.safeParse({ action: 'generate', mode: 'turbo' }).success, false);
});

Deno.test('generate: rejects a wrong action discriminator', () => {
  assertEquals(generateSchema.safeParse({ action: 'skip' }).success, false);
});

Deno.test('update_item: every field is optional except the id', () => {
  assertEquals(updateSchema.safeParse({ action: 'update_item', itemId: ITEM_ID }).success, true);
  const parsed = updateSchema.parse({
    action: 'update_item',
    itemId: ITEM_ID,
    scheduledFor: '2026-11-13T19:00:00+08:00',
    format: 'reel',
    title: 'Open this weekend',
    brief: { hook: 'Two nights left' },
  });
  assertEquals(parsed.format, 'reel');
});

Deno.test('update_item: rejects a non-uuid, an unknown format and a blank title', () => {
  assertEquals(updateSchema.safeParse({ action: 'update_item', itemId: 'nope' }).success, false);
  assertEquals(
    updateSchema.safeParse({ action: 'update_item', itemId: ITEM_ID, format: 'banner' }).success,
    false
  );
  assertEquals(
    updateSchema.safeParse({ action: 'update_item', itemId: ITEM_ID, title: '   ' }).success,
    false
  );
});

Deno.test('update_item: a timestamp without an offset is rejected', () => {
  assertEquals(
    updateSchema.safeParse({
      action: 'update_item',
      itemId: ITEM_ID,
      scheduledFor: '2026-11-13T19:00:00',
    }).success,
    false
  );
});

Deno.test('skip: needs a real reason', () => {
  assertEquals(skipSchema.safeParse({ action: 'skip', itemId: ITEM_ID, reason: 'Not this week' }).success, true);
  assertEquals(skipSchema.safeParse({ action: 'skip', itemId: ITEM_ID, reason: '' }).success, false);
  assertEquals(
    skipSchema.safeParse({ action: 'skip', itemId: ITEM_ID, reason: 'x'.repeat(201) }).success,
    false
  );
});

Deno.test('refresh_brief: instruction defaults to shorter', () => {
  assertEquals(
    refreshSchema.parse({ action: 'refresh_brief', itemId: ITEM_ID }).instruction,
    'shorter'
  );
  assertEquals(
    refreshSchema.safeParse({ action: 'refresh_brief', itemId: ITEM_ID, instruction: 'formal' })
      .success,
    false
  );
});

Deno.test('mark_posted: the post URL must be absolute', () => {
  assertEquals(
    postedSchema.safeParse({
      action: 'mark_posted',
      itemId: ITEM_ID,
      postedUrl: 'https://facebook.com/p/1',
    }).success,
    true
  );
  assertEquals(
    postedSchema.safeParse({ action: 'mark_posted', itemId: ITEM_ID, postedUrl: 'facebook.com' })
      .success,
    false
  );
});

Deno.test('add_item: requires title, format, channel and a scheduled time', () => {
  const base = {
    action: 'add_item',
    title: 'Weekend post',
    format: 'post',
    channelKind: 'facebook_page',
    scheduledFor: '2026-11-13T09:00:00+08:00',
  };
  assertEquals(addItemSchema.safeParse(base).success, true);
  assertEquals(addItemSchema.safeParse({ ...base, channelKind: 'myspace' }).success, false);
  assertEquals(addItemSchema.safeParse({ ...base, manualTargets: Array(11).fill('g') }).success, false);
});

Deno.test('attach_asset: kind is constrained and ids are uuids', () => {
  assertEquals(
    attachSchema.safeParse({
      action: 'attach_asset',
      itemId: ITEM_ID,
      assetKind: 'template',
      assetId: ASSET_ID,
    }).success,
    true
  );
  assertEquals(
    attachSchema.safeParse({
      action: 'attach_asset',
      itemId: ITEM_ID,
      assetKind: 'pdf',
      assetId: ASSET_ID,
    }).success,
    false
  );
});

Deno.test('prepare_batch: dates are YYYY-MM-DD and the limit is capped', () => {
  assertEquals(
    prepareSchema.safeParse({ action: 'prepare_batch', from: '2026-11-09', to: '2026-11-15' })
      .success,
    true
  );
  assertEquals(
    prepareSchema.safeParse({ action: 'prepare_batch', from: '09-11-2026', to: '2026-11-15' })
      .success,
    false
  );
  assertEquals(
    prepareSchema.safeParse({
      action: 'prepare_batch',
      from: '2026-11-09',
      to: '2026-11-15',
      limit: 50,
    }).success,
    false
  );
});

Deno.test('settings: caps goals at two and validates the new AI plan fields', () => {
  assertEquals(
    settingsSchema.safeParse({ goals: ['fill_open_nights', 'weekends'] }).success,
    true
  );
  assertEquals(
    settingsSchema.safeParse({ goals: ['fill_open_nights', 'weekends', 'brand'] }).success,
    false
  );
  assertEquals(settingsSchema.safeParse({ autoPlanMode: 'ai', weeklyAiCreditCap: 20 }).success, true);
  assertEquals(settingsSchema.safeParse({ autoPlanMode: 'auto' }).success, false);
  assertEquals(settingsSchema.safeParse({ weeklyAiCreditCap: 5000 }).success, false);
  assertEquals(settingsSchema.safeParse({ planTime: '8:00' }).success, false);
  assertEquals(settingsSchema.safeParse({ planTime: '08:00' }).success, true);
});

Deno.test('settings: an empty patch parses (no-op save)', () => {
  const parsed = settingsSchema.parse({});
  assert(Object.keys(parsed).length === 0);
});
