/**
 * Alt text for a listing photo.
 *
 * Priority: the host's own `alt` → the media `caption` → a generated description built from
 * the fields the card already shows. Used by every public image renderer so a listing never
 * ships `alt=""` or `"Image 3"`.
 *
 * Pure and dependency-free: the crawler snapshot and the SPA share it.
 */

export type ListingImageAltInput = {
  /** Host-written alt text from the media manager. */
  alt?: string | null;
  /** Media caption, when the host wrote one instead. */
  caption?: string | null;
  /** Room or area tag, e.g. `Living area`. */
  roomTag?: string | null;
  /** Listing name: property, parking slot or development. */
  listingName: string;
  /** Unit type or listing kind, e.g. `Studio`, `Parking slot`. */
  unitType?: string | null;
  /** City or place label. */
  city?: string | null;
  /** Zero-based position in the gallery, used only as a fallback descriptor. */
  index?: number;
};

const MAX_ALT_LENGTH = 200;

function clean(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Build the alt text for one photo. Always returns a non-empty string.
 */
export function buildListingImageAlt(input: ListingImageAltInput): string {
  const hostAlt = clean(input.alt);
  if (hostAlt) return hostAlt.slice(0, MAX_ALT_LENGTH);

  const caption = clean(input.caption);
  if (caption) return caption.slice(0, MAX_ALT_LENGTH);

  const name = clean(input.listingName) || 'Listing';
  const kind = clean(input.unitType);
  const city = clean(input.city);
  const room = clean(input.roomTag);

  const details = [kind, city ? `in ${city}` : null].filter(Boolean).join(' ');
  const subject = room ? `${room}, ${name}` : name;
  const tail = details ? `, ${details}` : '';
  // No "photo"/"image" here: screen readers already announce the element type, and
  // `img-redundant-alt` fails the build on it.
  const view = input.index != null ? ` (view ${input.index + 1})` : '';
  return `${subject}${tail}${view}`.slice(0, MAX_ALT_LENGTH);
}
