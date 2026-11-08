import { describe, expect, it } from 'vitest';

import type { PolotnoDesignDocument } from '@/features/dashboard/marketing/lib/polotno/polotnoCampaignDocuments';
import { auditPosterDocument } from '@/features/dashboard/marketing/lib/poster/posterAudit';

const W = 1080;
const H = 1080;

type Child = Record<string, unknown>;

function text(overrides: Child = {}): Child {
  return {
    id: 't1',
    type: 'text',
    name: 'Headline',
    x: 100,
    y: 100,
    width: 500,
    height: 80,
    fontSize: 60,
    text: 'Sunset Villa',
    align: 'center',
    ...overrides,
  };
}

function doc(children: Child[]): PolotnoDesignDocument {
  return { width: W, height: H, pages: [{ children }] } as unknown as PolotnoDesignDocument;
}

describe('auditPosterDocument', () => {
  it('passes a clean poster', () => {
    expect(auditPosterDocument(doc([text()]))).toEqual([]);
  });

  it('flags an element that leaves the canvas', () => {
    const issues = auditPosterDocument(doc([text({ x: 900, width: 500 })]));

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'out-of-bounds', element: 'Headline' });
  });

  it('lets full-bleed photos and scrims touch or exceed the edges', () => {
    const issues = auditPosterDocument(
      doc([
        { id: 'p', type: 'image', name: 'Photo', x: -50, y: -50, width: 1200, height: 1200 },
        { id: 's', type: 'figure', name: 'Scrim', x: -10, y: 800, width: 1100, height: 300 },
      ])
    );

    expect(issues).toEqual([]);
  });

  it('tolerates a couple of pixels of rounding', () => {
    expect(auditPosterDocument(doc([text({ x: -1, width: 500 })]))).toEqual([]);
  });

  it('flags copy below the phone-legibility floor', () => {
    const issues = auditPosterDocument(doc([text({ fontSize: 10 })]));

    expect(issues[0]).toMatchObject({ kind: 'text-too-small', element: 'Headline' });
    expect(String(issues[0]?.detail)).toContain('px');
  });

  it('flags empty text and drops it from the overlap pass', () => {
    const issues = auditPosterDocument(doc([text({ text: '   ' })]));

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'empty-text' });
  });

  it('flags a slot the compiler marked as overflowing', () => {
    const issues = auditPosterDocument(
      doc([text({ custom: { posterSlot: { overflow: true } } })])
    );

    expect(issues.map((issue) => issue.kind)).toContain('text-overflow');
  });

  it('flags broken geometry instead of computing with it', () => {
    const issues = auditPosterDocument(doc([text({ width: Number.NaN })]));

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'invalid-geometry' });
  });

  it('flags two text boxes that collide', () => {
    const issues = auditPosterDocument(
      doc([text({ id: 'a', name: 'Headline' }), text({ id: 'b', name: 'Subhead', y: 110 })])
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]?.kind).toBe('text-overlap');
    expect(issues[0]?.element).toBe('Headline × Subhead');
  });

  it('ignores a deliberate overlap such as a script accent under a headline', () => {
    const issues = auditPosterDocument(
      doc([
        text({ id: 'a', name: 'Headline' }),
        text({
          id: 'b',
          name: 'Accent',
          y: 110,
          custom: { posterSlot: { allowOverlap: true } },
        }),
      ])
    );

    expect(issues).toEqual([]);
  });

  it('does not treat a small graze as an overlap', () => {
    // Only the bottom 4px of the first box meets the second.
    const issues = auditPosterDocument(
      doc([text({ id: 'a', name: 'Headline' }), text({ id: 'b', name: 'Subhead', y: 176 })])
    );

    expect(issues).toEqual([]);
  });

  it('walks every page', () => {
    const document = {
      width: W,
      height: H,
      pages: [{ children: [text({ name: 'A' })] }, { children: [text({ name: 'B', width: 5000 })] }],
    } as unknown as PolotnoDesignDocument;

    expect(auditPosterDocument(document).map((issue) => issue.element)).toEqual(['B']);
  });
});
