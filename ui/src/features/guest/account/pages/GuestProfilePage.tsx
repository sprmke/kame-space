import { GuestPrivacyCard } from '@/features/guest/account/components/GuestPrivacyCard';
import { GuestProfileForm } from '@/features/guest/account/components/GuestProfileForm';
import { GuestPushNotificationsCard } from '@/features/guest/account/components/GuestPushNotificationsCard';
import { GuestIdentityCard } from '@/features/verification/components/GuestIdentityCard';

import { AppInfoCard } from '@/components/pwa/AppInfoCard';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';

export function GuestProfilePage() {
  usePageTitle(publicPageTitle('Profile'));
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
