import { Link } from 'react-router-dom';

import { GuestPrivacyCard } from '@/features/guest/account/components/GuestPrivacyCard';
import { GuestProfileForm } from '@/features/guest/account/components/GuestProfileForm';
import { GuestPushNotificationsCard } from '@/features/guest/account/components/GuestPushNotificationsCard';
import { useGuestSignOut } from '@/features/guest/account/hooks/useGuestSignOut';
import {
  GUEST_ACCOUNT_FAVORITES_PATH,
  GUEST_ACCOUNT_HELP_PATH,
  GUEST_ACCOUNT_MESSAGES_PATH,
  GUEST_ACCOUNT_REVIEWS_PATH,
  GUEST_ACCOUNT_SETTINGS_PATH,
  GUEST_ACCOUNT_TICKETS_PATH,
  GUEST_ACCOUNT_TRIPS_PATH,
  GUEST_ACCOUNT_VOUCHERS_PATH,
} from '@/features/guest/account/lib/guestAccountPaths';
import { GuestIdentityCard } from '@/features/verification/components/GuestIdentityCard';
import { ModeSwitcher } from '@/features/guest/marketing/shared/components/ModeSwitcher';

import { ListRow } from '@/components/mobile/native/ListRow';
import { ListSection } from '@/components/mobile/native/ListSection';
import { AppInfoCard } from '@/components/pwa/AppInfoCard';
import { InstallAppEntry } from '@/components/pwa/InstallAppEntry';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';

export function GuestProfilePage() {
  usePageTitle(publicPageTitle('Account'));
  const isMobile = useIsBelowLg();
  const signOut = useGuestSignOut();

  if (isMobile) {
    return (
      <div className="space-y-4">
        <GuestProfileForm />

        <ListSection title="Account">
          <Link to={GUEST_ACCOUNT_TRIPS_PATH} className="block">
            <ListRow title="Trips" chevron />
          </Link>
          <Link to={GUEST_ACCOUNT_MESSAGES_PATH} className="block">
            <ListRow title="Messages" chevron />
          </Link>
          <Link to={GUEST_ACCOUNT_VOUCHERS_PATH} className="block">
            <ListRow title="Vouchers" chevron />
          </Link>
          <Link to={GUEST_ACCOUNT_FAVORITES_PATH} className="block">
            <ListRow title="Saved" chevron />
          </Link>
          <Link to={GUEST_ACCOUNT_REVIEWS_PATH} className="block">
            <ListRow title="Reviews" chevron />
          </Link>
          <Link to={GUEST_ACCOUNT_TICKETS_PATH} className="block">
            <ListRow title="Tickets" chevron />
          </Link>
        </ListSection>

        <ListSection title="Help">
          <Link to={GUEST_ACCOUNT_HELP_PATH} className="block">
            <ListRow title="Help" chevron />
          </Link>
          <Link to={GUEST_ACCOUNT_SETTINGS_PATH} className="block">
            <ListRow title="Settings" chevron />
          </Link>
        </ListSection>

        <ListSection title="App">
          <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
            <ThemeToggle
              variant="icon"
              className="border-border/60 bg-muted text-muted-foreground size-10 shrink-0 rounded-lg shadow-none [&_svg]:size-4"
            />
            <ModeSwitcher className="min-w-0 flex-1" />
          </div>
          <div className="px-1 py-1">
            <InstallAppEntry
              variant="menu-item"
              className="hover:bg-muted/60 text-foreground h-auto min-h-11 w-full justify-start gap-3 px-2 text-sm font-medium"
            />
          </div>
        </ListSection>

        <button
          type="button"
          onClick={() => void signOut()}
          className="border-destructive/25 bg-destructive/5 text-destructive hover:bg-destructive/10 flex min-h-11 w-full items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <GuestProfileForm />
      <GuestIdentityCard />
      <GuestPushNotificationsCard />
      <GuestPrivacyCard />
      <AppInfoCard />
    </div>
  );
}
