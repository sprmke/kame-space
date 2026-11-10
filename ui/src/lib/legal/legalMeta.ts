/**
 * Shared shape and routing for the three platform policies. The public pages
 * (`/terms`, `/privacy`, `/cookies`) and the in-flow `LegalDocumentSheet` render
 * the same data, so wording never drifts between them.
 */
export type LegalDocId = 'terms' | 'privacy' | 'cookies';

export type LegalSection = {
  /** Stable anchor id. Linked from in-app notices (`/terms#billing`), so never rename casually. */
  id: string;
  title: string;
  paragraphs: readonly string[];
  /** Optional bullet list rendered after the paragraphs. */
  items?: readonly string[];
};

export type LegalDocument = {
  id: LegalDocId;
  title: string;
  description: string;
  sections: readonly LegalSection[];
};

/** One date for all three policies. Bump it whenever any policy text changes. */
export const LEGAL_LAST_UPDATED = '9 November 2026';

export const LEGAL_PATHS: Readonly<Record<LegalDocId, string>> = {
  terms: '/terms',
  privacy: '/privacy',
  cookies: '/cookies',
};

export const LEGAL_LINK_LABELS: Readonly<Record<LegalDocId, string>> = {
  terms: 'Terms',
  privacy: 'Privacy Policy',
  cookies: 'Cookie Policy',
};

export function legalHref(doc: LegalDocId, section?: string): string {
  return section ? `${LEGAL_PATHS[doc]}#${section}` : LEGAL_PATHS[doc];
}

/** Section DOM id. The sheet prefixes ids so they never collide with the open policy page. */
export function legalSectionDomId(sectionId: string, idPrefix = ''): string {
  return `${idPrefix}${sectionId}`;
}
