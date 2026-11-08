import { describe, expect, it } from 'vitest';

import { TELEGRAM_BOT_SECTION } from '@/features/dashboard/notifications/lib/notificationsHubSections';

describe('TELEGRAM_BOT_SECTION', () => {
  it('uses the anchor id the bot token card renders', () => {
    // TelegramGlobalBotTokenCard owns `id="section-global-bot"`; scroll-spy matches on it.
    expect(TELEGRAM_BOT_SECTION.id).toBe('global-bot');
  });

  it('has a label and an icon for the section nav', () => {
    expect(TELEGRAM_BOT_SECTION.label.trim()).not.toBe('');
    expect(TELEGRAM_BOT_SECTION.icon).toBeTruthy();
  });
});
