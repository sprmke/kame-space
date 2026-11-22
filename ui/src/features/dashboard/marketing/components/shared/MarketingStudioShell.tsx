import { useEffect, useState, type ReactNode } from 'react';

import { createPortal } from 'react-dom';

import { MarketingBuilderHeader } from '@/features/dashboard/marketing/components/shared/MarketingBuilderHeader';

import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { inertExcept } from '@/lib/dom/inertExcept';
import { cn } from '@/lib/utils';

type Props = {
  tabs?: ReactNode;
  /** Optional leading control (prefer trailing `actions` so phone stays one row). */
  leading?: ReactNode;
  /** Trailing control on the tab row (compact theme switcher). */
  actions?: ReactNode;
  /** An editor with its floating mobile dock is open (reserve room for it). */
  hasDock?: boolean;
  /**
   * Phone only (`max-lg`): the editor takes the whole screen, over the dashboard header and tab
   * bar, on a dark surface (like CapCut). Desktop is unchanged. Sheets and dialogs sit above it.
   */
  fullscreen?: boolean;
  children: ReactNode;
};

/** Below sheets and dialogs (z-100+), above the app tab bar (z-40) and quick-access button (z-41). */
const FULLSCREEN_Z_CLASS = 'z-[45]';

/**
 * Shared builder card chrome — keeps mode tabs mounted for sliding-pill animation.
 *
 * Desktop (`lg+`): a fixed-height card (`100vh - 120px`) so the editor never grows
 * the page. Mobile (`max-lg`): an explicit viewport-derived height because a route
 * wrapper breaks the `flex-1` fill chain. The subtraction reserves the brand hero
 * (≈ 11rem) plus the two stacked floating docks below the card — the editor's own
 * "Templates" dock (≈ 4.75rem up) and, beneath it, the app bottom tab bar (which
 * stays visible so the user can still navigate away). The card ends just above the
 * editor dock so each editor's scrollport only needs a small bottom gutter. The Library
 * and AI Studio have no editor dock, so they get that room back.
 * `flex-none` so this height wins over the base `flex-1`.
 */
export function MarketingStudioShell({
  tabs,
  leading,
  actions,
  hasDock = false,
  fullscreen = false,
  children,
}: Props) {
  const isBelowLg = useIsBelowLg();
  const takeOver = fullscreen && isBelowLg;

  // The page behind the editor must not scroll under a thumb, and must not be reachable by
  // keyboard or screen reader while it is covered. Sheets and dialogs portal to `body`, outside
  // the app root, so they stay usable.
  useEffect(() => {
    if (!takeOver) return;
    const html = document.documentElement;
    const appRoot = document.getElementById('root');
    const previousOverflow = html.style.overflow;
    // Sheets and dialogs portal outside the dark layer, so the whole session goes dark with it.
    const wasDark = html.classList.contains('dark');
    html.style.overflow = 'hidden';
    html.classList.add('dark');
    html.setAttribute('data-editor-fullscreen', '');
    // Everything behind the editor is out of reach, except the toast container: toasts carry
    // actions (Undo, Add more) that must stay tappable.
    const restoreInert = appRoot
      ? inertExcept(appRoot, document.querySelector('section[aria-label^="Notifications"]'))
      : () => undefined;
    return () => {
      html.style.overflow = previousOverflow;
      if (!wasDark) html.classList.remove('dark');
      html.removeAttribute('data-editor-fullscreen');
      restoreInert();
    };
  }, [takeOver]);

  // The on-screen keyboard shrinks the visual viewport but not the layout one. Follow the visual
  // one so the panel the host is typing in stays above the keyboard.
  const viewport = useVisualViewport(takeOver);

  if (takeOver) {
    return createPortal(
      <div
        data-video-editor-fullscreen
        className={cn(
          'bg-background text-foreground dark fixed inset-x-0 flex min-h-0 flex-col overflow-hidden',
          viewport ? 'top-0' : 'inset-y-0',
          FULLSCREEN_Z_CLASS
        )}
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: viewport?.keyboard ? 0 : 'env(safe-area-inset-bottom, 0px)',
          ...(viewport
            ? { height: viewport.height, transform: `translateY(${viewport.top}px)` }
            : null),
        }}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>,
      document.body
    );
  }

  return (
    <div
      className={cn(
        'border-border bg-card flex min-h-0 flex-1 flex-col overflow-hidden border max-lg:rounded-none max-lg:border-x-0 lg:rounded-xl',
        hasDock
          ? 'max-lg:h-[calc(100dvh-20rem-env(safe-area-inset-bottom,0px))]'
          : 'max-lg:h-[calc(100dvh-15.25rem-env(safe-area-inset-bottom,0px))]',
        'max-lg:min-h-[19rem] max-lg:flex-none',
        'lg:h-[calc(100vh-120px)] lg:min-h-[520px] lg:flex-none'
      )}
    >
      {leading || tabs ? (
        <MarketingBuilderHeader leading={leading} tabs={tabs} actions={actions} />
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}

type VisualViewportBox = { height: number; top: number; keyboard: boolean };

/** Height and offset of the visual viewport while `active`; null until it differs from the layout one. */
function useVisualViewport(active: boolean): VisualViewportBox | null {
  const [box, setBox] = useState<VisualViewportBox | null>(null);
  useEffect(() => {
    if (!active) {
      setBox(null);
      return;
    }
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const keyboard = window.innerHeight - viewport.height > 120;
      // Only take over while the keyboard is up; otherwise the plain full-screen layer is exact.
      setBox(keyboard ? { height: viewport.height, top: viewport.offsetTop, keyboard } : null);
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, [active]);
  return box;
}
