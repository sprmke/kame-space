import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { LEGAL_DOCUMENTS } from '@/lib/legal/legalDocuments';
import { legalHref, type LegalDocId } from '@/lib/legal/legalMeta';

const SRC_ROOT = resolve(__dirname, '../..');

function listTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === 'node_modules' ? [] : listTsx(full);
    return full.endsWith('.tsx') ? [full] : [];
  });
}

/** Every `<LegalLink doc="x" section="y">` in the app, as `[file, doc, section]`. */
function collectSectionLinks(): [string, LegalDocId, string][] {
  const pattern = /<LegalLink\b[^>]*?\bdoc="(terms|privacy|cookies)"[^>]*?\bsection="([^"]+)"/gs;
  return listTsx(SRC_ROOT).flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(pattern)].map(
      (m) =>
        [file.replace(SRC_ROOT, 'src'), m[1] as LegalDocId, m[2]] as [string, LegalDocId, string]
    )
  );
}

describe('legal documents', () => {
  it.each(Object.values(LEGAL_DOCUMENTS))('$id has unique section ids', (doc) => {
    const ids = doc.sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has no em or en dashes in policy text', () => {
    const text = JSON.stringify(LEGAL_DOCUMENTS);
    expect(text).not.toMatch(/[–—]/);
  });

  it('every in-app section link points at an existing section', () => {
    const links = collectSectionLinks();
    expect(links.length).toBeGreaterThan(0);
    for (const [file, doc, section] of links) {
      const ids = LEGAL_DOCUMENTS[doc].sections.map((s) => s.id);
      expect(ids, `${file} links ${legalHref(doc, section)}`).toContain(section);
    }
  });
});
