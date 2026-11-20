import {
  Bell,
  CalendarDays,
  Grid2x2,
  Home,
  MessageSquare,
  UserRound,
} from 'lucide-react';

import { ADMIN_MODULE_LABEL } from '@/features/dashboard/bookings/lib/adminModuleLabels';
import type {
  SidebarNavItem,
  SidebarNavSection,
} from '@/features/dashboard/bookings/lib/adminSidebarNav';
import {
  type AdminTabKey,
  type AdminTabScope,
  adminTabForRoute,
  adminTabScope,
} from '@/features/dashboard/bookings/lib/adminTabForRoute';

import type { BottomTabItem } from '@/components/mobile/BottomTabBar';
import { MORE_TAB_KEY, moreTabItem } from '@/components/mobile/BottomTabBar';

/** @deprecated Overlay tabs removed in v3; kept for tests that still import the symbol. */
export const ASSISTANT_TAB_KEY = 'assistant';
/** @deprecated Overlay tabs removed in v3; kept for tests that still import the symbol. */
export const NOTIFICATIONS_TAB_KEY = 'notifications';

const MAX_PRIMARY_ROUTE_TABS = 3;
const CORE_ROUTE_LABELS = ['Dashboard', 'Bookings', ADMIN_MODULE_LABEL.inbox] as const;

export type AdminBottomNavOverlays = {
  onMoreClick: () => void;
  assistant?: {
    onClick: () => void;
  };
  notifications?: {
    onClick: () => void;
    badge?: boolean | number;
  };
};

export function flattenNavigableNavItems(sections: SidebarNavSection[]): SidebarNavItem[] {
  return sections.flatMap((section) =>
    section.items.filter((item): item is SidebarNavItem & { href: string } =>
      Boolean(item.href && !item.disabled)
    )
  );
}

function pickPrimaryRouteTabs(navigable: SidebarNavItem[]): SidebarNavItem[] {
  const picked: SidebarNavItem[] = [];
  const used = new Set<string>();

  for (const label of CORE_ROUTE_LABELS) {
    const item = navigable.find((candidate) => candidate.label === label);
    if (item?.href && !used.has(item.href)) {
      picked.push(item);
      used.add(item.href);
    }
  }

  for (const item of navigable) {
    if (picked.length >= MAX_PRIMARY_ROUTE_TABS) break;
    if (!item.href || used.has(item.href)) continue;
    picked.push(item);
    used.add(item.href);
  }

  return picked;
}

/**
 * Legacy splitter (Dashboard · Bookings · Inbox · Notifications · Assistant · More).
 * Kept for Prefetch tests; AdminLayout uses {@link buildAdminV3Tabs}.
 */
export function splitAdminBottomNav(
  sections: SidebarNavSection[],
  overlays: AdminBottomNavOverlays
): {
  tabItems: BottomTabItem[];
  moreSections: SidebarNavSection[];
  moreItems: SidebarNavItem[];
  primaryHrefs: string[];
} {
  const navigable = flattenNavigableNavItems(sections);
  const primary = pickPrimaryRouteTabs(navigable);
  const moreItems = navigable;
  const moreSections = sections.filter((section) =>
    section.items.some((item) => item.href && !item.disabled)
  );

  const tabItems: BottomTabItem[] = [
    ...primary.map((item) => ({
      key: item.href!,
      label: item.label,
      href: item.href,
      Icon: item.Icon,
    })),
  ];

  if (overlays.notifications) {
    tabItems.push({
      key: NOTIFICATIONS_TAB_KEY,
      label: 'Notifications',
      Icon: Bell,
      onClick: overlays.notifications.onClick,
      badge: overlays.notifications.badge,
    });
  }

  if (overlays.assistant) {
    tabItems.push({
      key: ASSISTANT_TAB_KEY,
      label: 'Assistant',
      Icon: MessageSquare,
      onClick: overlays.assistant.onClick,
    });
  }

  tabItems.push(moreTabItem(overlays.onMoreClick));

  return {
    tabItems,
    moreSections,
    moreItems,
    primaryHrefs: primary.map((item) => item.href!),
  };
}

export function resolveBottomTabActiveKey(
  activeNavHref: string | null,
  primaryHrefs: string[],
  moreOpen: boolean,
  overlayKey?: string | null
): string | null {
  if (moreOpen) return MORE_TAB_KEY;
  if (overlayKey) return overlayKey;
  if (activeNavHref && primaryHrefs.includes(activeNavHref)) return activeNavHref;
  if (activeNavHref) return MORE_TAB_KEY;
  return primaryHrefs[0] ?? null;
}

