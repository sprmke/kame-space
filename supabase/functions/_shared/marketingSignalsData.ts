/**
 * Marketing Planner signal loader — the only place that touches the database for
 * planning. Everything it returns is aggregates and night keys; no guest rows.
 *
 * The pure engine (`marketingSignals`, `marketingScheduler`) never sees a client.
 */

import { computeAnalyticsBundle } from './analyticsService.ts';
import {
  addDaysYmd,
  collectBlockedNights,
  manilaTodayYmd,
} from './calendarAvailabilityManila.ts';
import { DatabaseService } from './databaseService.ts';
import { listPropertyGuestReviewsForMarketing } from './marketingGuestReviews.ts';
import { loadPropertyPricing, type PropertyPricingDto } from './propertyPricing.ts';
import { loadBlockedDateKeys } from './propertyBlockedDates.ts';
import type { PlannerChannelSetting, PlannerSettingsShape } from './marketingScheduler.ts';
import type {
  PlannerCalendarEvent,
  PlannerReviewCandidate,
  PlannerSignalsInput,
} from './marketingSignals.ts';
import { resolveCadence, type CadencePreset } from './marketingPlaybook.ts';
import { bestLearnedWindows, type TimingSample } from './marketingTimingModel.ts';
import type { PlannerLanguage } from './marketingCopyLibrary.ts';
import { createServiceClient } from './orgAuth.ts';

/** Planning horizon. Weekly planning looks a month ahead so staged campaigns show up. */
export const PLANNER_HORIZON_DAYS = 30;

export type PlannerSettingsRow = {
  property_id: string;
  organization_id: string;
  goals: string[] | null;
  cadence_preset: string | null;
  cadence: unknown;
  channels: unknown;
  language: string | null;
  tone: string | null;
  posting_windows: unknown;
  approval_mode: string | null;
  auto_plan: boolean | null;
  plan_weekday: number | null;
  plan_time: string | null;
  reminders: unknown;
  onboarded_at: string | null;
};

export type PlannerInputs = {
  signals: PlannerSignalsInput;
  /** Learned best hour per weekday (1 to 7), or null until the sample is thick enough. */
  learnedPreferredHours: Record<number, number> | null;
  propertyName: string;
  settings: PlannerSettingsShape;
  settingsRow: PlannerSettingsRow | null;
  organizationId: string;
  horizonEnd: string;
};

const CADENCE_PRESETS = new Set<CadencePreset>(['light', 'steady', 'active', 'custom']);
const LANGUAGES = new Set<PlannerLanguage>(['en', 'fil', 'taglish']);

function asCadencePreset(value: unknown): CadencePreset {
  return typeof value === 'string' && CADENCE_PRESETS.has(value as CadencePreset)
    ? (value as CadencePreset)
    : 'steady';
}

