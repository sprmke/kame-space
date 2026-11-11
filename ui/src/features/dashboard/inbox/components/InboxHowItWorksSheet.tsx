import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Only offered when the Meta app is approved for the tag. */
  showFollowUp?: boolean;
};

/**
 * "How this inbox works": the limits Meta imposes, in the host's words.
 *
 * Hosts were reading Meta's rules (24-hour window, 20 messages of history, Business AI
 * ownership) as bugs. This is the one place those are explained, so the thread can stay quiet.
 */
export function InboxHowItWorksSheet({ open, onOpenChange, showFollowUp = false }: Props) {
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="max-w-[min(calc(100vw-1.5rem),32rem)]">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>How this inbox works</ResponsiveModalTitle>
        </ResponsiveModalHeader>

        <div className="text-muted-foreground space-y-4 text-sm">
          <section className="space-y-1">
            <h3 className="text-foreground text-sm font-semibold">What it is</h3>
            <p>
              One place to read and answer guest messages from your Facebook Page, Instagram, and
              your booking page chat.
            </p>
          </section>

          <section className="space-y-1">
            <h3 className="text-foreground text-sm font-semibold">How messages arrive</h3>
            <p>
              New messages show up here within seconds. We also check with Meta every few minutes,
              so a missed update gets picked up.
            </p>
          </section>

          <section className="space-y-1">
            <h3 className="text-foreground text-sm font-semibold">Replies</h3>
            <p>
              Replies you send here go out from your Page or Instagram account. Replies you send
              from Meta Business Suite or the Instagram app show up here too.
            </p>
          </section>

          <section className="space-y-1">
            <h3 className="text-foreground text-sm font-semibold">Meta's limits</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>You can reply for 24 hours after the guest's last message.</li>
              {showFollowUp ? (
                <li>When approved, you can send a non-promotional follow-up up to 7 days after.</li>
              ) : null}
              <li>
                For chats that started before you connected, Meta shares only the latest 20
                messages. Older messages stay in Messenger or Instagram.
              </li>
              <li>Instagram message requests older than 30 days do not come through.</li>
              <li>Some message types only open in Meta's apps.</li>
              <li>Messages sent to Messenger or Instagram cannot be edited or unsent.</li>
              <li>
                If Meta's Business AI or another app is answering a chat, you'll see it here, but
                you may need to take over in Business Suite before you can reply.
              </li>
            </ul>
          </section>

          <section className="space-y-1">
            <h3 className="text-foreground text-sm font-semibold">Setup check</h3>
            <p>
              Instagram: turn on Allow access to messages in the Instagram app under Settings,
              Privacy, Messages, Connected tools.
            </p>
          </section>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
