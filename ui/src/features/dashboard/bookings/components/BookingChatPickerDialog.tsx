import { Search } from 'lucide-react';

import { PlatformLogo } from '@/features/dashboard/inbox/components/PlatformLogo';
import { formatInboxTime, platformLabel } from '@/features/dashboard/inbox/lib/inboxFormat';
import type { BookingChatMatch } from '@/features/dashboard/inbox/types/inbox';

import { MobileChoiceItem } from '@/components/mobile/MobileChoiceSheet';
import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guestName: string;
  matches: BookingChatMatch[];
  onSelect: (match: BookingChatMatch) => void;
  onSearch: () => void;
};

function rowDescription(match: BookingChatMatch): string {
  const parts = [platformLabel(match.platform)];
  if (match.match === 'name') parts.push('Name match');
  parts.push(formatInboxTime(match.last_message_at));
  return parts.join(' · ');
}

/**
 * Picker for a booking that has more than one thread (Chat plus Facebook / Instagram, or
 * several Meta threads). Bottom sheet on phone and tablet, centered dialog on desktop.
 */
export function BookingChatPickerDialog({
  open,
  onOpenChange,
  guestName,
  matches,
  onSelect,
  onSearch,
}: Props) {
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        sheetLayout="split"
        className="gap-0 overflow-hidden p-0 sm:max-w-md"
        showCloseButton
      >
        <ResponsiveModalHeader className="border-border/60 space-y-1 border-b px-4 pb-3 pt-1 text-left lg:pt-4">
          <ResponsiveModalTitle>Open chat</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            {matches.length === 1
              ? `Is this ${guestName}?`
              : `${guestName} has ${matches.length} chats`}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div
          role="listbox"
          aria-label={`Chats for ${guestName}`}
          className="divide-border/50 min-h-0 flex-1 divide-y overflow-y-auto overscroll-contain py-1"
        >
          {matches.map((match) => (
            <MobileChoiceItem
              key={match.id}
              icon={<PlatformLogo platform={match.platform} size="sm" />}
              label={match.participant_name?.trim() || guestName}
              description={rowDescription(match)}
              trailing={
                match.unread_count > 0 ? (
                  <span
                    className="bg-primary-strong inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white"
                    aria-label={`${match.unread_count} unread`}
                  >
                    {match.unread_count > 99 ? '99+' : match.unread_count}
                  </span>
                ) : null
              }
              onSelect={() => onSelect(match)}
            />
          ))}
        </div>

        <ResponsiveModalFooter className="border-border/60 border-t px-4 pb-3 pt-3 sm:justify-start">
          <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={onSearch}>
            <Search className="size-4" aria-hidden />
            Search all chats
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
