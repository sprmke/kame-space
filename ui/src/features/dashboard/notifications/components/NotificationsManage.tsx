import { useEffect, type ReactNode } from 'react';

import { Settings2 } from 'lucide-react';

import { NotificationPreferencesCard } from '@/features/dashboard/notifications/components/NotificationPreferencesCard';
import {
  ChannelCardsSkeleton,
  ChannelSwitchSkeleton,
  DevicePushPausedPanel,
  TelegramDeliverySwitchRow,
  TelegramPausedPanel,
} from '@/features/dashboard/notifications/components/NotificationsChannelPanels';
import { PushNotificationsRow } from '@/features/dashboard/notifications/components/PushNotificationsCard';
import { QuietHoursCard } from '@/features/dashboard/notifications/components/QuietHoursCard';
import { usePushNotifications } from '@/features/dashboard/notifications/hooks/usePushNotifications';
import { useTelegramDeliveryControl } from '@/features/dashboard/notifications/hooks/useTelegramDeliveryControl';

import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { MobileHeroActionButton } from '@/components/mobile/MobileHeroActionButton';
import { Button } from '@/components/ui/button';
import {
  MODAL_BODY_CLASS,
  MODAL_FOOTER_CLASS,
  MODAL_HEADER_CLASS,
} from '@/components/ui/modal-chrome';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGuardedViewSwitch } from '@/hooks/useGuardedViewSwitch';
import { useFeatureAvailability } from '@/lib/featureAvailability/useFeatureAvailability';
import { cn } from '@/lib/utils';

const MANAGE_LABEL = 'Manage notifications';

export type ManageTab = 'activity' | 'telegram';

type ButtonProps = {
  onClick: () => void;
  /** `hero` is the round icon inside the mobile brand hero. */
  variant?: 'default' | 'hero';
};

/** Header trigger. The page owns the dialog so both header slots share one. */
export function NotificationsManageButton({ onClick, variant = 'default' }: ButtonProps) {
  if (variant === 'hero') {
    return (
      <MobileHeroActionButton aria-label={MANAGE_LABEL} title={MANAGE_LABEL} onClick={onClick}>
        <Settings2 aria-hidden />
      </MobileHeroActionButton>
    );
  }

  return (
    <Button type="button" variant="outline" onClick={onClick}>
      <Settings2 aria-hidden />
      Manage
    </Button>
  );
}

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: ManageTab;
  onTabChange: (tab: ManageTab) => void;
  /** Telegram module management: shared bot token + per-module cards. */
  telegramContent: ReactNode;
  /** `?module=` deep link: scroll to that card once the sheet is open. */
  focusModuleId?: string | null;
};

/**
 * Delivery settings for the Notifications hub. Two tabs mirror the page:
 * **Activity** holds this device's push opt-in and the per-group push
 * preferences, **Telegram** holds the master switch and the bot/module setup.
 *
 * Both tabs use one bordered card (master switch on top, settings below) so
 * hierarchy matches. A channel that is off shows what turning it on restores.
 */
export function NotificationsManageDialog({
  open,
  onOpenChange,
  tab,
  onTabChange,
  telegramContent,
  focusModuleId,
}: DialogProps) {
  const telegramAvailability = useFeatureAvailability('notifications.telegram');
  const telegramAvailable = telegramAvailability.available || telegramAvailability.isLoading;
  const push = usePushNotifications();
  const delivery = useTelegramDeliveryControl();
  const telegramEnabled = delivery.data?.enabled !== false;

  /*
   * Closing the sheet or leaving the Telegram tab unmounts the module cards, so
   * both go through the guard: a half-typed bot token must not vanish silently.
   */
  const { requestSwitch, dialogProps } = useGuardedViewSwitch<() => void>({
    onCommit: (commit) => commit(),
  });
  const guardedOpenChange = (next: boolean) => {
    if (next) {
      onOpenChange(true);
      return;
    }
    requestSwitch(() => onOpenChange(false));
  };

  useEffect(() => {
    if (!open || tab !== 'telegram' || !focusModuleId) return;
    const timer = window.setTimeout(() => {
      document
        .getElementById(`section-${focusModuleId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [open, tab, focusModuleId]);

  return (
    <>
      <ResponsiveModal open={open} onOpenChange={guardedOpenChange}>
        <ResponsiveModalContent
          sheetLayout="split"
          className={cn(
            'flex w-full min-h-0 flex-col gap-0 overflow-hidden p-0 pb-0 pt-0 sm:p-0',
            'max-h-[min(92dvh,760px)] max-w-[min(calc(100vw-1.5rem),44rem)] sm:max-w-[min(92vw,44rem)]'
          )}
        >
          <ResponsiveModalHeader className={cn('space-y-0 text-left', MODAL_HEADER_CLASS)}>
            <ResponsiveModalTitle>Manage notifications</ResponsiveModalTitle>
          </ResponsiveModalHeader>

          <Tabs
            value={tab}
            onValueChange={(next) => requestSwitch(() => onTabChange(next as ManageTab))}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className={cn('border-border shrink-0 border-b', MODAL_BODY_CLASS, 'py-3')}>
              <TabsList className="bg-muted/45 grid h-auto w-full grid-cols-2 gap-1 rounded-xl p-1">
                <TabsTrigger
                  value="activity"
                  className="min-h-[40px] rounded-lg px-2 text-xs font-semibold sm:text-sm"
                >
                  Activity
                </TabsTrigger>
                <TabsTrigger
                  value="telegram"
                  className="min-h-[40px] rounded-lg px-2 text-xs font-semibold sm:text-sm"
                >
                  Telegram
                </TabsTrigger>
              </TabsList>
            </div>

            <div
              className={cn(
                'min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]',
                MODAL_BODY_CLASS
              )}
            >
              <TabsContent value="activity" className="mt-0 focus-visible:outline-none">
                {!push.ready ? (
                  <ChannelSwitchSkeleton />
                ) : (
                  <div className="border-border bg-card overflow-hidden rounded-xl border">
                    <PushNotificationsRow push={push} embedded />

                    {push.subscribed ? (
                      <>
                        <div className="border-border border-t px-3 py-3 sm:px-4">
                          <NotificationPreferencesCard />
                        </div>
                        <div className="border-border border-t px-3 py-3 sm:px-4">
                          <QuietHoursCard />
                        </div>
                      </>
                    ) : push.supported ? (
                      <DevicePushPausedPanel className="border-border rounded-none border-0 border-t bg-transparent" />
                    ) : null}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="telegram" className="mt-0 focus-visible:outline-none">
                {telegramAvailable ? (
                  <div className="border-border bg-card overflow-hidden rounded-xl border">
                    <TelegramDeliverySwitchRow embedded />
                    {delivery.isLoading ? (
                      <div className="border-border space-y-3 border-t px-3 py-3 sm:px-4">
                        <ChannelCardsSkeleton />
                      </div>
                    ) : telegramEnabled ? (
                      <div className="border-border space-y-4 border-t px-3 py-3 sm:px-4">
                        {telegramContent}
                      </div>
                    ) : (
                      <TelegramPausedPanel className="border-border rounded-none border-0 border-t bg-transparent" />
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Telegram notifications are not available on this plan.
                  </p>
                )}
              </TabsContent>
            </div>
          </Tabs>

          <ResponsiveModalFooter className={MODAL_FOOTER_CLASS}>
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => requestSwitch(() => onOpenChange(false))}
            >
              Done
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