type V3TabDef = {
  key: AdminTabKey;
  label: string;
  Icon: BottomTabItem['Icon'];
  /** Path suffix after the scope root ('' = scope index / Today). */
  suffix: string;
};

const PROPERTY_PARKING_TABS: V3TabDef[] = [
  { key: 'today', label: 'Today', Icon: Home, suffix: '' },
  { key: 'bookings', label: 'Bookings', Icon: CalendarDays, suffix: 'bookings' },
  { key: 'inbox', label: 'Inbox', Icon: MessageSquare, suffix: 'inbox' },
  { key: 'work', label: 'Work', Icon: Grid2x2, suffix: 'work' },
  { key: 'you', label: 'You', Icon: UserRound, suffix: 'you' },
];

const ORG_TABS: V3TabDef[] = [
  { key: 'today', label: 'Today', Icon: Home, suffix: 'dashboard' },
  { key: 'bookings', label: 'Bookings', Icon: CalendarDays, suffix: 'bookings' },
  { key: 'alerts', label: 'Alerts', Icon: Bell, suffix: 'alerts' },
  { key: 'work', label: 'Work', Icon: Grid2x2, suffix: 'work' },
  { key: 'you', label: 'You', Icon: UserRound, suffix: 'you' },
];

const SUPER_ADMIN_TABS: V3TabDef[] = [
  { key: 'overview', label: 'Overview', Icon: Home, suffix: '' },
  { key: 'approvals', label: 'Approvals', Icon: CalendarDays, suffix: 'approvals' },
  { key: 'orgs', label: 'Orgs', Icon: Grid2x2, suffix: 'orgs' },
  { key: 'support', label: 'Support', Icon: MessageSquare, suffix: 'support' },
  { key: 'console', label: 'Console', Icon: UserRound, suffix: 'console' },
];

function hrefFor(basePath: string, suffix: string): string {
  if (!suffix) return basePath;
  return `${basePath.replace(/\/+$/, '')}/${suffix}`;
}

/**
 * v3 phone tabs (D2 / D9). Today · Bookings · Inbox|Alerts · Work · You for host scopes;
 * Overview · Approvals · Orgs · Support · Console for super-admin.
 * Permission fallback: slot 2 / 3 can swap to the next permitted module; Today, Work, You stay.
 */
export function buildAdminV3Tabs(args: {
  scope: AdminTabScope;
  basePath: string;
  /** Navigable sidebar items after permission filter (for fallback slots). */
  navigable?: SidebarNavItem[];
  inboxBadge?: boolean | number;
  alertsBadge?: boolean | number;
}): BottomTabItem[] {
  const defs =
    args.scope === 'org'
      ? ORG_TABS
      : args.scope === 'super-admin'
        ? SUPER_ADMIN_TABS
        : PROPERTY_PARKING_TABS;

  const navigable = args.navigable ?? [];
  const hasInbox = navigable.some((item) => item.label === ADMIN_MODULE_LABEL.inbox);
  const hasBookings = navigable.some((item) => item.label === 'Bookings');

  return defs.map((def) => {
    let href = hrefFor(args.basePath, def.suffix);
    let label = def.label;
    let Icon = def.Icon;
    let key: string = def.key;

    // Permission fallback for slot 2 (Bookings) and slot 3 (Inbox / Alerts).
    if (def.key === 'bookings' && args.scope !== 'super-admin' && !hasBookings) {
      const fallback = navigable.find(
        (item) => item.href && item.label !== 'Dashboard' && item.label !== ADMIN_MODULE_LABEL.inbox
      );
      if (fallback?.href) {
        href = fallback.href;
        label = fallback.label;
        Icon = fallback.Icon;
        key = fallback.href;
      }
    }

    if (def.key === 'inbox' && args.scope !== 'org' && args.scope !== 'super-admin' && !hasInbox) {
      const fallback = navigable.find(
        (item) =>
          item.href &&
          item.label !== 'Dashboard' &&
          item.label !== 'Bookings' &&
          item.label !== ADMIN_MODULE_LABEL.inbox
      );
      if (fallback?.href) {
        href = fallback.href;
        label = fallback.label;
        Icon = fallback.Icon;
        key = fallback.href;
      }
    }

    const badge =
      def.key === 'inbox'
        ? args.inboxBadge
        : def.key === 'alerts'
          ? args.alertsBadge
          : undefined;

    return { key, label, href, Icon, badge };
  });
}

/** Active v3 tab key for the current pathname (falls back to Work / Console). */
export function resolveAdminV3TabActiveKey(pathname: string): string | null {
  const scope = adminTabScope(pathname);
  if (!scope) return null;
  return adminTabForRoute(pathname);
}
