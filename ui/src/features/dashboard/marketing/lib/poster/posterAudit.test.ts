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
    const issues = auditPosterDocument(doc([text({ custom: { posterSlot: { overflow: true } } })]));

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
      pages: [
        { children: [text({ name: 'A' })] },
        { children: [text({ name: 'B', width: 5000 })] },
      ],
    } as unknown as PolotnoDesignDocument;

    expect(auditPosterDocument(document).map((issue) => issue.element)).toEqual(['B']);
  });
});

describe('auditPosterDocument story safe zones', () => {
  const story = (children: Child[]) =>
    ({ width: 1080, height: 1920, pages: [{ children }] }) as unknown as PolotnoDesignDocument;

  it('flags text under the Stories header and over the reply bar', () => {
    const issues = auditPosterDocument(
      story([text({ name: 'High', y: 100 }), text({ id: 't2', name: 'Low', y: 1700 })])
    );

    expect(issues.map((issue) => `${issue.kind}:${issue.element}`)).toEqual([
      'unsafe-zone:High',
      'unsafe-zone:Low',
    ]);
  });

  it('accepts text inside the safe band, and ignores feed posts', () => {
    expect(auditPosterDocument(story([text({ y: 400 })]))).toEqual([]);
    expect(auditPosterDocument(doc([text({ y: 20 })]))).toEqual([]);
  });
});

describe('auditPosterDocument v2 rules', () => {
  const kinds = (children: Child[], size = { width: W, height: H }) =>
    auditPosterDocument({ ...size, pages: [{ children }] } as unknown as PolotnoDesignDocument).map(
      (issue) => issue.kind
    );

  it('flags more than two families plus a script accent', () => {
    const family = (id: string, fontFamily: string, y: number) =>
      text({ id, name: id, fontFamily, y, x: 100 });
    expect(
      kinds([
        family('a', 'Poppins', 100),
        family('b', 'Great Vibes', 300),
        family('c', 'Fredoka', 500),
      ])
    ).toEqual([]);
    expect(
      kinds([
        family('a', 'Poppins', 100),
        family('b', 'Great Vibes', 300),
        family('c', 'Fredoka', 500),
        family('d', 'Montserrat', 700),
      ])
    ).toEqual(['too-many-fonts']);
  });

  it('does not count the brand wordmark as a family', () => {
    const base = ['Poppins', 'Great Vibes', 'Fredoka'].map((fontFamily, i) =>
      text({ id: `t${i}`, name: `T${i}`, fontFamily, y: 100 + i * 200 })
    );
    expect(
      kinds([...base, text({ id: 'b', name: 'Brand', fontFamily: 'Pacifico', y: 800 })])
    ).toEqual([]);
  });

  it('flags a poster with more text elements than the budget', () => {
    const many = Array.from({ length: 19 }, (_, i) =>
      text({ id: `t${i}`, name: `T${i}`, x: 10, y: i * 50, width: 40, height: 20, fontSize: 30 })
    );
    expect(kinds(many)).toContain('text-budget');
    expect(kinds(many.slice(0, 18))).not.toContain('text-budget');
  });

  it('keeps 4:5 text inside the centered 3:4 grid crop', () => {
    const portrait = { width: 1080, height: 1350 };
    expect(kinds([text({ x: 20, width: 400 })], portrait)).toEqual(['grid-unsafe']);
    expect(kinds([text({ x: 60, width: 400 })], portrait)).toEqual([]);
    expect(kinds([text({ x: 1000, width: 80 })], portrait)).toEqual(['grid-unsafe']);
    expect(kinds([text({ x: 20, width: 400 })])).toEqual([]);
  });

  it('flags a logo that sits on text but not one beside it', () => {
    const logo = { id: 'l', type: 'image', name: 'Logo', x: 100, y: 100, width: 100, height: 100 };
    expect(kinds([text({ x: 120, y: 120, width: 200, height: 40 }), logo])).toContain(
      'logo-overlap'
    );
    expect(kinds([text({ x: 400, y: 120, width: 200, height: 40 }), logo])).toEqual([]);
  });
});

describe('script faces stay in the Flyer family', () => {
  const doc = (archetype: string, fontFamily: string) =>
    ({
      width: 1080,
      height: 1350,
      schemaVersion: 2,
      fonts: [],
      custom: { poster: { archetype } },
      pages: [
        {
          id: 'p',
          background: '#fff',
          children: [
            {
              id: 't',
              type: 'text',
              name: 'Headline',
              text: 'Hello',
              x: 100,
              y: 100,
              width: 800,
              height: 120,
              fontSize: 100,
              fontFamily,
            },
          ],
        },
      ],
    }) as never;

  it('flags a script face on a Clean layout but not on a Flyer layout', () => {
    expect(auditPosterDocument(doc('photo-first', 'Allura')).map((i) => i.kind)).toContain(
      'script-misuse'
    );
    expect(auditPosterDocument(doc('wave-duo', 'Allura')).map((i) => i.kind)).not.toContain(
      'script-misuse'
    );
    expect(auditPosterDocument(doc('photo-first', 'Fraunces')).map((i) => i.kind)).not.toContain(
      'script-misuse'
    );
  });
});

describe('ornaments stay out of Clean and Lifestyle layouts', () => {
  const withOrnament = (archetype: string) =>
    ({
      width: 1080,
      height: 1350,
      schemaVersion: 2,
      fonts: [],
      custom: { poster: { archetype } },
      pages: [
        {
          id: 'p',
          background: '#fff',
          children: [{ id: 'o', type: 'svg', name: 'Ornament', x: 10, y: 10, width: 100, height: 100 }],
        },
      ],
    }) as never;

  it('flags an ornament on a Clean layout only', () => {
    expect(auditPosterDocument(withOrnament('photo-first')).map((i) => i.kind)).toContain(
      'ornament-in-clean'
    );
    expect(auditPosterDocument(withOrnament('wave-duo')).map((i) => i.kind)).not.toContain(
      'ornament-in-clean'
    );
  });
});
