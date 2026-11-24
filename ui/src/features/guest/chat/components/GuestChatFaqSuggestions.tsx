import { useMemo } from 'react';

import { Mic } from 'lucide-react';

import {
  GUEST_CHAT_FAQ_VISIBLE_COUNT,
  pickGuestChatFaqs,
  resolveGuestChatFaqPhase,
  type GuestChatFaqPhase,
} from '@/features/guest/chat/lib/guestChatSuggestions';

import { ChatSuggestionList } from '@/components/chat/ChatSuggestionList';

type Props = {
  onPick: (prompt: string) => void;
  disabled?: boolean;
  hasInquiryDates?: boolean;
  hasMessages?: boolean;
  phase?: GuestChatFaqPhase;
  /** Shows the voice receptionist card above the starters when set. */
  onStartVoiceSession?: () => void;
};

export function GuestChatFaqSuggestions({
  onPick,
  disabled,
  hasInquiryDates = false,
  hasMessages = false,
  phase,
  onStartVoiceSession,
}: Props) {
  const resolvedPhase = phase ?? resolveGuestChatFaqPhase({ hasInquiryDates, hasMessages });

  const suggestions = useMemo(
    () => pickGuestChatFaqs(resolvedPhase, GUEST_CHAT_FAQ_VISIBLE_COUNT),
    [resolvedPhase]
  );

  if (suggestions.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Suggested questions"
      aria-busy={disabled || undefined}
      className="flex min-h-full flex-1 flex-col px-4 py-6"
    >
      <div className="m-auto flex w-full min-w-0 max-w-[22rem] flex-col">
        {onStartVoiceSession ? (
          <button
            type="button"
            onClick={onStartVoiceSession}
            disabled={disabled}
            className="focus-visible:ring-ring mb-2 flex min-h-[52px] w-full items-center gap-3 rounded-xl border border-primary/25 bg-primary/[0.06] px-3 py-3 text-left text-sm transition-colors hover:bg-primary/[0.09] focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50"
          >
            <span className="bg-primary-strong text-primary-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-lg">
              <Mic className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Talk to Kame</span>
              <span className="text-muted-foreground block text-xs">AI voice receptionist</span>
            </span>
          </button>
        ) : null}
        <ChatSuggestionList suggestions={suggestions} onPick={onPick} disabled={disabled} />
      </div>
    </div>
  );
}
