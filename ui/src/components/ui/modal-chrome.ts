/**
 * Canonical modal chrome — one source of truth for the padding, dividers and
 * title scale shared by every dialog / bottom sheet in the app.
 *
 * Why a module and not CSS utilities: `cn()` + tailwind-merge resolves
 * conflicts by class order, so a caller override (`px-6`) still wins. With
 * `@layer utilities` classes the winner would depend on stylesheet order
 * instead, which is exactly the inconsistency this file removes.
 *
 * Scale (DESIGN.md — dashboard density):
 * - horizontal gutter: 16px on phone, 20px from `sm` up
 * - header / footer vertical: 12px (compact chrome, keeps the title row tight)
 * - body vertical: 16px (content needs breathing room, chrome does not)
 */

/** Modal / sheet title scale. Matches `DialogTitle` and `BottomSheetTitle`. */
export const MODAL_TITLE_CLASS = 'text-base font-bold tracking-tight sm:text-lg';

/**
 * Header row: hairline under it, tight vertical padding, title on the left and
 * the close control on the right.
 */
export const MODAL_HEADER_CLASS = 'border-border shrink-0 border-b px-4 py-3 sm:px-5';

/** Scrollable body between the header and the footer. */
export const MODAL_BODY_CLASS = 'px-4 py-4 sm:px-5';

/**
 * Action row: hairline above it, actions right-aligned on desktop, full-width
 * stacked actions on phone.
 */
export const MODAL_FOOTER_CLASS =
  'border-border shrink-0 border-t px-4 py-3 pb-[max(env(safe-area-inset-bottom,0px),0.75rem)] sm:px-5';

/**
 * Close control: 32px visual, ≥44px hit via an invisible pad on touch.
 * Keep the visual box small so the glyph lines up with the title row instead
 * of floating below it. The pad is dropped at `lg+` (pointer device) so it can
 * never overlap a header action sitting next to the close button.
 */
export const MODAL_CLOSE_BUTTON_CLASS =
  'text-muted-foreground hover:bg-muted focus:ring-ring relative flex size-8 shrink-0 items-center justify-center rounded-lg opacity-80 transition-all hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none before:absolute before:-inset-1.5 before:content-[\'\'] lg:before:content-none';
