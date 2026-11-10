import { describe, expect, it, vi } from 'vitest';

import { installOrganizationJsonLd } from '@/lib/seo/organizationJsonLd';
import { PRODUCTION_SITE_ORIGIN } from '@/lib/seo/siteOrigin';

type FakeScript = {
  type: string;
  dataset: Record<string, string>;
  textContent: string;
};

function fakeDocument(options: { existing?: boolean } = {}) {
  const appended: FakeScript[] = [];
  const createElement = vi.fn(() => ({ type: '', dataset: {}, textContent: '' }) as FakeScript);
  const doc = {
    querySelector: vi.fn(() => (options.existing ? {} : null)),
    createElement,
    head: { appendChild: vi.fn((el: FakeScript) => appended.push(el)) },
  };

  return { doc: doc as unknown as Document, createElement, appended };
}

type Graph = {
  '@graph': Array<Record<string, unknown>>;
};

describe('installOrganizationJsonLd', () => {
  it('injects one block with Organization and WebSite entities', () => {
    const { doc, appended } = fakeDocument();

    installOrganizationJsonLd(doc);

    expect(appended).toHaveLength(1);
    const [script] = appended;
    expect(script?.type).toBe('application/ld+json');
    expect(script?.dataset.organizationJsonld).toBe('true');

    const payload = JSON.parse(script?.textContent ?? '{}') as Graph;
    expect(payload['@graph']).toHaveLength(2);

    const org = payload['@graph'].find((node) => node['@type'] === 'Organization');
    const site = payload['@graph'].find((node) => node['@type'] === 'WebSite');
    expect(typeof org?.name).toBe('string');
    expect(String(org?.name).length).toBeGreaterThan(0);
    expect(typeof org?.alternateName).toBe('string');
    expect(org?.url).toBe(`${PRODUCTION_SITE_ORIGIN}/`);
    expect(org?.logo).toBe(`${PRODUCTION_SITE_ORIGIN}/images/logo.png`);
    expect(site?.url).toBe(`${PRODUCTION_SITE_ORIGIN}/`);
  });

  it('is idempotent so a re-render cannot duplicate the block', () => {
    const { doc, createElement, appended } = fakeDocument({ existing: true });

    installOrganizationJsonLd(doc);

    expect(createElement).not.toHaveBeenCalled();
    expect(appended).toHaveLength(0);
  });
});
