import { useMemo } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';

import { Building2, Car, Compass, Heart, Luggage, MessageCircle, User } from 'lucide-react';

import {
  useGuestNextTrip,
  type GuestNextTrip,
} from '@/features/guest/account/hooks/useGuestNextTrip';
import {
  GUEST_ACCOUNT_FAVORITES_PATH,
  GUEST_ACCOUNT_MESSAGES_PATH,
  GUEST_ACCOUNT_PROFILE_PATH,
  GUEST_ACCOUNT_TRIPS_PATH,
} from '@/features/guest/account/lib/guestAccountPaths';
import {
  getHostMarketingNavCta,
  getGuestLoginCta,
} from '@/features/guest/auth/config/auth-navigation';
import { getAppModeFromPath } from '@/features/guest/auth/config/mode-switch';
import { useGuestSession } from '@/features/guest/auth/hooks/useGuestSession';
import { useModeSwitchTransition } from '@/features/guest/marketing/shared/context/ModeSwitchTransitionContext';

import { useAdminSession } from '@/features/dashboard/bookings/hooks/useAdminSession';

import { BottomTabBar, type BottomTabItem } from '@/components/mobile/BottomTabBar';

/**
 * Which tab a path belongs to (D10). No More tab — secondary links live in Account.
 */
function resolveActiveKey(pathname: string, keys: Set<string>): string | null {
  if (pathname === '/' && keys.has('explore')) return 'explore';
  if (pathname.startsWith('/properties') && keys.has('stays')) return 'stays';
  if (
    (pathname.startsWith('/parkings') || pathname.startsWith('/developments')) &&
    keys.has('parking')
  ) {
    return 'parking';
  }
  if (pathname.startsWith('/account/trips') && keys.has('trips')) return 'trips';
  if (
    (pathname.startsWith('/account/messages') || pathname.startsWith('/account/stays')) &&
    keys.has('messages')
  ) {
    return 'messages';
  }
  if (
    (pathname.startsWith('/account/favorites') || pathname.startsWith('/account/wishlist')) &&
    keys.has('saved')
  ) {
    return 'saved';
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
 * Persistent phone/tablet nav for marketing + guest-account pages (D10).
 * Signed out: Explore · Stays · Parking · Account.
 * Signed-in guest: Explore · Trips · Messages · Saved · Account.
 * Public More is retired; its items move into Account.
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
        {
          key: 'saved',
          label: 'Saved',
          href: GUEST_ACCOUNT_FAVORITES_PATH,
          Icon: Heart,
        },
        { key: 'account', label: 'Account', href: accountHref, Icon: User },
      ];
    }

    return [
      explore,
      { key: 'stays', label: 'Stays', href: '/properties', Icon: Building2 },
      { key: 'parking', label: 'Parking', href: '/parkings', Icon: Car },
      { key: 'account', label: 'Account', href: accountHref, Icon: User },
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
  const activeKey = resolveActiveKey(pathname, tabKeys);

  return <BottomTabBar items={items} activeKey={activeKey} aria-label="Main" />;
}
