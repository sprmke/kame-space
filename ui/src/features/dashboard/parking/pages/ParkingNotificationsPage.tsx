import { useEffect, useState } from 'react';

import { useSearchParams } from 'react-router-dom';

import { Car, DollarSign, MessageCircle } from 'lucide-react';

import { AdminSection } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import { TelegramGlobalBotTokenCard } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramGlobalBotTokenCard';
import { TelegramHelpDialog } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramHelpDialog';
import { TelegramNotificationsGlobalBotProvider } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramNotificationsGlobalBotContext';
import { TelegramNotificationsTelegramSection } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramNotificationsTelegramSection';
import { TelegramChatSettingsCard } from '@/features/dashboard/bookings/components/TelegramChatSettingsCard';
import { TelegramFinanceSettingsCard } from '@/features/dashboard/bookings/components/TelegramFinanceSettingsCard';
import { useAdminLayoutFillMain } from '@/features/dashboard/bookings/lib/adminLayoutFillMain';
import { NotificationsHubShell } from '@/features/dashboard/notifications/components/NotificationsHubShell';
import {
  NotificationsManageButton,
  NotificationsManageDialog,
  type ManageTab,
} from '@/features/dashboard/notifications/components/NotificationsManage';
import { NotificationsTelegramHistory } from '@/features/dashboard/notifications/components/NotificationsTelegramHistory';
import { TelegramModuleEditLock } from '@/features/dashboard/notifications/components/TelegramModuleEditLock';
import { useNotificationsHubView } from '@/features/dashboard/notifications/hooks/useNotificationsHubView';
import { useParkingTelegramHubStats } from '@/features/dashboard/notifications/hooks/useTelegramHubStats';
import { useOptionalParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import { TelegramParkingSettingsCard } from '@/features/dashboard/parking/components/TelegramParkingSettingsCard';
import { useParkingPermissions } from '@/features/dashboard/team/hooks/useParkingPermissions';
import { hasParkingPermission } from '@/features/dashboard/team/lib/parkingPermissions';

import { AdminMobilePage } from '@/components/mobile/MobileBrandHero';
import { parkingDashboardPageTitle, usePageTitle } from '@/lib/pageTitle';

const PARKING_NOTIFICATION_MODULES = ['chat', 'parking', 'finance'] as const;

type ParkingNotificationModule = (typeof PARKING_NOTIFICATION_MODULES)[number];

function isParkingNotificationModule(value: string | null): value is ParkingNotificationModule {
  return PARKING_NOTIFICATION_MODULES.includes(value as ParkingNotificationModule);
}

/** Legacy parking page called this module "marketing"; it has always been Parking. */
function resolveParkingModule(value: string | null): ParkingNotificationModule | null {
  if (isParkingNotificationModule(value)) return value;
  if (value === 'marketing') return 'parking';
  return null;
}

const MODULE_DESCRIPTIONS: Record<ParkingNotificationModule, string> = {
  chat: 'Instant alert for every inbound guest message from web chat.',
  parking:
    'Reservation alerts for new requests, check-in reminders, and payment received on this slot.',
  finance: 'Due-date reminders for parking expense lines you track in Finance.',
};

export function ParkingNotificationsPage() {
  const parkingTenant = useOptionalParkingContext();
  const { data: access } = useParkingPermissions();
  /* Parking gates every Telegram module on one leaf, unlike the per-module property leaves. */
  const canEditNotifications = hasParkingPermission(access?.permissions, 'notifications:edit');
  const accessReady = access !== undefined;

  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkModule = resolveParkingModule(searchParams.get('module'));
  const hub = useNotificationsHubView({ module: deepLinkModule });
  const telegramStats = useParkingTelegramHubStats();

  const [manageOpen, setManageOpen] = useState(false);
  const [manageTab, setManageTab] = useState<ManageTab>('activity');

  useAdminLayoutFillMain(true);

  useEffect(() => {
    if (!deepLinkModule) return;
    setManageTab('telegram');
    setManageOpen(true);
  }, [deepLinkModule]);

  usePageTitle(
    parkingTenant
      ? parkingDashboardPageTitle(
          parkingTenant.org.name,
          parkingTenant.parking.name,
          'Notifications'
        )
      : undefined
  );

  const openManage = () => {
    setManageTab('activity');
    setManageOpen(true);
  };

  /** Drop `?module=` on close so a refresh or Back does not reopen the sheet. */
  const onManageOpenChange = (next: boolean) => {
    setManageOpen(next);
    if (next || !searchParams.has('module')) return;
    const params = new URLSearchParams(searchParams);
    params.delete('module');
    setSearchParams(params, { replace: true, preventScrollReset: true });
  };

  return (
    <AdminMobilePage
      title="Notifications"
      subtitle="Manage in-app notifications and Telegram alerts for this parking slot."
      titleId="parking-notifications-heading"
      className="flex min-h-0 flex-1 flex-col"
      heroTrailing={<NotificationsManageButton variant="hero" onClick={openManage} />}
      desktopActions={<NotificationsManageButton onClick={openManage} />}
    >
      <NotificationsHubShell hub={hub} telegramStats={telegramStats}>
        <NotificationsTelegramHistory />
      </NotificationsHubShell>

      <NotificationsManageDialog
        open={manageOpen}
        onOpenChange={onManageOpenChange}
        tab={manageTab}
        onTabChange={setManageTab}
        focusModuleId={deepLinkModule}
        deliveryEditable={canEditNotifications}
        telegramContent={
          <TelegramNotificationsGlobalBotProvider>
            <TelegramNotificationsTelegramSection
              helpAction={<TelegramHelpDialog defaultTab="bot-token" triggerLabel="Setup Guide" />}
            >
              {accessReady && !canEditNotifications ? (
                <p className="text-muted-foreground text-xs sm:text-sm">
                  Some modules are view only. Ask the parking owner or manager for edit access.
                </p>
              ) : null}

              <TelegramModuleEditLock locked={accessReady && !canEditNotifications}>
                <TelegramGlobalBotTokenCard />
              </TelegramModuleEditLock>

              <AdminSection
                id="chat"
                title="Chat"
                icon={MessageCircle}
                description={MODULE_DESCRIPTIONS.chat}
              >
                <TelegramModuleEditLock locked={accessReady && !canEditNotifications}>
                  <TelegramChatSettingsCard embedded />
                </TelegramModuleEditLock>
              </AdminSection>

              <AdminSection
                id="parking"
                title="Parking"
                icon={Car}
                description={MODULE_DESCRIPTIONS.parking}
              >
                <TelegramModuleEditLock locked={accessReady && !canEditNotifications}>
                  <TelegramParkingSettingsCard />
                </TelegramModuleEditLock>
              </AdminSection>

              <AdminSection
                id="finance"
                title="Finance"
                icon={DollarSign}
                description={MODULE_DESCRIPTIONS.finance}
              >
                <TelegramModuleEditLock locked={accessReady && !canEditNotifications}>
                  <TelegramFinanceSettingsCard embedded />
                </TelegramModuleEditLock>
              </AdminSection>
            </TelegramNotificationsTelegramSection>
          </TelegramNotificationsGlobalBotProvider>
        }
      />
    </AdminMobilePage>
  );
}
