import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { MoreVertical } from 'lucide-react';

import { MobileChoiceItem, MobileChoiceSheet } from '@/components/mobile/MobileChoiceSheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

export type ChatMessageAction = {
  key: string;
  label: string;
  icon: ReactNode;
  destructive?: boolean;
  /** Inline reactions cover this on desktop; the row only belongs in the phone sheet. */
  hideOnDesktop?: boolean;
  onSelect: () => void;
};

type Props = {
  outbound: boolean;
  actions: ChatMessageAction[];
  className?: string;
};

/**
 * Per-message ⋮. Compact Messenger-style menu beside the bubble on desktop, a bottom sheet
 * on phone (repo rule: no floating dropdown for actions below `lg`).
 */
export function ChatMessageActionsMenu({ outbound, actions, className }: Props) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsBelowLg();

  const desktopActions = actions.filter((action) => !action.hideOnDesktop);
  const dismiss = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open || isMobile) return;

    const dismissFromScroll = () => dismiss();
    let attached = false;

    const attachId = window.requestAnimationFrame(() => {
      attached = true;
      document.addEventListener('scroll', dismissFromScroll, true);
      document.addEventListener('wheel', dismissFromScroll, { capture: true, passive: true });
      window.addEventListener('resize', dismissFromScroll);
    });

    return () => {
      window.cancelAnimationFrame(attachId);
      if (!attached) return;
      document.removeEventListener('scroll', dismissFromScroll, true);
      document.removeEventListener('wheel', dismissFromScroll, true);
      window.removeEventListener('resize', dismissFromScroll);
    };
  }, [open, isMobile, dismiss]);

  const triggerClass = cn(
    'text-muted-foreground/60 hover:text-foreground focus-visible:ring-ring flex shrink-0 items-center justify-center rounded-full transition-[color,opacity,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2',
    "relative size-9 min-h-[36px] min-w-[36px] before:absolute before:-inset-1 before:content-[''] [@media(hover:hover)]:size-7 [@media(hover:hover)]:min-h-0 [@media(hover:hover)]:min-w-0",
    'opacity-70 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within/msg:opacity-100 [@media(hover:hover)]:group-hover/msg:opacity-100',
    'hover:bg-muted/70 active:bg-muted data-[state=open]:bg-muted data-[state=open]:text-foreground data-[state=open]:opacity-100',
    className
  );

  if (isMobile) {
    return (
      <>
        <button
          type="button"
          className={triggerClass}
          aria-label="Message actions"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <MoreVertical className="size-3.5" strokeWidth={2.25} aria-hidden />
        </button>
        <MobileChoiceSheet open={open} onOpenChange={setOpen} title="Message">
          <div role="listbox" aria-label="Message actions">
            {actions.map((action) => (
              <MobileChoiceItem
                key={action.key}
                label={action.label}
                icon={action.icon}
                destructive={action.destructive}
                onSelect={() => {
                  setOpen(false);
                  action.onSelect();
                }}
              />
            ))}
          </div>
        </MobileChoiceSheet>
      </>
    );
  }

  if (desktopActions.length === 0) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" className={triggerClass} aria-label="Message actions">
          <MoreVertical className="size-3.5" strokeWidth={2.25} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={outbound ? 'left' : 'right'}
        align="center"
        sideOffset={4}
        collisionPadding={12}
        className={cn(
          'border-border/60 bg-popover text-popover-foreground z-[110] w-max min-w-0 max-w-[min(90vw,11rem)] rounded-lg border p-1 shadow-md',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
        )}
        onCloseAutoFocus={(event: Event) => event.preventDefault()}
      >
        {desktopActions.map((action) => (
          <DropdownMenuItem
            key={action.key}
            onSelect={() => action.onSelect()}
            className={cn(
              'min-h-[36px] gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium',
              action.destructive &&
                'text-destructive focus:bg-destructive/10 focus:text-destructive [&>svg]:text-destructive'
            )}
          >
            {action.icon}
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
