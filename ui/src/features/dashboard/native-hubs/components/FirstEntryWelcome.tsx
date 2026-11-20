import { useEffect, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { KameMascot } from '@/components/mascot/KameMascot';
import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { useIsBelowLg } from '@/hooks/useMediaQuery';

const SESSION_KEY = 'kame-first-entry-welcome';

type Props = {
  /** Scope root path (Today). */
  todayHref: string | null;
  workspaceLabel?: string;
};

/**
 * Concept I: once per browser session after the host lands in an admin scope.
 * Never on every app open across sessions.
 */
export function FirstEntryWelcome({ todayHref, workspaceLabel }: Props) {
  const isMobile = useIsBelowLg();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isMobile || !todayHref) return;
    try {
      if (sessionStorage.getItem(SESSION_KEY) === '1') return;
      sessionStorage.setItem(SESSION_KEY, '1');
      setOpen(true);
    } catch {
      /* private mode — skip */
    }
  }, [isMobile, todayHref]);

  if (!isMobile || !todayHref) return null;

  return (
    <ResponsiveModal open={open} onOpenChange={setOpen}>
      <ResponsiveModalContent className="gap-4">
        <ResponsiveModalHeader className="items-center text-center">
          <KameMascot pose="hello" role="welcome" className="mx-auto" />
          <ResponsiveModalTitle className="text-center">Welcome back</ResponsiveModalTitle>
          {workspaceLabel ? (
            <p className="text-muted-foreground text-sm">{workspaceLabel}</p>
          ) : null}
        </ResponsiveModalHeader>
        <ResponsiveModalFooter className="flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            className="min-h-11 w-full"
            onClick={() => {
              setOpen(false);
              navigate(todayHref);
            }}
          >
            Open today
          </Button>
          <Button type="button" variant="ghost" className="min-h-11 w-full" onClick={() => setOpen(false)}>
            Continue
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
