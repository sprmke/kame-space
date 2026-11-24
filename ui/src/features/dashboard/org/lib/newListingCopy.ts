export type NewListingKind = 'property' | 'parking';

/**
 * One dialog serves the Properties page, the Parkings page and the org switcher. Only the
 * combined entry point should call it a "listing"; the single-kind entries should name the
 * thing the host clicked.
 */
export function newListingDialogTitle(activeKind: NewListingKind, showKindToggle: boolean): string {
  if (showKindToggle) return 'New listing';
  return activeKind === 'property' ? 'Add property' : 'Add parking';
}
