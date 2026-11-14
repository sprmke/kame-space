import type { ReactNode } from 'react';

import { X } from 'lucide-react';

import {
  MODAL_BODY_CLASS,
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_FOOTER_CLASS,
  MODAL_HEADER_CLASS,
} from '@/components/ui/modal-chrome';
import {
  ResponsiveModal,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { cn } from '@/lib/utils';

export type GuestDialogShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Plain title string, or custom header content that includes `DialogTitle`. */
  title: ReactNode;
  children: ReactNode;
  /** Pinned action row under a top border (Clear / Save, Back / Continue, …). */
  footer?: ReactNode;
  /**
   * Desktop (`lg+`) width override. Must include both base and `sm:` max-width so
   * we beat DialogContent’s default `sm:max-w-[min(90vw,28rem)]`. Ignored below
   * `lg`, where the shell renders edge-to-edge as a bottom sheet.
   */
  sizeClassName?: string;
  /** Height override. Defaults to a comfortable laptop-safe cap. */
  heightClassName?: string;
  bodyClassName?: string;
  headerClassName?: string;
  footerClassName?: string;
  /** Block overlay / Escape dismiss (e.g. nested full-screen layer on top). */
  dismissLocked?: boolean;
};

/**
 * Consistent guest-facing modal chrome: edge-to-edge header + optional footer
 * separators, scrollable body, content padding killed. Centered `Dialog` on
 * `lg+`, bottom sheet below `lg` (via `ResponsiveModal`). Close control lives in
 * the header flex row so it aligns with the title.
 */
export function GuestDialogShell({
  open,
  onOpenChange,
  title,
  children,
  footer,
  sizeClassName = 'max-w-[min(calc(100vw-1.5rem),32rem)] sm:max-w-[min(90vw,32rem)]',
  heightClassName = 'max-h-[min(90dvh,40rem)]',
  bodyClassName,
  headerClassName,
  footerClassName,
  dismissLocked = false,
}: GuestDialogShellProps) {
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        sheetLayout="split"
        showCloseButton={false}
        onPointerDownOutside={(event) => {
          if (dismissLocked) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (dismissLocked) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (dismissLocked) event.preventDefault();
        }}
        className={cn(
          'flex w-full flex-col gap-0 overflow-hidden p-0 pb-0 pt-0 sm:p-0',
          heightClassName,
          sizeClassName
        )}
        aria-describedby={undefined}
      >
        <div
          className={cn('flex shrink-0 items-center gap-3', MODAL_HEADER_CLASS, headerClassName)}
        >
          <div className="min-w-0 flex-1">
            {typeof title === 'string' ? (
              <ResponsiveModalTitle>{title}</ResponsiveModalTitle>
            ) : (
              title
            )}
          </div>

          <ResponsiveModalClose className={MODAL_CLOSE_BUTTON_CLASS} aria-label="Close">
            <X className="size-4 shrink-0" aria-hidden />
          </ResponsiveModalClose>
        </div>

        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain',
            MODAL_BODY_CLASS,
            bodyClassName
          )}
        >
          {children}
        </div>

        {footer != null ? (
          <div className={cn(MODAL_FOOTER_CLASS, footerClassName)}>{footer}</div>
        ) : null}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
