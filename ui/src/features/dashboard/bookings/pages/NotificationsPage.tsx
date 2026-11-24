import { useEffect, useState } from 'react';

import { useSearchParams } from 'react-router-dom';

import { Bell, DollarSign, HardHat, Megaphone, MessageCircle, Wrench } from 'lucide-react';

import { AdminSection } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import { TelegramGlobalBotTokenCard } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramGlobalBotTokenCard';
import { TelegramHelpDialog } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramHelpDialog';
import { TelegramNotificationsGlobalBotProvider } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramNotificationsGlobalBotContext';
import { TelegramNotificationsTelegramSection } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramNotificationsTelegramSection';
import { TelegramAdminSettingsCard } from '@/features/dashboard/bookings/components/TelegramAdminSettingsCard';
import { TelegramChatSettingsCard } from '@/features/dashboard/bookings/components/TelegramChatSettingsCard';
import { TelegramFinanceSettingsCard } from '@/features/dashboard/bookings/components/TelegramFinanceSettingsCard';
import { TelegramMaintenanceSettingsCard } from '@/features/dashboard/bookings/components/TelegramMaintenanceSettingsCard';
import { TelegramMarketingSettingsCard } from '@/features/dashboard/bookings/components/TelegramMarketingSettingsCard';
import { TelegramStaffSettingsCard } from '@/features/dashboard/bookings/components/TelegramStaffSettingsCard';
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
import { usePropertyTelegramHubStats } from '@/features/dashboard/notifications/hooks/useTelegramHubStats';
import { NOTIFICATIONS_HOW_IT_WORKS } from '@/features/dashboard/notifications/lib/notificationsHelpCopy';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { usePropertyPermissions } from '@/features/dashboard/team/hooks/usePropertyPermissions';
import {
  hasAnyNotificationModuleEditPermission,
  hasPropertyPermission,
  NOTIFICATION_MODULE_EDIT_PERMISSION,
} from '@/features/dashboard/team/lib/propertyPermissions';

import { HowItWorksButton } from '@/components/help/HowItWorksButton';
import { AdminMobilePage } from '@/components/mobile/MobileBrandHero';
import { propertyDashboardPageTitle, usePageTitle } from '@/lib/pageTitle';

const NOTIFICATION_MODULES = [
  'chat',
  'marketing',
  'staff',
  'operations',
  'finance',
  'maintenance',
] as const;

type PropertyNotificationModule = (typeof NOTIFICATION_MODULES)[number];

function isNotificationModule(value: string | null): value is PropertyNotificationModule {
  return (NOTIFICATION_MODULES as readonly string[]).includes(value ?? '');
}

const MODULE_DESCRIPTIONS: Record<PropertyNotificationModule, string> = {
  chat: 'Instant alert for every inbound guest message from web chat, Facebook, or Instagram.',
  marketing:
    'Daily calendar alerts, plus instant messages when a guest submits or cancels a booking.',
  staff: 'Daily staff summary at your chosen Manila time.',
  operations:
    'Booking workflow updates as guests move through documents, parking, pets, and check-in stages.',
  finance: 'Due-date reminders for tracked property expenses.',
  maintenance: 'Upcoming reminders for scheduled property upkeep items.',
};

