/** Banner on org/property team when plan_limited inactive members exist. */
export function planLimitedTeamBannerMessage(count: number): string {
  if (count === 1) {
    return '1 member is paused because your plan seat limit is full. Free a seat or upgrade your plan.';
  }
  return `${count} members are paused because your plan seat limit is full. Free seats or upgrade your plan.`;
}

/** Full-page gate when the signed-in user's own seat is paused by plan limits. */
export function planLimitedAccessDeniedTitle(): string {
  return 'Access paused';
}

export function planLimitedAccessDeniedMessage(scope: 'org' | 'property'): string {
  if (scope === 'property') {
    return 'Your seat was paused after a plan limit or downgrade. Ask the owner to upgrade or free a seat.';
  }
  return 'Your seat was paused after a plan limit or downgrade. Ask the organization owner to upgrade or free a seat.';
}
