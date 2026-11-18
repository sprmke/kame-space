/**
 * What a lower plan actually touches for this org: quantities the host can act on before the
 * change lands (team seats, calendar feeds, scheduled posts, Smart Pricing, AI credits, search
 * visibility). Feature on/off lists are rendered by the client from the plan feature maps; this
 * adds the real usage behind them. Nothing here deletes data: past output stays viewable.
 */

import { createServiceClient } from './orgAuth.ts';
import { countOrgWideTeamSlots } from './planEntitlements.ts';
import { isFeatureEnabled, parsePlanFeatures, type PlanFeatures } from './planFeatures.ts';

export type PlanImpactItem = {
  key:
    | 'team_seats'
    | 'calendar_feeds'
    | 'scheduled_posts'
    | 'smart_pricing'
    | 'ai_credits'
    | 'search_visibility';
  label: string;
  detail: string;
  /** How many records are affected (0 for pure setting changes). */
  count: number;
};

export type UsageSnapshot = {
  teamSeatsInUse: number;
  activeCalendarFeeds: number;
  scheduledPosts: number;
  smartPricingEnabledProperties: number;
};

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

function seatBudget(features: PlanFeatures): number | null {
  if (!features.teamManagement.enabled) return 0;
  return features.teamManagement.maxMembers;
}

/** Pure: usage + old/new plan features -> the items worth telling the host about. */
export function describePlanImpact(
  from: PlanFeatures,
  to: PlanFeatures,
  usage: UsageSnapshot,
  toPlanName: string
): PlanImpactItem[] {
  const items: PlanImpactItem[] = [];

  const budget = seatBudget(to);
  if (budget !== null && usage.teamSeatsInUse > budget) {
    const over = usage.teamSeatsInUse - budget;
    items.push({
      key: 'team_seats',
      label: 'Team seats',
      count: over,
      detail: `${toPlanName} allows ${budget} ${plural(budget, 'seat', 'seats')} and you use ${usage.teamSeatsInUse}. The newest ${over} ${plural(over, 'member is', 'members are')} paused when the plan changes. Nothing is deleted, and they come back if you upgrade.`,
    });
  }

  if (from.calendarSync && !to.calendarSync && usage.activeCalendarFeeds > 0) {
    items.push({
      key: 'calendar_feeds',
      label: 'Calendar sync',
      count: usage.activeCalendarFeeds,
      detail: `${usage.activeCalendarFeeds} connected ${plural(usage.activeCalendarFeeds, 'calendar stops', 'calendars stop')} syncing. Existing bookings and blocked dates stay.`,
    });
  }

  const publishLost =
    isFeatureEnabled(from, 'marketingPublishLimitPerGroup') &&
    !isFeatureEnabled(to, 'marketingPublishLimitPerGroup');
  if ((from.marketingStudio && !to.marketingStudio) || publishLost) {
    if (usage.scheduledPosts > 0) {
      items.push({
        key: 'scheduled_posts',
        label: 'Scheduled posts',
        count: usage.scheduledPosts,
        detail: `${usage.scheduledPosts} scheduled ${plural(usage.scheduledPosts, 'post is', 'posts are')} not published after the change. Posts already live on Facebook and Instagram stay up.`,
      });
    }
  }

  if (from.smartPricing && !to.smartPricing && usage.smartPricingEnabledProperties > 0) {
    items.push({
      key: 'smart_pricing',
      label: 'Smart Pricing',
      count: usage.smartPricingEnabledProperties,
      detail: `Smart Pricing is on for ${usage.smartPricingEnabledProperties} ${plural(usage.smartPricingEnabledProperties, 'property', 'properties')}. Rates go back to your own prices. Your saved settings are kept.`,
    });
  }

  if (from.aiMonthlyCreditAllowance !== to.aiMonthlyCreditAllowance) {
    items.push({
      key: 'ai_credits',
      label: 'AI credits',
      count: 0,
      detail:
        to.aiMonthlyCreditAllowance > 0
          ? `Your monthly AI credits go from ${from.aiMonthlyCreditAllowance.toLocaleString('en-PH')} to ${to.aiMonthlyCreditAllowance.toLocaleString('en-PH')}.`
          : `Monthly AI credits stop (${from.aiMonthlyCreditAllowance.toLocaleString('en-PH')} today). Credits you bought separately are not affected.`,
    });
  }

  if (from.searchVisibilityTier !== to.searchVisibilityTier) {
    items.push({
      key: 'search_visibility',
      label: 'Search visibility',
      count: 0,
      detail:
        to.searchVisibilityTier === 'none'
          ? 'Your listings no longer get a boost in Kame Space search.'
          : 'Your listings rank lower in Kame Space search.',
    });
  }

  return items;
}

async function safeCount(
  run: () => PromiseLike<{ count: number | null; error: unknown }>
): Promise<number> {
  try {
    const { count, error } = await run();
    return error ? 0 : (count ?? 0);
  } catch {
    return 0;
  }
}

export async function loadUsageSnapshot(organizationId: string): Promise<UsageSnapshot> {
  const sb = createServiceClient();
  const { data: properties } = await sb
    .from('properties')
    .select('id')
    .eq('organization_id', organizationId)
    .limit(5000);
  const ids = (properties ?? []).map((row) => row.id as string);
  if (ids.length === 0) {
    return {
      teamSeatsInUse: 0,
      activeCalendarFeeds: 0,
      scheduledPosts: 0,
      smartPricingEnabledProperties: 0,
    };
  }

  let teamSeatsInUse = 0;
  try {
    teamSeatsInUse = await countOrgWideTeamSlots(organizationId);
  } catch (err) {
    console.error('[planChangeImpact] team seats', err);
  }

  const chunk = ids.slice(0, 500);
  const [activeCalendarFeeds, scheduledPosts, smartPricingEnabledProperties] = await Promise.all([
    safeCount(() =>
      sb
        .from('property_calendar_feeds')
        .select('id', { count: 'exact', head: true })
        .in('property_id', chunk)
        .eq('is_active', true)
    ),
    safeCount(() =>
      sb
        .from('marketing_publications')
        .select('id', { count: 'exact', head: true })
        .in('property_id', chunk)
        .eq('status', 'pending')
        .not('scheduled_at', 'is', null)
    ),
    safeCount(() =>
      sb
        .from('property_smart_pricing_settings')
        .select('property_id', { count: 'exact', head: true })
        .in('property_id', chunk)
        .eq('enabled', true)
    ),
  ]);

  return { teamSeatsInUse, activeCalendarFeeds, scheduledPosts, smartPricingEnabledProperties };
}

export async function loadPlanChangeImpact(input: {
  organizationId: string;
  fromFeatures: unknown;
  toFeatures: unknown;
  toPlanName: string;
}): Promise<PlanImpactItem[]> {
  const usage = await loadUsageSnapshot(input.organizationId);
  return describePlanImpact(
    parsePlanFeatures(input.fromFeatures),
    parsePlanFeatures(input.toFeatures),
    usage,
    input.toPlanName
  );
}
