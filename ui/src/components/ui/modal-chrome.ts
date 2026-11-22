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
 * Modal / sheet description under the title. Always `text-sm` (never `text-xs`).
 * Matches `DialogDescription` / `ResponsiveModalDescription`.
 */
export const MODAL_DESCRIPTION_CLASS = 'text-muted-foreground text-sm leading-snug';

/**
 * Title ↔ description stack inside a header. Small gap only; do not combine with
 * `space-y-*` (that doubles the flex gap and leaves a broken empty band).
 */
export const MODAL_HEADER_STACK_CLASS = 'gap-1 space-y-0';

/**
 * Right padding reserved for the absolute dialog close control (`size-8` at
 * `right-3`). Applied after caller `className` in `DialogHeader` so a `px-*`
 * override cannot wipe it via tailwind-merge (that collision put Free/Paid
 * tabs under the X on Booking Workflow).
 */
export const MODAL_HEADER_CLOSE_GUTTER_CLASS = 'pr-12 sm:pr-14';

/**
 * Header row when the close is the **absolute** Dialog control (`showCloseButton`
 * default). Hairline, tight vertical padding, `pl-*` + close gutter (not `px-*`)
 * so the reserved right edge survives class merges. Use with
 * `ResponsiveModalHeader` / `AdminDialogShell`. Stack gap is applied by
 * `DialogHeader` / `SheetHeader` (`MODAL_HEADER_STACK_CLASS`), not here.
 *
 * Do **not** put an inline `ResponsiveModalClose` in this header — the gutter
 * leaves the X floating inset from the edge. For inline close use
 * `MODAL_HEADER_INLINE_CLASS` on a plain flex `div` (see `GuestDialogShell`).
 */
export const MODAL_HEADER_CLASS = `border-border shrink-0 border-b pl-4 py-3 sm:pl-5 ${MODAL_HEADER_CLOSE_GUTTER_CLASS}`;

/**
 * Header row when the close is **inline** in the flex row (`GuestDialogShell`,
 * `LegalDocumentSheet`). Symmetric `px-*` — no absolute-close gutter. Pair with
 * `showCloseButton={false}` and a `ResponsiveModalClose` as the last flex child.
 * Never combine with `ResponsiveModalHeader` on desktop (that forces the gutter).
 */
export const MODAL_HEADER_INLINE_CLASS = 'border-border shrink-0 border-b px-4 py-3 sm:px-5';

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
