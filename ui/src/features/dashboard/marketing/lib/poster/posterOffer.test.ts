import { describe, expect, it } from 'vitest';

import { auditPosterDocument } from '@/features/dashboard/marketing/lib/poster/posterAudit';
import { compilePosterDocument } from '@/features/dashboard/marketing/lib/poster/posterCompiler';
import {
  copyContext,
  pickPosterCopy,
} from '@/features/dashboard/marketing/lib/poster/posterCopyLibrary';
import { buildRuleBasedPosterSpecs } from '@/features/dashboard/marketing/lib/poster/posterDefaults';
import { buildPosterFacts } from '@/features/dashboard/marketing/lib/poster/posterFacts';
import {
  formatOfferDate,
  manilaToday,
  offerDetailLine,
  offerProblem,
  readOfferDate,
  sanitizePosterOffer,
} from '@/features/dashboard/marketing/lib/poster/posterOffer';

const TODAY = '2026-11-13';

describe('readOfferDate', () => {
  it('accepts real dates only', () => {
    expect(readOfferDate('2026-12-31')).toBe('2026-12-31');
    expect(readOfferDate('2028-02-29')).toBe('2028-02-29');
    expect(readOfferDate('2026-02-29')).toBeNull();
    expect(readOfferDate('2026-02-31')).toBeNull();
    expect(readOfferDate('2026-13-01')).toBeNull();
    expect(readOfferDate('12/31/2026')).toBeNull();
    expect(readOfferDate(20261231)).toBeNull();
    expect(readOfferDate('')).toBeNull();
  });
});

describe('manilaToday', () => {
  it('uses the Manila calendar, not the machine one', () => {
    // 17:00 UTC on the 12th is already 01:00 on the 13th in Manila.
    expect(manilaToday(new Date('2026-11-12T17:00:00Z'))).toBe('2026-11-13');
    expect(manilaToday(new Date('2026-11-12T15:59:00Z'))).toBe('2026-11-12');
  });
});

describe('sanitizePosterOffer', () => {
  it('keeps a good offer and normalizes the code', () => {
    expect(
      sanitizePosterOffer(
        { text: '20% off weekdays', validUntil: '2026-12-31', code: ' summer10 ' },
        TODAY
      )
    ).toEqual({ text: '20% off weekdays', validUntil: '2026-12-31', code: 'SUMMER10' });
  });

  it('returns null without usable text, so no offer is invented', () => {
    for (const raw of [null, undefined, 'x', 5, {}, { text: '   ' }, { text: 42 }]) {
      expect(sanitizePosterOffer(raw, TODAY)).toBeNull();
    }
  });

  it('drops an expired offer so a stale deal is never printed', () => {
    expect(
      sanitizePosterOffer({ text: 'Free breakfast', validUntil: '2026-11-12' }, TODAY)
    ).toBeNull();
    expect(
      sanitizePosterOffer({ text: 'Free breakfast', validUntil: '2026-11-13' }, TODAY)
    ).not.toBeNull();
  });

  it('ignores a malformed date or code but keeps the offer', () => {
    expect(
      sanitizePosterOffer({ text: 'Free breakfast', validUntil: 'soon', code: 'a b' }, TODAY)
    ).toEqual({
      text: 'Free breakfast',
      validUntil: null,
      code: null,
    });
  });

  it('strips dashes the way all poster copy is', () => {
    expect(sanitizePosterOffer({ text: '10% off — weekdays' }, TODAY)?.text).toBe(
      '10% off, weekdays'
    );
  });

  it('drops text longer than the headline can hold', () => {
    expect(
      sanitizePosterOffer({ text: 'a very long offer that goes on and on forever and ever' }, TODAY)
    ).toBeNull();
  });
});