function asLanguage(value: unknown): PlannerLanguage {
  return typeof value === 'string' && LANGUAGES.has(value as PlannerLanguage)
    ? (value as PlannerLanguage)
    : 'en';
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** Stored channels are validated on write; anything unrecognized is dropped on read. */
export function parseChannelSettings(raw: unknown): PlannerChannelSetting[] {
  if (!Array.isArray(raw)) return [];
  const out: PlannerChannelSetting[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const kind = row.kind;
    if (typeof kind !== 'string') continue;
    if (kind === 'facebook_page' || kind === 'instagram') {
      if (typeof row.connectionId === 'string') {
        out.push({ kind, connectionId: row.connectionId });
      }
      continue;
    }
    const manualKinds = [
      'facebook_group',
      'tiktok',
      'messenger',
      'viber',
      'whatsapp',
      'google_business',
      'other',
    ] as const;
    if (!(manualKinds as readonly string[]).includes(kind)) continue;
    out.push({
      kind: kind as (typeof manualKinds)[number],
      label: typeof row.label === 'string' ? row.label.slice(0, 80) : kind,
      url: typeof row.url === 'string' ? row.url : undefined,
    });
    if (out.length >= 20) break;
  }
  return out;
}

function medianFromBuckets(buckets: Array<{ bucket: string; count: number }>): number | null {
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  if (total === 0) return null;
  let running = 0;
  for (const bucket of buckets) {
    running += bucket.count;
    if (running / total >= 0.5) {
      const numbers = bucket.bucket.match(/\d+/g)?.map(Number) ?? [];
      if (numbers.length === 0) continue;
      return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
    }
  }
  return null;
}

function peakPartySize(buckets: Array<{ bucket: string; count: number }>): number | null {
  if (buckets.length === 0) return null;
  const top = [...buckets].sort((a, b) => b.count - a.count)[0];
  const numbers = top.bucket.match(/\d+/g)?.map(Number) ?? [];
  return numbers.length > 0 ? Math.max(...numbers) : null;
}

function topChannelShare(mix: Array<{ channel: string; count: number }>): number | null {
  const total = mix.reduce((sum, entry) => sum + entry.count, 0);
  if (total === 0) return null;
  const top = Math.max(...mix.map((entry) => entry.count));
  return top / total;
}

function isWeekendNight(ymd: string): boolean {
  const [year, month, day] = ymd.split('-').map(Number);
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return dow === 0 || dow === 6;
}

/** Live nightly rate for one night: host override, then applied Smart Pricing, then default. */
export function resolveNightlyRate(pricing: PropertyPricingDto, ymd: string): number | null {
  const override = pricing.dateOverrides?.[ymd];
  if (typeof override === 'number' && override > 0) return override;
  const smart = pricing.smartRecommendations?.[ymd];
  if (typeof smart === 'number' && smart > 0) return smart;
  const base = isWeekendNight(ymd) ? pricing.weekendNightlyRate : pricing.weekdayNightlyRate;
  return typeof base === 'number' && base > 0 ? base : null;
}

function nextDays(today: string, count: number): string[] {
  const out: string[] = [];
  for (let index = 0; index < count; index += 1) out.push(addDaysYmd(today, index));
  return out;
}

async function loadCalendarEvents(
  propertyId: string,
  from: string,
  to: string
): Promise<PlannerCalendarEvent[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('marketing_calendar_events')
    .select('id, scope, property_id, kind, name, starts_on, ends_on, weight')
    .gte('ends_on', from)
    .lte('starts_on', to)
    .or(`scope.eq.platform,property_id.eq.${propertyId}`)
    .limit(200);
  if (error) {
    console.error('[marketing-planner] calendar events:', error);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    scope: row.scope === 'property' ? 'property' : 'platform',
    kind: String(row.kind),
    name: String(row.name),
    startsOn: String(row.starts_on),
    endsOn: String(row.ends_on),
    weight: Number(row.weight ?? 1),
  }));
}

async function loadPlannerSettings(propertyId: string): Promise<PlannerSettingsRow | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('marketing_planner_settings')
    .select(
      'property_id, organization_id, goals, cadence_preset, cadence, channels, language, tone, ' +
        'posting_windows, approval_mode, auto_plan, plan_weekday, plan_time, reminders, onboarded_at'
    )
    .eq('property_id', propertyId)
    .maybeSingle();
  if (error) {
    console.error('[marketing-planner] settings:', error);
    return null;
  }
  return (data ?? null) as PlannerSettingsRow | null;
}

async function loadLastPublication(propertyId: string): Promise<{
  lastFeedPostOn: string | null;
  lastReelOn: string | null;
}> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('marketing_publications')
    .select('publish_type, published_at')
    .eq('property_id', propertyId)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(30);
  if (error) {
    console.error('[marketing-planner] publications:', error);
    return { lastFeedPostOn: null, lastReelOn: null };
  }
  let lastFeedPostOn: string | null = null;
  let lastReelOn: string | null = null;
  for (const row of data ?? []) {
    const publishedAt = typeof row.published_at === 'string' ? row.published_at.slice(0, 10) : null;
    if (!publishedAt) continue;
    if (!lastReelOn && row.publish_type === 'reel') lastReelOn = publishedAt;
    if (!lastFeedPostOn && row.publish_type !== 'reel') lastFeedPostOn = publishedAt;
  }
  return { lastFeedPostOn, lastReelOn };
}

