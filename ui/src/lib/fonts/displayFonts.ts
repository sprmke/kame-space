/**
 * Display font families, loaded on demand instead of on every page.
 *
 * `index.html` ships **Plus Jakarta Sans only**: it is the product font and every route needs
 * it. The other fourteen families exist so a host can theme a showcase page or a stay guide
 * (`font-fraunces`, `font-cormorant`, `font-instrument`, `font-outfit`, `font-grotesk`,
 * `font-jost`, `font-figtree` in `tailwind.config.js`). Nothing outside
 * `features/guest/marketing/showcase/**` uses them, so loading them globally cost every visitor
 * a ~19 KB stylesheet and a third-party round trip for nothing.
 *
 * `ShowcaseShell` calls `ensureDisplayFonts()` when it mounts, which covers the showcase route
 * and the stay guide (both render through it). Text is readable immediately because every
 * display class has a real fallback in the Tailwind config (Georgia / serif, system-ui), so the
 * late stylesheet is a swap, not a blank.
 *
 * Keep this list in sync with the `fontFamily` entries in `ui/tailwind.config.js`.
 */

const DISPLAY_FAMILIES = [
  'Playfair+Display:ital,wght@0,400..900;1,400..900',
  'Cormorant+Garamond:ital,wght@0,300..700;1,300..700',
  'Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900',
  'Instrument+Serif:ital@0;1',
  'Lora:ital,wght@0,400..700;1,400..700',
  'Inter+Tight:wght@300..700',
  'Space+Grotesk:wght@300..700',
  'DM+Sans:ital,opsz,wght@0,9..40,400..700;1,9..40,400..700',
  'Outfit:wght@200..800',
  'Manrope:wght@200..800',
  'Sora:wght@300..700',
  'Jost:wght@300..600',
  'Figtree:wght@300..800',
  'Nunito+Sans:ital,wght@0,400..700;1,400..700',
] as const;

const LINK_ID = 'kame-display-fonts';

/** The stylesheet URL for the display families. Exported for the unit test. */
export function displayFontsHref(): string {
  const families = DISPLAY_FAMILIES.map((family) => `family=${family}`).join('&');
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

/**
 * Append the display-font stylesheet once. Safe to call on every mount and on repeated
 * navigations; a second call is a no-op.
 */
export function ensureDisplayFonts(doc: Document = document): void {
  if (doc.getElementById(LINK_ID)) return;
  const link = doc.createElement('link');
  link.id = LINK_ID;
  link.rel = 'stylesheet';
  link.href = displayFontsHref();
  doc.head.appendChild(link);
}
