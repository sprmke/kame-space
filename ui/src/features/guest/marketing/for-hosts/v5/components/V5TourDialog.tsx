import { useState, type ReactNode } from 'react';

import { X } from 'lucide-react';

import { HostDashboardTourPlayer } from '@/features/guest/marketing/for-hosts/components/HostDashboardTourPlayer';
import { v5Hero } from '@/features/guest/marketing/for-hosts/v5/data/hostLandingV5';

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

/** The dashboard tour in a full-size dialog. `children` is the trigger; the player mounts only while open. */
export function V5TourDialog({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { dialog } = v5Hero.tourCta;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="max-h-[94dvh] w-[min(calc(100vw-1.5rem),72rem)] max-w-none grid-cols-[minmax(0,1fr)] gap-3 p-3 sm:max-w-none sm:gap-4 sm:p-5"
      >
        <div className="flex items-center justify-between gap-4">
          <DialogTitle className="text-lg sm:text-xl">{dialog.title}</DialogTitle>
          <DialogClose
            className="text-muted-foreground hover:bg-muted focus-visible:ring-ring flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2"
            aria-label={dialog.closeLabel}
          >
            <X className="size-5" aria-hidden />
          </DialogClose>
        </div>
        <DialogDescription className="sr-only">{dialog.description}</DialogDescription>
        {open ? (
          <HostDashboardTourPlayer
            variant="marketing"
            expandablePreview={false}
            playWhenInView={false}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
