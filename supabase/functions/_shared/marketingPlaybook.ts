/**
 * Marketing Planner playbook — versioned strategy data, not prompts.
 *
 * Every number here is a product default (a heuristic) that a property's own
 * published results eventually replace (plan §4.6). The engine reads this module
 * and never invents strategy inline, so tuning the planner is a one-file change.
 *
 * Pure data + pure helpers: no clock, no DB, no network (Smart Pricing convention).
 */

export const PLAYBOOK_VERSION = '2026-11-09.1';

/** Manila posting windows the scheduler may place items in. */
export type PostingWindow = {
  /** Minutes from midnight, Asia/Manila. */
  startMinute: number;
  endMinute: number;
  /** Weekday multiplier, Monday = 1 ... Sunday = 7. */
  weekdayWeight: number;
  weekendWeight: number;
};

export type CadencePreset = 'light' | 'steady' | 'active' | 'custom';

export type CadenceShape = {
  feedPostsPerWeek: number;
  reelsPerWeek: number;
  storiesPerWeek: number;
  maxItemsPerDay: number;
};

export const CADENCE_PRESETS: Record<Exclude<CadencePreset, 'custom'>, CadenceShape> = {
  light: { feedPostsPerWeek: 2, reelsPerWeek: 1, storiesPerWeek: 3, maxItemsPerDay: 2 },
  steady: { feedPostsPerWeek: 4, reelsPerWeek: 2, storiesPerWeek: 5, maxItemsPerDay: 3 },
  active: { feedPostsPerWeek: 5, reelsPerWeek: 3, storiesPerWeek: 7, maxItemsPerDay: 4 },
};

export function resolveCadence(
  preset: CadencePreset,
  custom: CadenceShape | null | undefined
): CadenceShape {
  if (preset === 'custom' && custom) return custom;
  if (preset === 'custom') return CADENCE_PRESETS.steady;
  return CADENCE_PRESETS[preset];
}

export type Pillar = 'offers' | 'property' | 'social_proof' | 'destination' | 'people';

export const PILLARS: readonly Pillar[] = [
  'offers',
  'property',
  'social_proof',
  'destination',
  'people',
] as const;

export type ForwardOccupancyState = 'underbooked' | 'building' | 'strong' | 'fully_booked';

/** Target share per pillar, by forward occupancy state. Fractions sum to 1. */
export const PILLAR_MIX: Record<ForwardOccupancyState, Record<Pillar, number>> = {
  underbooked: {
    offers: 0.4,
    property: 0.25,
    social_proof: 0.2,
    destination: 0.1,
    people: 0.05,
  },
  building: {
    offers: 0.3,
    property: 0.3,
    social_proof: 0.2,
    destination: 0.1,
    people: 0.1,
  },
  strong: {
    offers: 0.2,
    property: 0.3,
    social_proof: 0.25,
    destination: 0.15,
    people: 0.1,
  },
  fully_booked: {
    offers: 0.1,
    property: 0.3,
    social_proof: 0.3,
    destination: 0.15,
    people: 0.15,
  },
};

/**
 * Default posting windows in Asia/Manila. Stories carry same-day availability
 * at 09:00; feed posts and reels sit in the midday and evening windows.
 */
export const DEFAULT_POSTING_WINDOWS: readonly PostingWindow[] = [
  { startMinute: 9 * 60, endMinute: 9 * 60 + 30, weekdayWeight: 1.0, weekendWeight: 0.9 },
  { startMinute: 12 * 60, endMinute: 14 * 60, weekdayWeight: 1.2, weekendWeight: 0.8 },
  { startMinute: 19 * 60, endMinute: 21 * 60, weekdayWeight: 1.2, weekendWeight: 0.8 },
] as const;

/** Never schedule inside quiet hours, Manila time. */
export const QUIET_HOURS = { startMinute: 23 * 60, endMinute: 7 * 60 } as const;

export function isWithinQuietHours(minuteOfDay: number): boolean {
  return minuteOfDay >= QUIET_HOURS.startMinute || minuteOfDay < QUIET_HOURS.endMinute;
}

/** Weekday multiplier for a 1 (Monday) to 7 (Sunday) day number. */
export function weekdayWeight(dayOfWeek: number, window: PostingWindow): number {
  return dayOfWeek >= 6 ? window.weekendWeight : window.weekdayWeight;
}

export type MarketingFormat = 'post' | 'carousel' | 'story' | 'reel' | 'calendar';

export const FORMAT_LABELS: Record<MarketingFormat, string> = {
  post: 'Post',
  carousel: 'Carousel',
  story: 'Story',
  reel: 'Reel',
  calendar: 'Availability calendar',
};

export type MarketingOpportunityType =
  | 'tonight_tomorrow'
  | 'weekend_open'
  | 'gap_nights'
  | 'last_slots_month'
  | 'long_weekend'
  | 'seasonal_moment'
  | 'freed_dates'
  | 'rate_live_drop'
  | 'fully_booked'
  | 'new_review'
  | 'rating_milestone'
  | 'amenity_spotlight'
  | 'audience_fit'
  | 'direct_booking_push'
  | 'local_event'
  | 'content_refresh'
  | 'cadence_gap'
  | 'payday_weekend';