export function NotificationsPage() {
  const tenant = useOptionalOrgContext();
  const { data: access } = usePropertyPermissions();
  const accessReady = access !== undefined;
  const canEditGlobalBot = hasAnyNotificationModuleEditPermission(access?.permissions);
  const canEditModule = (module: PropertyNotificationModule) =>
    hasPropertyPermission(access?.permissions, NOTIFICATION_MODULE_EDIT_PERMISSION[module]);
  const someModulesLocked =
    accessReady && NOTIFICATION_MODULES.some((module) => !canEditModule(module));

  const [searchParams, setSearchParams] = useSearchParams();
  const moduleParam = searchParams.get('module');
  const deepLinkModule = isNotificationModule(moduleParam) ? moduleParam : null;
  const hub = useNotificationsHubView({ module: deepLinkModule });
  const telegramStats = usePropertyTelegramHubStats();

  const [manageOpen, setManageOpen] = useState(false);
  const [manageTab, setManageTab] = useState<ManageTab>('activity');

  useAdminLayoutFillMain(true);

  /* Legacy "Configure" links (?module=finance) open the Telegram management tab. */
  useEffect(() => {
    if (!deepLinkModule) return;
    setManageTab('telegram');
    setManageOpen(true);
  }, [deepLinkModule]);

  usePageTitle(
    tenant ? propertyDashboardPageTitle(tenant.property.name, 'Notifications') : undefined
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
      subtitle="Manage in-app notifications and Telegram alerts for this property."
      titleId="notifications-heading"
      titleHint={
        <HowItWorksButton
          {...NOTIFICATIONS_HOW_IT_WORKS}
          label="How notifications work"
          className="size-8 text-current opacity-80 hover:bg-transparent hover:text-current hover:opacity-100"
        />
      }
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
        deliveryEditable={canEditGlobalBot}
        telegramContent={
          <TelegramNotificationsGlobalBotProvider>
            <TelegramNotificationsTelegramSection
              helpAction={<TelegramHelpDialog defaultTab="bot-token" triggerLabel="Setup Guide" />}
            >
              {someModulesLocked ? (
                <p className="text-muted-foreground text-xs sm:text-sm">
                  Some modules are view only. Ask the property owner for edit access.
                </p>
              ) : null}

              <TelegramModuleEditLock locked={accessReady && !canEditGlobalBot}>
                <TelegramGlobalBotTokenCard />
              </TelegramModuleEditLock>

              <AdminSection
                id="chat"
                title="Chat"
                icon={MessageCircle}
                description={MODULE_DESCRIPTIONS.chat}
              >
                <TelegramModuleEditLock locked={accessReady && !canEditModule('chat')}>
                  <TelegramChatSettingsCard embedded />
                </TelegramModuleEditLock>
              </AdminSection>

              <AdminSection
                id="marketing"
                title="Marketing"
                icon={Megaphone}
                description={MODULE_DESCRIPTIONS.marketing}
              >
                <TelegramModuleEditLock locked={accessReady && !canEditModule('marketing')}>
                  <TelegramMarketingSettingsCard embedded />
                </TelegramModuleEditLock>
              </AdminSection>

              <AdminSection
                id="staff"
                title="Staff"
                icon={HardHat}
                description={MODULE_DESCRIPTIONS.staff}
              >
                <TelegramModuleEditLock locked={accessReady && !canEditModule('staff')}>
                  <TelegramStaffSettingsCard embedded />
                </TelegramModuleEditLock>
              </AdminSection>

              <AdminSection
                id="operations"
                title="Operations"
                icon={Bell}
                description={MODULE_DESCRIPTIONS.operations}
              >
                <TelegramModuleEditLock locked={accessReady && !canEditModule('operations')}>
                  <TelegramAdminSettingsCard embedded />
                </TelegramModuleEditLock>
              </AdminSection>

              <AdminSection
                id="finance"
                title="Finance"
                icon={DollarSign}
                description={MODULE_DESCRIPTIONS.finance}
              >
                <TelegramModuleEditLock locked={accessReady && !canEditModule('finance')}>
                  <TelegramFinanceSettingsCard embedded />
                </TelegramModuleEditLock>
              </AdminSection>

              <AdminSection
                id="maintenance"
                title="Maintenance"
                icon={Wrench}
                description={MODULE_DESCRIPTIONS.maintenance}
              >
                <TelegramModuleEditLock locked={accessReady && !canEditModule('maintenance')}>
                  <TelegramMaintenanceSettingsCard embedded />
                </TelegramModuleEditLock>
              </AdminSection>
            </TelegramNotificationsTelegramSection>
          </TelegramNotificationsGlobalBotProvider>
        }
      />
    </AdminMobilePage>
  );
}
