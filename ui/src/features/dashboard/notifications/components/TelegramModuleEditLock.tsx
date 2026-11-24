import type { ReactNode } from 'react';

import {
  TelegramNotificationsSettingsProvider,
  useTelegramNotificationsSettingsEditable,
} from '@/features/dashboard/bookings/components/telegram-notifications/TelegramNotificationsSettingsContext';

/**
 * Narrows "settings are editable" for one Telegram module.
 *
 * Feature availability already owns the outer flag (`TelegramNotificationsTelegramSection`),
 * so this composes with it instead of replacing it: availability AND this module's edit
 * permission. Cards inside then disable their own fields, which keeps the text readable and
 * the controls announced as disabled. The previous `pointer-events-none` wrapper blocked the
 * mouse only, so keyboard users could still type into a token field that would fail on save.
 */
export function TelegramModuleEditLock({
  locked,
  children,
}: {
  locked: boolean;
  children: ReactNode;
}) {
  const settingsEditable = useTelegramNotificationsSettingsEditable();

  return (
    <TelegramNotificationsSettingsProvider settingsEditable={settingsEditable && !locked}>
      {children}
    </TelegramNotificationsSettingsProvider>
  );
}
