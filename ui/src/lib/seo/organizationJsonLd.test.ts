import { describe, expect, it, vi } from 'vitest';

import { installOrganizationJsonLd } from '@/lib/seo/organizationJsonLd';

type FakeScript = {
  type: string;
  dataset: Record<string, string>;
  textContent: string;
};

function fakeDocument(options: { existing?: boolean; origin?: string | null } = {}) {
  const appended: FakeScript[] = [];
  const createElement = vi.fn(() => ({ type: '', dataset: {}, textContent: '' }) as FakeScript);
  const doc = {
    querySelector: vi.fn(() => (options.existing ? {} : null)),
    createElement,
    head: { appendChild: vi.fn((el: FakeScript) => appended.push(el)) },
    defaultView: options.origin === null ? null : { location: { origin: options.origin ?? 'https://kamespace.test' } },
  };

  return { doc: doc as unknown as Document, createElement, appended, raw: doc };
}

describe('installOrganizationJsonLd', () => {
  it('injects one Organization block with the platform name and logo', () => {
    const { doc, appended } = fakeDocument();

    installOrganizationJsonLd(doc);

    expect(appended).toHaveLength(1);
    const [script] = appended;
    expect(script.type).toBe('application/ld+json');
    expect(script.dataset.organizationJsonld).toBe('true');

    const payload = JSON.parse(script?.textContent ?? '{}');
    expect(payload['@context']).toBe('https://schema.org');
    expect(payload['@type']).toBe('Organization');
    expect(typeof payload.name).toBe('string');
    expect(payload.name.length).toBeGreaterThan(0);
    expect(typeof payload.alternateName).toBe('string');
    expect(payload.url).toBe('https://kamespace.test');
    expect(payload.logo).toBe('https://kamespace.test/images/logo.png');
  });

  it('is idempotent so a re-render cannot duplicate the block', () => {
    const { doc, createElement, appended } = fakeDocument({ existing: true });

    installOrganizationJsonLd(doc);

    expect(createElement).not.toHaveBeenCalled();
    expect(appended).toHaveLength(0);
  });

  it('does nothing when there is no window origin to build URLs from', () => {
    const { doc, appended } = fakeDocument({ origin: null });

    installOrganizationJsonLd(doc);

    expect(appended).toHaveLength(0);
  });
});