describe('offerProblem', () => {
  it('is quiet for an empty form and for a good one', () => {
    expect(offerProblem({}, TODAY)).toBeNull();
    expect(
      offerProblem({ text: '15% off', validUntil: '2026-12-01', code: 'KAME15' }, TODAY)
    ).toBeNull();
  });

  it('explains each failure', () => {
    expect(offerProblem({ code: 'KAME15' }, TODAY)).toBe('missing-text');
    expect(offerProblem({ text: '15% off', validUntil: '2026-02-31' }, TODAY)).toBe('bad-date');
    expect(offerProblem({ text: '15% off', validUntil: '2026-01-01' }, TODAY)).toBe('expired');
    expect(offerProblem({ text: '15% off', code: '!!' }, TODAY)).toBe('bad-code');
  });
});

describe('offer wording', () => {
  it('formats the date without a timezone shift', () => {
    expect(formatOfferDate('2026-12-31')).toBe('Dec 31');
    expect(formatOfferDate('2026-01-05')).toBe('Jan 5');
  });

  it('builds the detail line', () => {
    expect(offerDetailLine({ text: 'x', validUntil: '2026-12-31', code: 'KAME15' })).toBe(
      'Until Dec 31. Code KAME15'
    );
    expect(offerDetailLine({ text: 'x', validUntil: null, code: 'KAME15' })).toBe('Code KAME15');
    expect(offerDetailLine({ text: 'x', validUntil: null, code: null })).toBeNull();
  });
});

describe('promo copy with an offer', () => {
  const facts = buildPosterFacts({
    propertyName: 'Palm Cove Villa',
    property: {
      city: 'Batangas',
      checkInTime: '14:00',
      checkOutTime: '12:00',
      amenities: ['Swimming Pool', 'Netflix'],
      pricing: { baseRate: 8500, currency: 'PHP' },
    },
    photos: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
  });
  const offer = { text: '20% off weekdays', validUntil: '2026-12-31', code: 'SUMMER10' };
  const withOffer = { ...facts, offer };

  it('prints the offer verbatim on every variant', () => {
    for (let index = 0; index < 4; index += 1) {
      const copy = pickPosterCopy('promo', copyContext(withOffer, null), index);
      expect(copy.headline).toBe('20% off weekdays');
    }
  });

  it('gives every variant a different tagline or subhead', () => {
    const sets = [0, 1, 2, 3].map((i) => pickPosterCopy('promo', copyContext(withOffer, null), i));
    expect(new Set(sets.map((s) => s.eyebrow + s.subhead + s.tagline)).size).toBe(4);
  });

  it('shows the date and the code from the form, never invented ones', () => {
    const all = [0, 1, 2, 3]
      .flatMap((i) => Object.values(pickPosterCopy('promo', copyContext(withOffer, null), i)))
      .join(' | ');
    expect(all).toContain('Until Dec 31');
    expect(all).toContain('SUMMER10');
    expect(all).not.toMatch(/\d+% off(?! weekdays)/);
  });

  it('keeps every other goal free of discount wording', () => {
    for (const goal of ['vibe', 'amenity-spotlight', 'feature-spotlight', 'stay-info'] as const) {
      for (let index = 0; index < 4; index += 1) {
        const text = Object.values(
          pickPosterCopy(goal, copyContext(withOffer, 'Jacuzzi'), index)
        ).join(' ');
        expect(text).not.toMatch(/20%|SUMMER10|% off|discount|save /i);
      }
    }
  });

  it('without an offer, promo copy claims no saving', () => {
    for (let index = 0; index < 6; index += 1) {
      const text = Object.values(pickPosterCopy('promo', copyContext(facts, null), index)).join(
        ' '
      );
      expect(text).not.toMatch(/% off|discount|save |sale|deal/i);
    }
  });

  it('compiles clean at the longest offer and code, in every format', () => {
    const longest = {
      text: 'Free breakfast every weekday',
      validUntil: '2026-12-31',
      code: 'ABCDEFGHIJKLMNOP',
    };
    const specs = buildRuleBasedPosterSpecs({ ...facts, offer: longest }, 'promo');
    expect(specs).toHaveLength(4);
    for (const spec of specs) {
      for (const format of [
        'instagram-post',
        'instagram-portrait',
        'instagram-story',
        'facebook-post',
      ] as const) {
        expect(
          auditPosterDocument(compilePosterDocument(spec, { ...facts, offer: longest }, format))
        ).toEqual([]);
      }
    }
  });
});