async function loadUsedOpportunityKeys(propertyId: string): Promise<Set<string>> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('marketing_plan_items')
    .select('opportunity_key')
    .eq('property_id', propertyId)
    .is('deleted_at', null)
    .not('opportunity_key', 'is', null)
    .not('status', 'in', '(skipped,expired,failed)')
    .limit(2000);
  if (error) {
    console.error('[marketing-planner] existing items:', error);
    return new Set();
  }
  return new Set(
    (data ?? [])
      .map((row) => (typeof row.opportunity_key === 'string' ? row.opportunity_key : null))
      .filter((key): key is string => key !== null)
  );
}

async function loadAssetCounts(propertyId: string): Promise<number> {
  const supabase = createServiceClient();
  const { count, error } = await supabase
    .from('marketing_media_assets')
    .select('id', { count: 'exact', head: true })
    .eq('property_id', propertyId);
  if (error) return 0;
  return count ?? 0;
}

/** Every night that is occupied or blocked, from bookings and manual/OTA blocks. */
export async function loadBlockedNightKeys(propertyId: string): Promise<Set<string>> {
  const [bookingRanges, blockedKeys] = await Promise.all([
    DatabaseService.listBookingRangesForAvailability(propertyId).catch(() => []),
    loadBlockedDateKeys(propertyId).catch(() => [] as string[]),
  ]);
  const blocked = new Set<string>(blockedKeys);
  for (const night of collectBlockedNights(bookingRanges)) blocked.add(night);
  return blocked;
}

/**
 * Best posting hour per weekday from the property's own results. Null until it has enough
 * published posts with insights, so the defaults keep working for a new property.
 */
export async function loadLearnedPreferredHours(
  propertyId: string
): Promise<Record<number, number> | null> {
  const supabase = createServiceClient();
  const { data: metrics, error } = await supabase
    .from('marketing_post_metrics')
    .select('publication_id, views, interactions')
    .eq('property_id', propertyId)
    .not('views', 'is', null)
    .limit(500);
  if (error || !metrics || metrics.length === 0) return null;

  const publicationIds = [
    ...new Set(
      metrics
        .map((row) => (typeof row.publication_id === 'string' ? row.publication_id : null))
        .filter((id): id is string => id !== null)
    ),
  ];
  if (publicationIds.length === 0) return null;

  const { data: publications, error: publicationError } = await supabase
    .from('marketing_publications')
    .select('id, published_at')
    .in('id', publicationIds)
    .limit(500);
  if (publicationError || !publications) return null;

  const publishedById = new Map<string, string>();
  for (const row of publications) {
    if (typeof row.id === 'string' && typeof row.published_at === 'string') {
      publishedById.set(row.id, row.published_at);
    }
  }

  const samples: TimingSample[] = [];
  for (const row of metrics) {
    const publicationId = typeof row.publication_id === 'string' ? row.publication_id : null;
    const publishedAt = publicationId ? publishedById.get(publicationId) : undefined;
    if (!publishedAt) continue;
    const manila = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Manila',
      weekday: 'short',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(new Date(publishedAt));
    const weekdayLabel = manila.find((part) => part.type === 'weekday')?.value ?? '';
    const hour = Number(manila.find((part) => part.type === 'hour')?.value ?? '-1');
    const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weekday = order.indexOf(weekdayLabel) + 1;
    if (weekday < 1 || hour < 0) continue;
    samples.push({
      weekday,
      hour,
      views: Number(row.views) || 0,
      engagement: Number(row.interactions) || 0,
    });
  }

  const learned = bestLearnedWindows(samples);
  if (!learned) return null;

  const byWeekday: Record<number, number> = {};
  for (const window of learned) {
    if (byWeekday[window.weekday] == null) byWeekday[window.weekday] = window.startHour;
  }
  return Object.keys(byWeekday).length > 0 ? byWeekday : null;
}

