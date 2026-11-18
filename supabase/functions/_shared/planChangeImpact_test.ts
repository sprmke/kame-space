import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { describePlanImpact, type UsageSnapshot } from './planChangeImpact.ts';
import { DEFAULT_PLAN_FEATURES, type PlanFeatures } from './planFeatures.ts';

const pro: PlanFeatures = {
  ...DEFAULT_PLAN_FEATURES,
  teamManagement: { enabled: true, maxMembers: 5 },
  calendarSync: true,
  smartPricing: true,
  marketingStudio: true,
  marketingPublishLimitPerGroup: null,
  aiMonthlyCreditAllowance: 1000,
  searchVisibilityTier: 'top30',
};
const starter: PlanFeatures = {
  ...DEFAULT_PLAN_FEATURES,
  teamManagement: { enabled: true, maxMembers: 3 },
  aiMonthlyCreditAllowance: 0,
};
const none: UsageSnapshot = {
  teamSeatsInUse: 0,
  activeCalendarFeeds: 0,
  scheduledPosts: 0,
  smartPricingEnabledProperties: 0,
};

Deno.test('impact lists only what the host actually uses', () => {
  const items = describePlanImpact(pro, starter, none, 'Starter');
  assertEquals(
    items.map((i) => i.key),
    ['ai_credits', 'search_visibility']
  );
});

Deno.test('impact reports team seats over the new limit', () => {
  const items = describePlanImpact(pro, starter, { ...none, teamSeatsInUse: 5 }, 'Starter');
  const team = items.find((i) => i.key === 'team_seats');
  assertEquals(team?.count, 2);
});

Deno.test(
  'impact reports feeds, scheduled posts and smart pricing when the feature is lost',
  () => {
    const items = describePlanImpact(
      pro,
      starter,
      { ...none, activeCalendarFeeds: 2, scheduledPosts: 4, smartPricingEnabledProperties: 3 },
      'Starter'
    );
    const byKey = Object.fromEntries(items.map((i) => [i.key, i.count]));
    assertEquals(byKey.calendar_feeds, 2);
    assertEquals(byKey.scheduled_posts, 4);
    assertEquals(byKey.smart_pricing, 3);
  }
);

Deno.test('impact is quiet when moving between plans with the same features', () => {
  assertEquals(describePlanImpact(pro, pro, { ...none, teamSeatsInUse: 5 }, 'Pro'), []);
});

Deno.test('team plan disabled means every seat is over budget', () => {
  const noTeam: PlanFeatures = { ...starter, teamManagement: { enabled: false, maxMembers: null } };
  const items = describePlanImpact(pro, noTeam, { ...none, teamSeatsInUse: 2 }, 'Free');
  assertEquals(items.find((i) => i.key === 'team_seats')?.count, 2);
});
