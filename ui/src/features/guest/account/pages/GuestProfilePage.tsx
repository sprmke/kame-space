import { GuestProfileForm } from '@/features/guest/account/components/GuestProfileForm';
import { GuestPushNotificationsCard } from '@/features/guest/account/components/GuestPushNotificationsCard';

import { AppInfoCard } from '@/components/pwa/AppInfoCard';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';

export function GuestProfilePage() {
  usePageTitle(publicPageTitle('Profile'));
  return (
    <div className="flex h-full flex-col gap-3 sm:gap-4">
      <GuestProfileForm />
      <GuestPushNotificationsCard />
      {/*
        Intentionally hidden (2026-11-22): self-serve Download my data / Delete my account
        is not a guest-facing priority yet. Keep GuestPrivacyCard mounted-ready so we can
        re-enable by uncommenting the import + render below. Edge `data-subject-request`
        remains available for operator / future UI use.
        import { GuestPrivacyCard } from '@/features/guest/account/components/GuestPrivacyCard';
        <GuestPrivacyCard />
      */}
      <AppInfoCard />
    </div>
  );
}
