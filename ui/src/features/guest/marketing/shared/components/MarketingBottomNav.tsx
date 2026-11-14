import { useMemo, useState } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';

import { Building2, Car, Compass, Luggage, MessageCircle, User } from 'lucide-react';

import {
  GUEST_ACCOUNT_MESSAGES_PATH,
  GUEST_ACCOUNT_PROFILE_PATH,
  GUEST_ACCOUNT_TRIPS_PATH,
} from '@/features/guest/account/lib/guestAccountPaths';
import {
  useGuestNextTrip,
  type GuestNextTrip,
} from '@/features/guest/account/hooks/useGuestNextTrip';
import {
  getHostMarketingNavCta,
  getGuestLoginCta,
} from '@/features/guest/auth/config/auth-navigation';
import { getAppModeFromPath } from '@/features/guest/auth/config/mode-switch';
import { useGuestSession } from '@/features/guest/auth/hooks/useGuestSession';
import { MarketingMoreSheet } from '@/features/guest/marketing/shared/components/MarketingMoreSheet';
import { useModeSwitchTransition } from '@/features/guest/marketing/shared/context/ModeSwitchTransitionContext';

import { useAdminSession } from '@/features/dashboard/bookings/hooks/useAdminSession';

import { BottomTabBar, moreTabItem, type BottomTabItem } from '@/components/mobile/BottomTabBar';

/**
 * Which tab a path belongs to. Only the booking tabs a signed-in guest actually has are
 * considered, so a stray `/properties` link never highlights a tab that is not there.
 */
function resolveActiveKey(pathname: string, keys: Set<string>): string | null {
  if (pathname === '/' && keys.has('explore')) return 'explore';
  if (pathname.startsWith('/properties') && keys.has('properties')) return 'properties';
  if (
    (pathname.startsWith('/parkings') || pathname.startsWith('/developments')) &&
    keys.has('parkings')
  ) {
    return 'parkings';
  }
  if (pathname.startsWith('/account/trips') && keys.has('trips')) return 'trips';
  if (
    (pathname.startsWith('/account/messages') || pathname.startsWith('/account/stays')) &&
    keys.has('messages')
  ) {
    return 'messages';
  }
  if (pathname.startsWith('/account') && keys.has('account')) return 'account';
  return null;
}

/** A stay in progress, or one starting within a week, earns a dot on the Trips tab. */
function shouldDotTrips(nextTrip: GuestNextTrip | null): boolean {
  if (!nextTrip) return false;
  return nextTrip.isCurrent || nextTrip.daysUntil <= 7;
}

/**
 * Persistent phone/tablet nav for every marketing + guest-account page
 * (`MarketingLayoutShell`'s `Outlet`) — replaces the old hamburger + full-screen
 * overlay. A PDP/wizard `ContextualActionBar` (Phase 2b) auto-hides this via
 * the shared `BottomBarSlotProvider`.
 *
 * A signed-in guest gets **Trips** and **Messages** in place of Properties and Parkings
 * (plan D3): those are the two things a guest with a booking needs. Explore still reaches
 * properties and parkings.
 */
export function MarketingBottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const mode = getAppModeFromPath(pathname);
  const isExploreMode = mode !== 'host';
  const { switchMode, isTransitioning } = useModeSwitchTransition();
  const { status: guestStatus } = useGuestSession();
  const { status: adminStatus } = useAdminSession();
  const isGuestSignedIn = guestStatus === 'authenticated';
  const isHostSignedIn = adminStatus === 'admin';
  const [moreOpen, setMoreOpen] = useState(false);
  const nextTrip = useGuestNextTrip();

  const accountHref = isExploreMode
    ? isGuestSignedIn
      ? GUEST_ACCOUNT_PROFILE_PATH
      : getGuestLoginCta().href
    : isHostSignedIn
      ? getHostMarketingNavCta(true).href
      : getHostMarketingNavCta(false).href;

  const items = useMemo<BottomTabItem[]>(() => {
    const explore: BottomTabItem = {
      key: 'explore',
      label: 'Explore',
      Icon: Compass,
      onClick: () => {
        if (isExploreMode) {
          navigate('/');
        } else if (!isTransitioning) {
          switchMode('guest');
        }
      },
    };

    // A signed-in guest sees their own trips and messages instead of the catalogue tabs.
    if (isExploreMode && isGuestSignedIn) {
      return [
        explore,
        {
          key: 'trips',
          label: 'Trips',
          href: GUEST_ACCOUNT_TRIPS_PATH,
          Icon: Luggage,
          badge: shouldDotTrips(nextTrip),
        },
        {
          key: 'messages',
          label: 'Messages',
          href: GUEST_ACCOUNT_MESSAGES_PATH,
          Icon: MessageCircle,
        },
        { key: 'account', label: 'Account', href: accountHref, Icon: User },
        moreTabItem(() => setMoreOpen(true)),
      ];
    }

    return [
      explore,
      { key: 'properties', label: 'Properties', href: '/properties', Icon: Building2 },
      { key: 'parkings', label: 'Parkings', href: '/parkings', Icon: Car },
      { key: 'account', label: 'Account', href: accountHref, Icon: User },
      moreTabItem(() => setMoreOpen(true)),
    ];
  }, [
    isExploreMode,
    isGuestSignedIn,
    isTransitioning,
    navigate,
    switchMode,
    accountHref,
    nextTrip,
  ]);

  const tabKeys = useMemo(() => new Set(items.map((item) => item.key)), [items]);
  const activeKey = moreOpen ? 'more' : resolveActiveKey(pathname, tabKeys);

  return (
    <>
      <BottomTabBar items={items} activeKey={activeKey} aria-label="Main" />
      <MarketingMoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
}
