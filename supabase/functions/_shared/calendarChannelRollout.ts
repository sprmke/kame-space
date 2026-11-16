/**
 * Runtime rollout gate for calendar channels.
 *
 * `calendarChannels.ts` says what a channel *is*. This says who may *connect* it right now, so
 * Agoda and Booking.com can reach the test tenant, then named beta orgs, then everyone, without
 * a code deploy. Production stays Airbnb-only until the secrets below are set.
 *
 *   CALENDAR_CHANNELS_ENABLED       comma list of providers, e.g. `agoda,booking_com`
 *   CALENDAR_CHANNELS_BETA_ORG_IDS  optional comma list of organization ids. Empty = everyone.
 *
 * Fail-closed: a typo or an unknown provider enables nothing. Existing feeds are never affected
 * (cron, Sync now and export keep working); this only gates adding a new connection.
 *
 * Plan: docs/workflow/in-progress/multi-channel-calendar-sync.md §4.9, §11
 */

import {
  CALENDAR_CHANNELS,
  type CalendarFeedProvider,
} from './calendarChannels.ts';

export interface CalendarRolloutEnv {
  enabled?: string | null;
  betaOrgIds?: string | null;
}

/** Providers the rollout env may ever enable. `other` needs resolved-address pinning first. */
const ROLLOUT_ELIGIBLE: ReadonlySet<CalendarFeedProvider> = new Set([
  'agoda',
  'booking_com',
  'vrbo',
]);

function splitList(raw: string | null | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function readCalendarRolloutEnv(): CalendarRolloutEnv {
  return {
    enabled: Deno.env.get('CALENDAR_CHANNELS_ENABLED'),
    betaOrgIds: Deno.env.get('CALENDAR_CHANNELS_BETA_ORG_IDS'),
  };
}

/** Providers a host in `organizationId` may connect today. Airbnb is always first. */
export function connectableProvidersFor(
  organizationId: string | null | undefined,
  env: CalendarRolloutEnv = readCalendarRolloutEnv()
): CalendarFeedProvider[] {
  const baseline = CALENDAR_CHANNELS.filter((c) => c.enabledForNewConnections).map(
    (c) => c.provider
  );

  const requested = new Set(splitList(env.enabled));
  const betaOrgs = splitList(env.betaOrgIds);
  const inBeta = betaOrgs.length === 0 || (!!organizationId && betaOrgs.includes(organizationId.toLowerCase()));

  const extra = inBeta
    ? CALENDAR_CHANNELS.filter(
        (c) =>
          !c.enabledForNewConnections &&
          ROLLOUT_ELIGIBLE.has(c.provider) &&
          requested.has(c.provider)
      ).map((c) => c.provider)
    : [];

  return [...baseline, ...extra];
}

export function isProviderConnectable(
  provider: CalendarFeedProvider,
  organizationId: string | null | undefined,
  env?: CalendarRolloutEnv
): boolean {
  return connectableProvidersFor(organizationId, env).includes(provider);
}
