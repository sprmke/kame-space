/**
 * Route to bottom-tab mapping for the v3 phone shell (`docs/workflow/in-progress/mobile-native-app-redesign.md`).
 *
 * Pure and path-only so the shell, tab memory and tests agree. Tab sets:
 *   property / parking  Today · Bookings · Inbox · Work · You
 *   org                 Today · Bookings · Alerts · Work · You   (org has alerts, no messages)
 *   super-admin         Overview · Approvals · Orgs · Support · Console
 *
 * Unknown routes default to the scope's catch-all (Work / Console) so a new module is never
 * left with no active tab. Modules live in Work; account, plan, preferences and help in You.
 */

export type AdminTabScope = 'property' | 'parking' | 'org' | 'super-admin';

export type AdminTabKey =
  | 'today'
  | 'bookings'
  | 'inbox'
  | 'alerts'
  | 'work'
  | 'you'
  | 'overview'
  | 'approvals'
  | 'orgs'
  | 'support'
  | 'console';

const PROPERTY_PATH = /^\/org\/[^/]+\/property\/[^/]+(?:\/(.*))?$/;
const PARKING_PATH = /^\/org\/[^/]+\/parking\/[^/]+(?:\/(.*))?$/;
const ORG_PATH = /^\/org\/[^/]+(?:\/(.*))?$/;
const SUPER_ADMIN_PATH = /^\/admin(?:\/(.*))?$/;

function normalize(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0] ?? '';
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

/** First path segment of the part after the scope root ('' for the scope index). */
function section(rest: string | undefined): string {
  return (rest ?? '').split('/', 1)[0] ?? '';
}

export function adminTabScope(pathname: string): AdminTabScope | null {
  const path = normalize(pathname);
  if (SUPER_ADMIN_PATH.test(path)) return 'super-admin';
  if (PROPERTY_PATH.test(path)) return 'property';
  if (PARKING_PATH.test(path)) return 'parking';
  if (ORG_PATH.test(path)) return 'org';
  return null;
}

const YOU_SECTIONS = new Set(['you', 'plans', 'help-support']);

function propertyOrParkingTab(rest: string | undefined): AdminTabKey {
  const first = section(rest);
  if (first === '') return 'today';
  if (first === 'bookings') return 'bookings';
  // The notifications page is the Alerts feed; its settings move to You in Phase 6.
  if (first === 'inbox' || first === 'notifications') return 'inbox';
  if (YOU_SECTIONS.has(first)) return 'you';
  return 'work';
}

function orgTab(rest: string | undefined): AdminTabKey {
  const first = section(rest);
  if (first === '' || first === 'dashboard') return 'today';
  if (first === 'bookings') return 'bookings';
  if (first === 'alerts' || first === 'notifications' || first === 'inbox') return 'alerts';
  if (YOU_SECTIONS.has(first)) return 'you';
  return 'work';
}

const SUPER_ADMIN_TABS: Record<string, AdminTabKey> = {
  approvals: 'approvals',
  orgs: 'orgs',
  hosts: 'orgs',
  support: 'support',
  console: 'console',
};

function superAdminTab(rest: string | undefined): AdminTabKey {
  const first = section(rest);
  if (first === '') return 'overview';
  return SUPER_ADMIN_TABS[first] ?? 'console';
}

/**
 * Active bottom tab for a pathname, or `null` outside the admin shell (public and guest
 * routes use their own tab bars).
 */
export function adminTabForRoute(pathname: string): AdminTabKey | null {
  const path = normalize(pathname);

  const superAdmin = SUPER_ADMIN_PATH.exec(path);
  if (superAdmin) return superAdminTab(superAdmin[1]);

  const property = PROPERTY_PATH.exec(path);
  if (property) return propertyOrParkingTab(property[1]);

  const parking = PARKING_PATH.exec(path);
  if (parking) return propertyOrParkingTab(parking[1]);

  const org = ORG_PATH.exec(path);
  if (org) return orgTab(org[1]);

  return null;
}