export type OpportunityDefinition = {
  type: MarketingOpportunityType;
  pillar: Pillar;
  /** Preferred formats, highest priority first. */
  formats: readonly MarketingFormat[];
  /** Default days between "plan it" and "post it". */
  leadTimeDays: number;
  /** Minutes before the promoted check-in date that still counts as "urgent". */
  urgencyHours: number;
  /** Relative value weight, 0 to 1, before nights-at-stake scaling. */
  valueWeight: number;
  /** True when the item promotes availability for specific nights. */
  promotesAvailability: boolean;
};

export const OPPORTUNITIES: Record<MarketingOpportunityType, OpportunityDefinition> = {
  tonight_tomorrow: {
    type: 'tonight_tomorrow',
    pillar: 'offers',
    formats: ['story', 'post'],
    leadTimeDays: 0,
    urgencyHours: 24,
    valueWeight: 0.9,
    promotesAvailability: true,
  },
  weekend_open: {
    type: 'weekend_open',
    pillar: 'offers',
    formats: ['reel', 'carousel', 'story'],
    leadTimeDays: 4,
    urgencyHours: 72,
    valueWeight: 1,
    promotesAvailability: true,
  },
  gap_nights: {
    type: 'gap_nights',
    pillar: 'offers',
    formats: ['post', 'story'],
    leadTimeDays: 2,
    urgencyHours: 48,
    valueWeight: 0.8,
    promotesAvailability: true,
  },
  last_slots_month: {
    type: 'last_slots_month',
    pillar: 'offers',
    formats: ['calendar', 'carousel'],
    leadTimeDays: 1,
    urgencyHours: 168,
    valueWeight: 0.7,
    promotesAvailability: true,
  },
  long_weekend: {
    type: 'long_weekend',
    pillar: 'offers',
    formats: ['reel', 'carousel', 'calendar', 'story'],
    leadTimeDays: 21,
    urgencyHours: 168,
    valueWeight: 1,
    promotesAvailability: true,
  },
  seasonal_moment: {
    type: 'seasonal_moment',
    pillar: 'destination',
    formats: ['reel', 'post'],
    leadTimeDays: 21,
    urgencyHours: 336,
    valueWeight: 0.6,
    promotesAvailability: false,
  },
  freed_dates: {
    type: 'freed_dates',
    pillar: 'offers',
    formats: ['story', 'post'],
    leadTimeDays: 0,
    urgencyHours: 12,
    valueWeight: 1,
    promotesAvailability: true,
  },
  rate_live_drop: {
    type: 'rate_live_drop',
    pillar: 'offers',
    formats: ['post', 'story'],
    leadTimeDays: 1,
    urgencyHours: 48,
    valueWeight: 0.8,
    promotesAvailability: true,
  },
  fully_booked: {
    type: 'fully_booked',
    pillar: 'social_proof',
    formats: ['post', 'story'],
    leadTimeDays: 2,
    urgencyHours: 96,
    valueWeight: 0.5,
    promotesAvailability: false,
  },
  new_review: {
    type: 'new_review',
    pillar: 'social_proof',
    formats: ['post', 'reel'],
    leadTimeDays: 7,
    urgencyHours: 168,
    valueWeight: 0.6,
    promotesAvailability: false,
  },
  rating_milestone: {
    type: 'rating_milestone',
    pillar: 'social_proof',
    formats: ['post'],
    leadTimeDays: 7,
    urgencyHours: 168,
    valueWeight: 0.5,
    promotesAvailability: false,
  },
  amenity_spotlight: {
    type: 'amenity_spotlight',
    pillar: 'property',
    formats: ['carousel', 'reel'],
    leadTimeDays: 3,
    urgencyHours: 168,
    valueWeight: 0.4,
    promotesAvailability: false,
  },
  audience_fit: {
    type: 'audience_fit',
    pillar: 'property',
    formats: ['post', 'reel'],
    leadTimeDays: 3,
    urgencyHours: 168,
    valueWeight: 0.4,
    promotesAvailability: false,
  },
  direct_booking_push: {
    type: 'direct_booking_push',
    pillar: 'offers',
    formats: ['post', 'story'],
    leadTimeDays: 2,
    urgencyHours: 168,
    valueWeight: 0.6,
    promotesAvailability: false,
  },
  local_event: {
    type: 'local_event',
    pillar: 'destination',
    formats: ['post', 'reel'],
    leadTimeDays: 21,
    urgencyHours: 168,
    valueWeight: 0.6,
    promotesAvailability: true,
  },
  content_refresh: {
    type: 'content_refresh',
    pillar: 'property',
    formats: ['carousel', 'reel'],
    leadTimeDays: 3,
    urgencyHours: 168,
    valueWeight: 0.4,
    promotesAvailability: false,
  },
  cadence_gap: {
    type: 'cadence_gap',
    pillar: 'property',
    formats: ['reel'],
    leadTimeDays: 2,
    urgencyHours: 168,
    valueWeight: 0.3,
    promotesAvailability: false,
  },
  payday_weekend: {
    type: 'payday_weekend',
    pillar: 'offers',
    formats: ['story'],
    leadTimeDays: 3,
    urgencyHours: 96,
    valueWeight: 0.3,
    promotesAvailability: true,
  },
};

/** Fallback lead time when a property has no lead-time distribution yet. */
export const DEFAULT_MEDIAN_LEAD_DAYS = 14;

/** Items a plan may carry for a horizon, before per-day and cadence caps. */
export const MAX_ITEMS_PER_RUN = 40;

/** Never learn or override these, whatever the data says (plan §4.6). */
export const IMMUTABLE_RULES = ['truth', 'quiet_hours', 'cadence_caps'] as const;
