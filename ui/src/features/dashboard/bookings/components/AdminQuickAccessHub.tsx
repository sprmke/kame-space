import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Bell, HelpCircle, LayoutGrid, MessageSquare, Sparkles } from 'lucide-react';

import { aboveBottomTabBarOverlayClassName } from '@/components/mobile/BottomTabBar';
import { cn } from '@/lib/utils';

export type AdminQuickAccessHubProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showFab?: boolean;
  unreadCount?: number;
  showAssistant?: boolean;
  messagesHref?: string | null;
  helpHref?: string | null;
  onOpenNotifications: () => void;
  onOpenAssistant: () => void;
  className?: string;
};

type HubAction = {
  key: string;
  label: string;
  Icon: typeof Bell;
  badge?: number;
  onSelect: () => void;
};

const FAB_SIZE = 52;
const ACTION_SIZE = 44;
const ACTION_GAP = 6;

const expandSpring = { type: 'spring' as const, stiffness: 420, damping: 32, mass: 0.85 };
const itemSpring = { type: 'spring' as const, stiffness: 480, damping: 34, mass: 0.7 };

/**
 * Quick Access FAB. Click expands bottom→top into a vertical pill of actions.
 * Same launcher icon when open or closed; outside click / Esc / an action closes it.
 */
export function AdminQuickAccessHub({
  open,
  onOpenChange,
  showFab = true,
  unreadCount = 0,
  showAssistant = false,
  messagesHref = null,
  helpHref = null,
  onOpenNotifications,
  onOpenAssistant,
  className,
}: AdminQuickAccessHubProps) {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const hasUnread = unreadCount > 0;
  const ariaLabel = hasUnread ? `Quick access, ${unreadCount} unread` : 'Quick access';

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root || !(event.target instanceof Node)) return;
      if (root.contains(event.target)) return;
      onOpenChange(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onOpenChange]);

  const actions = useMemo((): HubAction[] => {
    const items: HubAction[] = [
      {
        key: 'notifications',
        label: 'Notifications',
        Icon: Bell,
        badge: hasUnread ? unreadCount : undefined,
        onSelect: () => {
          onOpenChange(false);
          onOpenNotifications();
        },
      },
    ];

    if (showAssistant) {
      items.push({
        key: 'assistant',
        label: 'AI assistant',
        Icon: Sparkles,
        onSelect: () => {
          onOpenChange(false);
          onOpenAssistant();
        },
      });
    }

    if (messagesHref) {
      items.push({
        key: 'messages',
        label: 'Messages',
        Icon: MessageSquare,
        onSelect: () => {
          onOpenChange(false);
          navigate(messagesHref);
        },
      });
    }

    if (helpHref) {
      items.push({
        key: 'help',
        label: 'Help & Support',
        Icon: HelpCircle,
        onSelect: () => {
          onOpenChange(false);
          navigate(helpHref);
        },
      });
    }

    return items;
  }, [
    hasUnread,
    unreadCount,
    showAssistant,
    messagesHref,
    helpHref,
    navigate,
    onOpenChange,
    onOpenNotifications,
    onOpenAssistant,
  ]);

  if (!showFab) return null;

  const openHeight =
    FAB_SIZE + actions.length * (ACTION_SIZE + ACTION_GAP) + (actions.length > 0 ? 8 : 0);

  return (
    <div
      ref={rootRef}
      className={cn(
        'pointer-events-none fixed right-4 z-[41] sm:right-5',
        aboveBottomTabBarOverlayClassName(),
        className
      )}
    >
      <motion.div
        role="toolbar"
        aria-label="Quick access"
        aria-expanded={open}
        initial={false}
        animate={{
          height: open ? openHeight : FAB_SIZE,
          borderRadius: open ? 28 : FAB_SIZE / 2,
          paddingTop: open ? 6 : 0,
        }}
        transition={reduceMotion ? { duration: 0.12 } : expandSpring}
        className={cn(
          'pointer-events-auto relative flex w-[52px] flex-col-reverse items-center overflow-hidden',
          'border-border/60 bg-background text-foreground shadow-elevated-lg',
          'border'
        )}
      >
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-controls="admin-quick-access-actions"
          className={cn(
            'relative z-10 flex shrink-0 items-center justify-center rounded-full',
            'text-foreground transition-colors duration-150',
            'hover:bg-muted/60 active:bg-muted/80',
            'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            open && 'bg-muted/40'
          )}
          style={{ width: FAB_SIZE, height: FAB_SIZE }}
        >
          <LayoutGrid className="size-5" aria-hidden strokeWidth={1.75} />
          {hasUnread && !open ? (
            <span
              className={cn(
                'bg-destructive text-destructive-foreground ring-background absolute right-0.5 top-0.5',
                'flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none ring-2',
                'animate-notification-badge-pulse motion-reduce:animate-none'
              )}
              aria-hidden
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </button>

        <div
          id="admin-quick-access-actions"
          className="flex w-full flex-col-reverse items-center"
          style={{ gap: ACTION_GAP }}
        >
          <AnimatePresence initial={false}>
            {open
              ? actions.map(({ key, label, Icon, badge, onSelect }, index) => (
                  <motion.button
                    key={key}
                    type="button"
                    onClick={onSelect}
                    aria-label={label}
                    title={label}
                    initial={
                      reduceMotion
                        ? { opacity: 0 }
                        : { opacity: 0, y: 14, scale: 0.88 }
                    }
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={
                      reduceMotion
                        ? { opacity: 0 }
                        : { opacity: 0, y: 10, scale: 0.92 }
                    }
                    transition={
                      reduceMotion
                        ? { duration: 0.1 }
                        : {
                            ...itemSpring,
                            delay: index * 0.035,
                          }
                    }
                    className={cn(
                      'relative flex shrink-0 items-center justify-center rounded-full',
                      'text-foreground transition-colors duration-150',
                      'hover:bg-muted/70 active:bg-muted/90',
                      'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'
                    )}
                    style={{ width: ACTION_SIZE, height: ACTION_SIZE }}
                  >
                    <Icon className="size-[18px]" aria-hidden strokeWidth={1.75} />
                    {badge != null && badge > 0 ? (
                      <span
                        className={cn(
                          'bg-destructive text-destructive-foreground absolute -right-0.5 -top-0.5',
                          'flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[9px] font-semibold leading-none'
                        )}
                        aria-hidden
                      >
                        {badge > 99 ? '99+' : badge}
                      </span>
                    ) : null}
                  </motion.button>
                ))
              : null}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
