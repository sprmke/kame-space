/**
 * Request contracts for the `marketing-planner` endpoint.
 *
 * Kept in their own module so the input contract is unit-tested without mounting the handler
 * (importing the endpoint would start it). Every action is strict about shape: an unknown extra
 * field must not reach the service layer.
 */

import { z } from 'zod';

export const MARKETING_FORMATS = ['post', 'carousel', 'story', 'reel', 'calendar'] as const;
export const MARKETING_CHANNELS = [
  'facebook_page',
  'instagram',
  'facebook_group',
  'tiktok',
  'messenger',
  'viber',
  'whatsapp',
  'google_business',
  'other',
] as const;
export const PLANNER_GOALS = [
  'fill_open_nights',
  'weekends',
  'direct_bookings',
  'longer_stays',
  'brand',
] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
const uuid = z.string().uuid();

export const generateSchema = z.object({
  action: z.literal('generate'),
  mode: z.enum(['rules', 'ai']).default('rules'),
});

export const updateSchema = z.object({
  action: z.literal('update_item'),
  itemId: uuid,
  scheduledFor: z.string().datetime({ offset: true }).optional(),
  format: z.enum(MARKETING_FORMATS).optional(),
  title: z.string().trim().min(1).max(120).optional(),
  brief: z.record(z.unknown()).optional(),
});

export const skipSchema = z.object({
  action: z.literal('skip'),
  itemId: uuid,
  reason: z.string().trim().min(1).max(200),
});

export const refreshSchema = z.object({
  action: z.literal('refresh_brief'),
  itemId: uuid,
  instruction: z.enum(['shorter', 'playful', 'taglish']).default('shorter'),
});

export const postedSchema = z.object({
  action: z.literal('mark_posted'),
  itemId: uuid,
  postedUrl: z.string().url().max(500).optional(),
});

export const addItemSchema = z.object({
  action: z.literal('add_item'),
  title: z.string().trim().min(1).max(120),
  format: z.enum(MARKETING_FORMATS),
  channelKind: z.enum(MARKETING_CHANNELS),
  scheduledFor: z.string().datetime({ offset: true }),
  manualTargets: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
  brief: z.record(z.unknown()).optional(),
});

export const attachSchema = z.object({
  action: z.literal('attach_asset'),
  itemId: uuid,
  assetKind: z.enum(['template', 'ai_session', 'media']),
  assetId: uuid,
  assetVersionId: uuid.optional(),
});

export const prepareSchema = z.object({
  action: z.literal('prepare_batch'),
  from: isoDate,
  to: isoDate,
  limit: z.number().int().min(1).max(20).optional(),
});

export const settingsSchema = z.object({
  goals: z.array(z.enum(PLANNER_GOALS)).max(2).optional(),
  cadencePreset: z.enum(['light', 'steady', 'active', 'custom']).optional(),
  channels: z.array(z.record(z.unknown())).max(20).optional(),
  language: z.enum(['en', 'fil', 'taglish']).optional(),
  tone: z.enum(['warm', 'playful', 'premium']).optional(),
  approvalMode: z.enum(['ask', 'auto_publish_connected']).optional(),
  autoPlan: z.boolean().optional(),
  autoPlanMode: z.enum(['rules', 'ai']).optional(),
  weeklyAiCreditCap: z.number().int().min(0).max(1000).optional(),
  planWeekday: z.number().int().min(0).max(6).optional(),
  planTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export const POST_ACTIONS = {
  generate: generateSchema,
  update_item: updateSchema,
  skip: skipSchema,
  refresh_brief: refreshSchema,
  mark_posted: postedSchema,
  add_item: addItemSchema,
  attach_asset: attachSchema,
  prepare_batch: prepareSchema,
} as const;
