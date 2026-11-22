import {
  Gift,
  Heart,
  HelpCircle,
  Luggage,
  MessageSquare,
  Star,
  Ticket,
  User,
  type LucideIcon,
} from 'lucide-react';

import {
  GUEST_ACCOUNT_FAVORITES_PATH,
  GUEST_ACCOUNT_HELP_PATH,
  GUEST_ACCOUNT_MESSAGES_PATH,
  GUEST_ACCOUNT_PROFILE_PATH,
  GUEST_ACCOUNT_REVIEWS_PATH,
  GUEST_ACCOUNT_TICKETS_PATH,
  GUEST_ACCOUNT_TRIPS_PATH,
  GUEST_ACCOUNT_VOUCHERS_PATH,
} from '@/features/guest/account/lib/guestAccountPaths';

export type GuestAccountNavItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
  description?: string;
};

/** Avatar-menu section labels (short; rendered uppercase by the menu chrome). */
export type GuestAccountNavGroupId = 'account' | 'trips' | 'help';

export type GuestAccountNavGroup = {
  id: GuestAccountNavGroupId;
  label: string;
  items: GuestAccountNavItem[];
};

/**
 * Guest destinations for the marketing avatar menu and account sidebar, grouped
 * by job-to-be-done. Mobile strip uses the flattened `GUEST_ACCOUNT_NAV_ITEMS`.
 */
export const GUEST_ACCOUNT_NAV_GROUPS: GuestAccountNavGroup[] = [
  {
    id: 'account',
    label: 'Account',
    items: [
      {
        href: GUEST_ACCOUNT_PROFILE_PATH,
        label: 'Profile',
        Icon: User,
      },
      {
        href: GUEST_ACCOUNT_FAVORITES_PATH,
        label: 'Favorites',
        Icon: Heart,
      },
      {
        href: GUEST_ACCOUNT_VOUCHERS_PATH,
        label: 'Vouchers',
        Icon: Gift,
      },
    ],
  },
  {
    id: 'trips',
    label: 'Trips',
    items: [
      {
        href: GUEST_ACCOUNT_TRIPS_PATH,
        label: 'Trips',
        Icon: Luggage,
      },
      {
        href: GUEST_ACCOUNT_MESSAGES_PATH,
        label: 'Messages',
        Icon: MessageSquare,
      },
      {
        href: GUEST_ACCOUNT_REVIEWS_PATH,
        label: 'Reviews',
        Icon: Star,
      },
    ],
  },
  {
    id: 'help',
    label: 'Help',
    items: [
      {
        href: GUEST_ACCOUNT_TICKETS_PATH,
        label: 'Tickets',
        Icon: Ticket,
      },
      {
        href: GUEST_ACCOUNT_HELP_PATH,
        label: 'Help',
        Icon: HelpCircle,
      },
    ],
  },
];

export const GUEST_ACCOUNT_NAV_ITEMS: GuestAccountNavItem[] = GUEST_ACCOUNT_NAV_GROUPS.flatMap(
  (group) => group.items
);

export function resolveGuestAccountNavItem(pathname: string): GuestAccountNavItem {
  const hrefs = GUEST_ACCOUNT_NAV_ITEMS.map((item) => item.href);
  const activeHref =
    hrefs
      .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
      .sort((a, b) => b.length - a.length)[0] ?? GUEST_ACCOUNT_PROFILE_PATH;

  return (
    GUEST_ACCOUNT_NAV_ITEMS.find((item) => item.href === activeHref) ?? GUEST_ACCOUNT_NAV_ITEMS[0]!
  );
}
