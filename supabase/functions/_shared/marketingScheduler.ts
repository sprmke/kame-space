/**
 * Marketing Planner scheduler — turns ranked opportunities into dated, formatted
 * items. Pure: no clock, no DB, no network.
 *
 * The scheduler owns dates, times, formats and channels. Neither the host nor the
 * AI can add those; they can only edit or skip what this produces.
 */

import { addDaysYmd, calendarDaysBetween } from './calendarAvailabilityManila.ts';
import { fillTemplate, resolveCopyTemplate, type PlannerLanguage } from './marketingCopyLibrary.ts';
import type { PlannerClaims } from './marketingClaims.ts';
import { isWithinQuietHours, resolveCadence, type CadencePreset, type CadenceShape } from './marketingPlaybook.ts';
import type { MarketingFormat, Pillar } from './marketingPlaybook.ts';
import type { PlannerOpportunity } from './marketingSignals.ts';
import type { PostingWindow } from './marketingPlaybook.ts';
import { DEFAULT_POSTING_WINDOWS } from './marketingPlaybook.ts';

export type PlannerChannelSetting =
  | { kind: 'facebook_page' | 'instagram'; connectionId: string }
  | {
      kind:
        | 'facebook_group'
        | 'tiktok'
        | 'messenger'
        | 'viber'
        | 'whatsapp'
        | 'google_business'
        | 'other';
      label: string;
      url?: string;
    };

export type PlannerSettingsShape = {
  cadencePreset: CadencePreset;
  customCadence: CadenceShape | null;
  goals: readonly string[];
  channels: readonly PlannerChannelSetting[];
  language: PlannerLanguage;
  postingWindows: readonly PostingWindow[] | null;
};

export type SchedulerInput = {
  /** Manila today, YYYY-MM-DD. Fixed once per run. */
  today: string;
  /** Manila minutes from midnight, so "today" slots are never in the past. */
  nowMinute: number;
  horizonEnd: string;
  opportunities: readonly PlannerOpportunity[];
  settings: PlannerSettingsShape;
  /** Opportunity keys that already have a live item; regenerating never duplicates. */
  existingOpportunityKeys: ReadonlySet<string>;
  propertyName: string;
  /**
   * Learned best hour per weekday (1 to 7), from the property's own post results. Absent
   * until the property has enough published posts with insights.
   */
  preferredHourByWeekday?: Readonly<Record<number, number>> | null;
};

export type PlannerItemDraft = {
  opportunityType: PlannerOpportunity['type'];
  opportunityKey: string;
  pillar: Pillar;
  title: string;
  hook: string;
  message: string;
  cta: string;
  format: MarketingFormat;
  channelKind: PlannerChannelSetting['kind'];
  manualTargets: string[];
  /** ISO timestamp with the Manila offset. */
  scheduledFor: string;
  postBy: string;
  targetFrom: string | null;
  targetTo: string | null;
  claims: PlannerClaims;
  evidence: string;
  score: number;
};

const FORMAT_WINDOW_INDEX: Record<MarketingFormat, 0 | 1 | 2> = {
  story: 0,
  carousel: 1,
  calendar: 1,
  post: 2,
  reel: 2,
};

