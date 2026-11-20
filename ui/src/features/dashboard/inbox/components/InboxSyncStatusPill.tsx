import { useState } from 'react';

import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  Loader2,
  PauseCircle,
  RefreshCw,
} from 'lucide-react';

import type {
  InboxSyncStatus,
  InboxSyncAction,
} from '@/features/dashboard/inbox/lib/inboxSyncStatus';

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
import { cn } from '@/lib/utils';

type Props = {
  status: InboxSyncStatus;
  onAction: (action: InboxSyncAction) => void;
  onHowItWorks: () => void;
  className?: string;
};

const TONE_CLASSES: Record<InboxSyncStatus['tone'], string> = {
  success: 'border-emerald-600/20 bg-emerald-500/10 text-emerald-700',
  muted: 'border-border bg-muted text-muted-foreground',
  warning: 'border-amber-600/25 bg-amber-500/10 text-amber-700',
  danger: 'border-destructive/25 bg-destructive/10 text-destructive',
};

function StatusIcon({ state }: { state: InboxSyncStatus['state'] }) {
  if (state === 'live') return <CheckCircle2 className="size-3.5" aria-hidden />;
  if (state === 'importing' || state === 'updating')
    return <Loader2 className="size-3.5 animate-spin" aria-hidden />;
  if (state === 'offline') return <CloudOff className="size-3.5" aria-hidden />;
  if (state === 'paused') return <PauseCircle className="size-3.5" aria-hidden />;
  if (state === 'delayed') return <RefreshCw className="size-3.5" aria-hidden />;
  return <AlertTriangle className="size-3.5" aria-hidden />;
}

/**
 * One pill for "is this inbox live".
 *
 * Fits in the page header at every breakpoint. Tapping it explains the current state in plain
 * words and offers the one action that fixes it, instead of leaving the host to guess.
 */
export function InboxSyncStatusPill({ status, onAction, onHowItWorks, className }: Props) {
  const [open, setOpen] = useState(false);

  const runAction = () => {
    if (!status.action) return;
    setOpen(false);
    onAction(status.action);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium',
          'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
          TONE_CLASSES[status.tone],
          className
        )}
        aria-label={`Meta sync status: ${status.label}`}
      >
        <StatusIcon state={status.state} />
        <span>{status.label}</span>
      </button>

      <ResponsiveModal open={open} onOpenChange={setOpen}>
        <ResponsiveModalContent
          sheetLayout="split"
          className={cn(
            'flex w-full flex-col gap-0 overflow-hidden p-0 pb-0 pt-0 sm:p-0',
            'max-h-[min(90dvh,28rem)] max-w-[min(calc(100vw-1.5rem),26rem)] sm:max-w-[min(90vw,26rem)]'
          )}
        >
          <ResponsiveModalHeader className={cn('space-y-0 text-left', MODAL_HEADER_CLASS)}>
            <ResponsiveModalTitle>{status.label}</ResponsiveModalTitle>
          </ResponsiveModalHeader>

          <div
            className={cn(
              'min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]',
              MODAL_BODY_CLASS
            )}
          >
            <p className="text-muted-foreground text-sm leading-relaxed" role="status">
              {status.detail}
            </p>
          </div>

          <ResponsiveModalFooter
            className={cn('flex flex-col gap-2 sm:flex-row', MODAL_FOOTER_CLASS)}
          >
            {status.action ? (
              <Button type="button" onClick={runAction} className="w-full sm:flex-1">
                {status.actionLabel}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              // Close first: two stacked sheets leave two headings on screen and nothing
              // for a screen reader to focus.
              onClick={() => {
                setOpen(false);
                onHowItWorks();
              }}
              className="w-full sm:flex-1"
            >
              How Messages works
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}
