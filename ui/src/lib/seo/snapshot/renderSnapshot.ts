/**
 * Crawler snapshot: the semantic HTML a non-JS crawler (GPTBot, ClaudeBot, Bingbot,
 * facebookexternalhit) receives in place of the empty SPA shell.
 *
 * Rules this module exists to keep:
 * - Exactly one `<h1>` per page, real `<a href>` links, descriptive alt text.
 * - Only text the rendered page also shows. Static copy comes from
 *   `content/staticPageCopy.ts`, dynamic copy from the same edge payloads the SPA reads.
 * - Escaped with the shared `escapeHtml`, so no host-supplied string can break out of a tag.
 * - `createRoot` replaces this markup the moment React hydrates, so browsers never see it.
 *
 * Pure and dependency-free (no `@/` imports): the middleware bundle imports it directly.
 */

import { PUBLIC_ROUTES } from '../publicRoutes';
import { escapeHtml } from '../seoMeta';

export type SnapshotFact = { label: string; value: string };
export type SnapshotLink = { href: string; label: string };
export type SnapshotImage = { src: string; alt: string; width?: number; height?: number };
export type SnapshotBreadcrumb = { name: string; path: string };

export type SnapshotPage = {
  /** Registry route id, used for `data-seo-route`. */
  id: string;
  heading: string;
  intro?: string;
  facts?: SnapshotFact[];
  links?: SnapshotLink[];
  images?: SnapshotImage[];
  breadcrumbs?: SnapshotBreadcrumb[];
};

function routePath(id: string): string {
  const route = PUBLIC_ROUTES.find((entry) => entry.id === id);
  if (!route) throw new Error(`snapshot: unknown public route id "${id}"`);
  return route.pattern;
}

type NavItem = { href: string; label: string };

/** Primary navigation, mirroring the public site header. */
export const SNAPSHOT_NAV: readonly NavItem[] = [
  // Home first so every snapshot page has an inbound link to `/` (the orphan check flags it).
  { href: routePath('home'), label: 'Home' },
  { href: routePath('properties'), label: 'Stays' },
  { href: routePath('parkings'), label: 'Parking' },
  { href: routePath('developments'), label: 'Developments' },
  { href: routePath('for-hosts'), label: 'For hosts' },
  { href: routePath('for-hosts-pricing'), label: 'Pricing' },
  { href: routePath('support'), label: 'Support' },
];

/** Footer navigation, mirroring the public site footer. */
export const SNAPSHOT_FOOTER: readonly NavItem[] = [
  { href: routePath('about'), label: 'About' },
  { href: routePath('contact'), label: 'Contact' },
  { href: routePath('support'), label: 'Support' },
  { href: routePath('terms'), label: 'Terms' },
  { href: routePath('privacy'), label: 'Privacy' },
  { href: routePath('cookies'), label: 'Cookies' },
];

function renderNav(origin: string): string {
  const items = SNAPSHOT_NAV.map(
    (item) =>
      `<li><a href="${escapeHtml(origin)}${escapeHtml(item.href)}">${escapeHtml(item.label)}</a></li>`
  ).join('');
  return `<header><nav aria-label="Main"><ul>${items}</ul></nav></header>`;
}

function renderFooter(origin: string): string {
  const items = SNAPSHOT_FOOTER.map(
    (item) =>
      `<li><a href="${escapeHtml(origin)}${escapeHtml(item.href)}">${escapeHtml(item.label)}</a></li>`
  ).join('');
  // `llms.txt` is a file, not a page, so it lives outside the human footer list.
  const llms = `<li><a href="${escapeHtml(origin)}/llms.txt">AI site map</a></li>`;
  return `<footer><nav aria-label="Footer"><ul>${items}${llms}</ul></nav></footer>`;
}

function renderBreadcrumbs(origin: string, breadcrumbs: SnapshotBreadcrumb[] | undefined): string {
  if (!breadcrumbs?.length) return '';
  const items = breadcrumbs
    .map((crumb) =>
      crumb.path === ''
        ? `<li aria-current="page">${escapeHtml(crumb.name)}</li>`
        : `<li><a href="${escapeHtml(origin)}${escapeHtml(crumb.path)}">${escapeHtml(crumb.name)}</a></li>`
    )
    .join('');
  return `<nav aria-label="Breadcrumb"><ol>${items}</ol></nav>`;
}

function renderFacts(facts: SnapshotFact[] | undefined): string {
  if (!facts?.length) return '';
  const rows = facts
    .filter((fact) => fact.label.trim() && fact.value.trim())
    .map((fact) => `<dt>${escapeHtml(fact.label)}</dt><dd>${escapeHtml(fact.value)}</dd>`)
    .join('');
  return rows ? `<dl>${rows}</dl>` : '';
}

function renderImages(images: SnapshotImage[] | undefined): string {
  if (!images?.length) return '';
  return images
    .filter((image) => image.src.trim())
    .slice(0, 8)
    .map((image) => {
      const size =
        image.width && image.height ? ` width="${image.width}" height="${image.height}"` : '';
      return `<figure><img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}"${size} loading="lazy" decoding="async" /></figure>`;
    })
    .join('');
}

function renderLinks(origin: string, links: SnapshotLink[] | undefined): string {
  if (!links?.length) return '';
  const items = links
    .filter((link) => link.href.trim() && link.label.trim())
    .map(
      (link) =>
        `<li><a href="${escapeHtml(origin)}${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`
    )
    .join('');
  return items ? `<ul>${items}</ul>` : '';
}

/**
 * Full snapshot markup for `#root`. `origin` is always the canonical origin, so every link a
 * crawler follows stays on the apex.
 */
export function renderSnapshotHtml(page: SnapshotPage, origin: string): string {
  const intro = page.intro?.trim() ? `<p>${escapeHtml(page.intro.trim())}</p>` : '';
  return [
    `<div id="root" data-seo-route="${escapeHtml(page.id)}">`,
    renderNav(origin),
    '<main>',
    renderBreadcrumbs(origin, page.breadcrumbs),
    `<h1>${escapeHtml(page.heading)}</h1>`,
    intro,
    renderFacts(page.facts),
    renderImages(page.images),
    renderLinks(origin, page.links),
    '</main>',
    renderFooter(origin),
    '</div>',
  ].join('');
}

/** Replace the empty SPA mount point with the snapshot. Returns the input when it is absent. */
export function injectSnapshotIntoHtml(html: string, snapshotHtml: string): string {
  if (html.includes('<div id="root"></div>')) {
    return html.replace('<div id="root"></div>', snapshotHtml);
  }
  // Built shells carry attributes on the mount point; match the element generically.
  return html.replace(/<div id="root"[^>]*>\s*<\/div>/i, snapshotHtml);
}
