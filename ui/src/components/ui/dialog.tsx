import * as React from 'react';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import {
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DESCRIPTION_CLASS,
  MODAL_HEADER_CLOSE_GUTTER_CLASS,
  MODAL_HEADER_STACK_CLASS,
} from '@/components/ui/modal-chrome';
import { useModalLayer } from '@/components/ui/useModalLayer';
import { cn } from '@/lib/utils';

/** Radix can leave `pointer-events: none` on body after nested dismiss layers (e.g. dropdown → dialog). */
function clearDialogBodyPointerEventsLock() {
  const clear = () => {
    document.body.style.removeProperty('pointer-events');
  };
  clear();
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(clear);
  });
  window.setTimeout(clear, 300);
}

const Dialog = ({
  open,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) => {
  React.useEffect(() => {
    if (open === false) {
      clearDialogBodyPointerEventsLock();
    }
  }, [open]);

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange?.(nextOpen);
        if (!nextOpen) {
          clearDialogBodyPointerEventsLock();
        }
      }}
      {...props}
    />
  );
};

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, style, ...props }, ref) => {
  const lightbox =
    typeof className === 'string' && className.split(/\s+/).includes('modal-scrim-lightbox');

  return (
    <DialogPrimitive.Overlay
      ref={ref}
      style={style}
      className={cn(
        /* z-index comes from style (modal stack) or an explicit className floor. */
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 data-[state=closed]:pointer-events-none',
        style?.zIndex == null && !/\bz-\[/.test(typeof className === 'string' ? className : '')
          ? 'z-[100]'
          : null,
        !lightbox && 'modal-scrim',
        className
      )}
      {...props}
    />
  );
});
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  overlayClassName?: string;
  /** When false, omit the default top-right close control (use an inline close in the header instead). */
  showCloseButton?: boolean;
};

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(
  (
    {
      className,
      overlayClassName,
      children,
      onCloseAutoFocus,
      showCloseButton = true,
      style,
      ...props
    },
    ref
  ) => {
    const { overlayZ, contentZ, attach } = useModalLayer({
      overlayClassName,
      contentClassName: typeof className === 'string' ? className : undefined,
    });
    const setContentRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        attach(node);
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      },
      [attach, ref]
    );

    return (
      <DialogPortal>
        <DialogOverlay className={overlayClassName} style={{ zIndex: overlayZ }} />
        <DialogPrimitive.Content
          ref={setContentRef}
          onCloseAutoFocus={(event) => {
            onCloseAutoFocus?.(event);
            clearDialogBodyPointerEventsLock();
          }}
          style={{ ...style, zIndex: contentZ }}
          className={cn(
            'border-border/50 bg-card shadow-elevated-lg fixed left-1/2 top-1/2 grid max-h-[min(90dvh,640px)] w-full max-w-[min(calc(100vw-1.5rem),28rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto overflow-x-hidden rounded-xl border p-4 pb-[max(env(safe-area-inset-bottom,0px),1rem)] pt-[max(env(safe-area-inset-top,0px),0.75rem)] outline-none duration-200',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'sm:max-w-[min(90vw,28rem)] sm:p-5',
            className
          )}
          {...props}
        >
          {children}
          {showCloseButton ? (
            <DialogPrimitive.Close
              className={cn(
                MODAL_CLOSE_BUTTON_CLASS,
                'absolute right-3 top-3 ring-offset-background focus:ring-ring'
              )}
              aria-label="Close"
            >
              <X className="size-4 shrink-0" aria-hidden />
            </DialogPrimitive.Close>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPortal>
    );
  }
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col text-center sm:text-left',
      className,
      /*
       * Title ↔ description (or title row ↔ subtitle) stays tight. Applied after
       * caller classes so `space-y-2` / `space-y-4` / `gap-2` cannot reopen a
       * large empty band under the title.
       */
      MODAL_HEADER_STACK_CLASS,
      /*
       * Close gutter must come last. Callers often pass `px-4` / `sm:px-5` for the
       * canonical scale; twMerge treats those as overriding `pr-*`, which used to
       * drop the reserved close slot and collide header actions with the X.
       */
      MODAL_HEADER_CLOSE_GUTTER_CLASS
    )}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-foreground text-base font-bold tracking-tight sm:text-lg', className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn(className, MODAL_DESCRIPTION_CLASS)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