/** Months inside the horizon with no open night at all. */
function fullyBookedMonths(blocked: ReadonlySet<string>, today: string, horizonEnd: string): string[] {
  const months = new Set<string>();
  let cursor = today;
  while (cursor <= horizonEnd) {
    months.add(cursor.slice(0, 7));
    cursor = addDaysYmd(cursor, 1);
  }
  const out: string[] = [];
  for (const month of months) {
    const [year, monthIndex] = [Number(month.slice(0, 4)), Number(month.slice(5, 7))];
    const daysInMonth = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
    let hasOpen = false;
    for (let day = 1; day <= daysInMonth; day += 1) {
      const ymd = `${month}-${String(day).padStart(2, '0')}`;
      if (ymd < today || ymd > horizonEnd) continue;
      if (!blocked.has(ymd)) {
        hasOpen = true;
        break;
      }
    }
    if (!hasOpen) out.push(month);
  }
  return out;
}

/**
 * Load everything one planning run needs. A failing sub-load degrades that signal
 * only; the planner still produces a plan from what it has.
 */
export async function loadPlannerInputs(propertyId: string): Promise<PlannerInputs> {
  const supabase = createServiceClient();
  const today = manilaTodayYmd();
  const horizonEnd = addDaysYmd(today, PLANNER_HORIZON_DAYS);

  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('id, name, city, organization_id, settings')
    .eq('id', propertyId)
    .single();
  if (propertyError || !property) {
    throw new Error('Property not found');
  }

  const from90 = addDaysYmd(today, -90);

  const [bundle, bookingRanges, blockedKeys, events, reviews, pricing, settingsRow, lastPost, usedKeys, photoCount] =
    await Promise.all([
      computeAnalyticsBundle({ propertyId, from: from90, to: today }).catch(() => null),
      DatabaseService.listBookingRangesForAvailability(propertyId).catch(() => []),
      loadBlockedDateKeys(propertyId).catch(() => [] as string[]),
      loadCalendarEvents(propertyId, addDaysYmd(today, -7), horizonEnd).catch(() => []),
      listPropertyGuestReviewsForMarketing(propertyId, { limit: 20 }).catch(() => []),
      loadPropertyPricing(propertyId).catch(() => null),
      loadPlannerSettings(propertyId),
      loadLastPublication(propertyId),
      loadUsedOpportunityKeys(propertyId),
      loadAssetCounts(propertyId),
    ]);

  const blockedNights = new Set<string>(blockedKeys);
  for (const night of collectBlockedNights(bookingRanges)) blockedNights.add(night);

  const openHorizonNights = nextDays(today, PLANNER_HORIZON_DAYS).filter(
    (ymd) => !blockedNights.has(ymd)
  );

  const liveRates = pricing
    ? openHorizonNights
        .map((ymd) => resolveNightlyRate(pricing, ymd))
        .filter((rate): rate is number => rate != null)
    : [];
  const liveRateFrom = liveRates.length > 0 ? Math.min(...liveRates) : null;
  const referenceRateFrom = pricing
    ? Math.min(
        ...[pricing.weekdayNightlyRate, pricing.weekendNightlyRate].filter((rate) => rate > 0)
      )
    : null;

  const settingsObject =
    property.settings && typeof property.settings === 'object'
      ? (property.settings as Record<string, unknown>)
      : {};
  const amenities = Array.isArray(settingsObject.amenities)
    ? (settingsObject.amenities as unknown[]).filter(
        (item): item is string => typeof item === 'string'
      )
    : [];

  const reviewCandidates: PlannerReviewCandidate[] = reviews
    .filter((review) => review.socialSeedAllowed)
    .map((review) => ({
      id: review.id,
      rating: review.rating,
      createdAt: (review.createdAt ?? review.date ?? '').slice(0, 10),
    }))
    .filter((review) => review.createdAt.length === 10);

  const topReviewTags = reviews
    .flatMap((review) => review.feedbackTags)
    .reduce<Map<string, number>>((counts, tag) => {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
      return counts;
    }, new Map());
  const sortedTags = [...topReviewTags.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);

  const adr = bundle?.kpis.adr.value ?? 0;
  const nightlyValue = adr > 0 ? adr : (referenceRateFrom ?? liveRateFrom ?? 0);

  const cadencePreset = asCadencePreset(settingsRow?.cadence_preset);
  const customCadence =
    settingsRow?.cadence && typeof settingsRow.cadence === 'object'
      ? (settingsRow.cadence as Record<string, unknown>)
      : null;

  const settings: PlannerSettingsShape = {
    cadencePreset,
    customCadence:
      customCadence && cadencePreset === 'custom'
        ? {
            feedPostsPerWeek: Number(customCadence.feedPostsPerWeek ?? 3),
            reelsPerWeek: Number(customCadence.reelsPerWeek ?? 2),
            storiesPerWeek: Number(customCadence.storiesPerWeek ?? 5),
            maxItemsPerDay: Number(customCadence.maxItemsPerDay ?? 3),
          }
        : null,
    goals: asStringArray(settingsRow?.goals),
    channels: parseChannelSettings(settingsRow?.channels),
    language: asLanguage(settingsRow?.language),
    postingWindows: null,
  };

  const signals: PlannerSignalsInput = {
    today,
    horizonEnd,
    blockedNights,
    forwardOccupancyState: bundle?.stateAssessment.forwardOccupancyState30d ?? 'building',
    medianLeadDays:
      medianFromBuckets(bundle?.distributions.leadTime ?? []) ??
      (bundle?.kpis.avgLeadTimeDays.value ? bundle.kpis.avgLeadTimeDays.value : null),
    gapNights: (bundle?.forward.gapNights ?? []).map((entry) => entry.date),
    events,
    reviews: reviewCandidates,
    liveRateFrom,
    referenceRateFrom,
    nightlyValue,
    goals: settings.goals,
    channels: settings.channels.map((channel) => channel.kind),
    lastFeedPostOn: lastPost.lastFeedPostOn,
    lastReelOn: lastPost.lastReelOn,
    minStayNights: 1,
    usedOpportunityKeys: usedKeys,
    usedReviewIds: new Set<string>(),
    usedAmenities: new Set<string>(),
    amenities,
    topReviewTags: sortedTags.slice(0, 5),
    partySizePeak: peakPartySize(bundle?.distributions.partySize ?? []),
    photoCount,
    // Photo ranking lands with the Prepare phase; reframes only fire once it exists.
    unusedPhotoCount: 0,
    otaShareTop: topChannelShare(bundle?.distributions.channelMix ?? []),
    monthsFullyBooked: fullyBookedMonths(blockedNights, today, horizonEnd),
    reviewAvg: bundle?.kpis.avgRating.value ?? null,
    reviewCount: bundle?.sufficiency.sampleSize ?? null,
  };

  return {
    signals,
    learnedPreferredHours: await loadLearnedPreferredHours(propertyId).catch(() => null),
    propertyName: String(property.name ?? 'this property'),
    settings,
    settingsRow,
    organizationId: String(property.organization_id),
    horizonEnd,
  };
}

/** Exposed for tests: the cadence shape a stored settings row resolves to. */
export function settingsCadence(settings: PlannerSettingsShape) {
  return resolveCadence(settings.cadencePreset, settings.customCadence);
}