function minutesOfDay(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function resolveWindows(settings: PlannerSettingsShape): readonly PostingWindow[] {
  const windows =
    settings.postingWindows && settings.postingWindows.length > 0
      ? settings.postingWindows
      : DEFAULT_POSTING_WINDOWS;
  return windows.filter((window) => !isWithinQuietHours(window.startMinute));
}

function pickChannel(
  settings: PlannerSettingsShape
): Pick<PlannerChannelSetting, 'kind'> & { manualTargets: string[] } {
  const connected = settings.channels.find(
    (channel) => channel.kind === 'facebook_page' || channel.kind === 'instagram'
  );
  if (connected) return { kind: connected.kind, manualTargets: [] };

  const manual = settings.channels.find(
    (channel) => channel.kind !== 'facebook_page' && channel.kind !== 'instagram'
  );
  if (manual) {
    const labels = settings.channels
      .filter((channel) => channel.kind === manual.kind)
      .map((channel) => ('label' in channel ? channel.label : channel.kind));
    return { kind: manual.kind, manualTargets: labels.slice(0, 10) };
  }

  // Nothing connected and nothing listed: still plan it, as manual share.
  return { kind: 'facebook_group', manualTargets: [] };
}

type Budget = {
  feed: number;
  reel: number;
  story: number;
};

const FEED_FORMATS: readonly MarketingFormat[] = ['post', 'carousel', 'calendar'];

/** Pick the first preferred format with budget left, and spend it. */
function chooseFormat(
  opportunity: PlannerOpportunity,
  budget: Budget
): MarketingFormat | null {
  for (const format of opportunity.formats) {
    if (format === 'reel' && budget.reel > 0) {
      budget.reel -= 1;
      return format;
    }
    if (format === 'story' && budget.story > 0) {
      budget.story -= 1;
      return format;
    }
    if (FEED_FORMATS.includes(format) && budget.feed > 0) {
      budget.feed -= 1;
      return format;
    }
  }
  return null;
}

function dayOfWeek(ymd: string): number {
  const [year, month, day] = ymd.split('-').map(Number);
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return dow === 0 ? 7 : dow;
}

function slotForDay(
  ymd: string,
  format: MarketingFormat,
  windows: readonly PostingWindow[],
  isToday: boolean,
  nowMinute: number,
  preferredHour: number | null
): { ymd: string; minuteOfDay: number } | null {
  // A learned hour wins when it is a sane time and has not passed yet today.
  if (preferredHour != null && preferredHour >= 0 && preferredHour < 24) {
    const minuteOfDay = preferredHour * 60;
    if (!isWithinQuietHours(minuteOfDay) && !(isToday && minuteOfDay <= nowMinute)) {
      return { ymd, minuteOfDay };
    }
  }

  const preferred = FORMAT_WINDOW_INDEX[format];
  const order = [preferred, 0, 1, 2];
  for (const index of order) {
    const window = windows[index];
    if (!window) continue;
    if (isToday && window.startMinute <= nowMinute) continue;
    if (isWithinQuietHours(window.startMinute)) continue;
    return { ymd, minuteOfDay: window.startMinute };
  }
  return null;
}

function copyVars(
  opportunity: PlannerOpportunity,
  item: { claims: PlannerClaims },
  propertyName: string
): Record<string, string> {
  const vars: Record<string, string> = { propertyName };
  const open = item.claims.openNights ?? [];
  if (open.length > 0) {
    vars.dates = open
      .map((ymd) => {
        const [year, month, day] = ymd.split('-').map(Number);
        return new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        }).format(new Date(Date.UTC(year, month - 1, day)));
      })
      .join(', ');
    vars.nightsLeft =
      open.length === 1 ? '1 night' : `${open.length} nights`;
  }
  if (item.claims.nightsLeftInMonth != null) {
    vars.nightsLeft = `${item.claims.nightsLeftInMonth} ${
      item.claims.nightsLeftInMonth === 1 ? 'date' : 'dates'
    }`;
  }
  if (item.claims.rateFrom != null) {
    vars.rate = String(item.claims.rateFrom);
  }
  if (item.claims.rating) {
    vars.rating = item.claims.rating.avg.toFixed(1);
    vars.reviewCount = String(item.claims.rating.count);
  }
  if (opportunity.label) {
    vars.eventName = opportunity.label;
    vars.amenity = opportunity.label;
  }
  return vars;
}

/**
 * Build the drafts for a run. Items are ordered by score; each one has a real
 * date and time no earlier than now, inside the horizon, never inside quiet hours.
 */
export function scheduleItems(input: SchedulerInput): PlannerItemDraft[] {
  const cadence = resolveCadence(input.settings.cadencePreset, input.settings.customCadence);
  const horizonDays = calendarDaysBetween(input.today, input.horizonEnd) + 1;
  const weeks = Math.max(1, horizonDays / 7);
  const budget: Budget = {
    feed: Math.max(1, Math.round(cadence.feedPostsPerWeek * weeks)),
    reel: Math.max(1, Math.round(cadence.reelsPerWeek * weeks)),
    story: Math.max(1, Math.round(cadence.storiesPerWeek * weeks)),
  };

  const windows = resolveWindows(input.settings);
  const perDay = new Map<string, number>();
  const channel = pickChannel(input.settings);
  const drafts: PlannerItemDraft[] = [];

  for (const opportunity of input.opportunities) {
    if (input.existingOpportunityKeys.has(opportunity.key)) continue;

    const format = chooseFormat(opportunity, budget);
    if (!format) break;

    const preferredDay = opportunity.postBy < input.today ? input.today : opportunity.postBy;
    let slot: { ymd: string; minuteOfDay: number } | null = null;
    let day = preferredDay <= input.horizonEnd ? preferredDay : null;

    while (day && !slot) {
      const used = perDay.get(day) ?? 0;
      if (used < cadence.maxItemsPerDay) {
        slot = slotForDay(
          day,
          format,
          windows,
          day === input.today,
          input.nowMinute,
          input.preferredHourByWeekday?.[dayOfWeek(day)] ?? null
        );
      }
      if (!slot) day = day >= input.horizonEnd ? null : addDaysYmd(day, 1);
    }

    if (!slot) {
      // No room left in the horizon: skip and release the budget we just took.
      if (format === 'reel') budget.reel += 1;
      else if (format === 'story') budget.story += 1;
      else budget.feed += 1;
      continue;
    }

    perDay.set(slot.ymd, (perDay.get(slot.ymd) ?? 0) + 1);

    const template = resolveCopyTemplate(opportunity.type, input.settings.language);
    const filled = fillTemplate(template, copyVars(opportunity, opportunity, input.propertyName));

    drafts.push({
      opportunityType: opportunity.type,
      opportunityKey: opportunity.key,
      pillar: opportunity.pillar,
      title: filled.title,
      hook: filled.hook,
      message: filled.message,
      cta: filled.cta,
      format,
      channelKind: channel.kind,
      manualTargets: channel.manualTargets,
      scheduledFor: `${slot.ymd}T${formatTime(slot.minuteOfDay)}:00+08:00`,
      postBy: opportunity.postBy,
      targetFrom: opportunity.targetFrom,
      targetTo: opportunity.targetTo,
      claims: opportunity.claims,
      evidence: opportunity.evidence,
      score: opportunity.score,
    });
  }

  return drafts;
}
