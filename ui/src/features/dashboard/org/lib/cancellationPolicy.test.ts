import { describe, expect, it } from 'vitest';

import {
  CANCELLATION_POLICY_MAX_TIERS,
  CANCELLATION_POLICY_VERSION,
  CANCELLATION_PRESETS,
  buildCancellationPolicySnapshot,
  buildCancellationPreset,
  cancellationPolicyEqual,
  cancellationPolicyHash,
  cancellationPolicyToSettingsPatch,
  isCancellationPolicyNonRefundable,
  normalizeCancellationPolicy,
  normalizeCancellationTiers,
  readCancellationPolicyFromSettings,
  readCancellationPolicySnapshot,
  readCancellationPolicyVersionId,
  resolveCancellationPolicyDisplay,
  stableStringify,
  validateCancellationPolicy,
} from '@/features/dashboard/org/lib/cancellationPolicy';

describe('normalizeCancellationTiers', () => {
  it('returns nothing for a non-array', () => {
    expect(normalizeCancellationTiers(undefined)).toEqual([]);
    expect(normalizeCancellationTiers({ daysBefore: 7 })).toEqual([]);
  });

  it('sorts furthest-deadline first', () => {
    expect(
      normalizeCancellationTiers([
        { daysBefore: 3, refundPercent: 50 },
        { daysBefore: 14, refundPercent: 100 },
        { daysBefore: 7, refundPercent: 80 },
      ])
    ).toEqual([
      { daysBefore: 14, refundPercent: 100 },
      { daysBefore: 7, refundPercent: 80 },
      { daysBefore: 3, refundPercent: 50 },
    ]);
  });

  it('keeps one tier per deadline, with the last value winning', () => {
    expect(
      normalizeCancellationTiers([
        { daysBefore: 7, refundPercent: 100 },
        { daysBefore: 7, refundPercent: 40 },
      ])
    ).toEqual([{ daysBefore: 7, refundPercent: 40 }]);
  });

  it('clamps days and percent, and reads numeric strings', () => {
    expect(
      normalizeCancellationTiers([
        { daysBefore: '-4', refundPercent: '150' },
        { daysBefore: 999, refundPercent: -20 },
      ])
    ).toEqual([
      { daysBefore: 365, refundPercent: 0 },
      { daysBefore: 0, refundPercent: 100 },
    ]);
  });

  it('skips incomplete rows and caps the list', () => {
    const rows = [
      ...[1, 2, 3, 4, 5, 6, 7].map((days) => ({ daysBefore: days, refundPercent: 10 })),
      null,
      'nope',
      [1, 2],
      { daysBefore: 1 },
      { refundPercent: 10 },
    ];

    const tiers = normalizeCancellationTiers(rows);
    expect(tiers).toHaveLength(CANCELLATION_POLICY_MAX_TIERS);
    expect(tiers[0]?.daysBefore).toBe(7);
  });
});

describe('buildCancellationPreset', () => {
  it('builds each preset from its definition', () => {
    expect(buildCancellationPreset('moderate')).toMatchObject({
      version: CANCELLATION_POLICY_VERSION,
      presetId: 'moderate',
      tiers: [{ daysBefore: 3, refundPercent: 100 }],
      fallbackRefundPercent: 0,
    });

    expect(buildCancellationPreset('firm').tiers).toEqual([
      { daysBefore: 14, refundPercent: 100 },
      { daysBefore: 7, refundPercent: 50 },
    ]);

    expect(buildCancellationPreset('non_refundable').tiers).toEqual([]);
  });

  it('returns fresh tier objects so a preset cannot be mutated through a caller', () => {
    const first = buildCancellationPreset('flexible');
    first.tiers[0]!.refundPercent = 1;
    expect(buildCancellationPreset('flexible').tiers[0]?.refundPercent).toBe(100);
  });

  it('builds a custom policy from supplied tiers', () => {
    expect(
      buildCancellationPreset('custom', { tiers: [{ daysBefore: 2, refundPercent: 60 }] })
    ).toEqual({
      version: CANCELLATION_POLICY_VERSION,
      presetId: 'custom',
      tiers: [{ daysBefore: 2, refundPercent: 60 }],
      fallbackRefundPercent: 0,
    });
  });
});

describe('normalizeCancellationPolicy', () => {
  it('treats a missing or shapeless value as unset', () => {
    expect(normalizeCancellationPolicy(null)).toBeNull();
    expect(normalizeCancellationPolicy('flexible')).toBeNull();
    expect(normalizeCancellationPolicy([])).toBeNull();
    expect(normalizeCancellationPolicy({ version: 2 })).toBeNull();
  });

  it('rebuilds a preset from its id, ignoring stored tiers', () => {
    expect(
      normalizeCancellationPolicy({ presetId: 'limited', tiers: [{ daysBefore: 1, refundPercent: 5 }] })
    ).toMatchObject({
      presetId: 'limited',
      tiers: [{ daysBefore: 7, refundPercent: 100 }],
    });
  });

  it('normalizes a custom policy and clamps the fallback', () => {
    expect(
      normalizeCancellationPolicy({
        presetId: 'custom',
        tiers: [{ daysBefore: 10, refundPercent: 100 }],
        fallbackRefundPercent: 500,
        legacyTitle: '  Old terms  ',
        needsReview: true,
      })
    ).toEqual({
      version: CANCELLATION_POLICY_VERSION,
      presetId: 'custom',
      tiers: [{ daysBefore: 10, refundPercent: 100 }],
      fallbackRefundPercent: 100,
      legacyTitle: 'Old terms',
      needsReview: true,
    });
  });

  it('maps legacy grace_period to the flexible preset', () => {
    expect(normalizeCancellationPolicy({ type: 'grace_period' })?.presetId).toBe('flexible');
  });

  it('maps legacy full/moderate deadlines to a custom 100% tier', () => {
    expect(
      normalizeCancellationPolicy({ type: 'full_before_checkin', daysBeforeCheckIn: 5 })
    ).toMatchObject({ presetId: 'custom', tiers: [{ daysBefore: 5, refundPercent: 100 }] });

    // No deadline on the row falls back to 7 days.
    expect(normalizeCancellationPolicy({ type: 'moderate' })?.tiers).toEqual([
      { daysBefore: 7, refundPercent: 100 },
    ]);
  });

  it('maps legacy partial refunds, defaulting to 50%', () => {
    expect(
      normalizeCancellationPolicy({
        type: 'partial_before_checkin',
        daysBeforeCheckIn: 4,
        partialRefundPercent: 30,
      })?.tiers
    ).toEqual([{ daysBefore: 4, refundPercent: 30 }]);

    expect(normalizeCancellationPolicy({ type: 'partial_before_checkin' })?.tiers).toEqual([
      { daysBefore: 7, refundPercent: 50 },
    ]);
  });

  it('maps legacy non-refundable and free-text policies', () => {
    expect(normalizeCancellationPolicy({ type: 'non_refundable' })?.presetId).toBe('non_refundable');

    expect(
      normalizeCancellationPolicy({
        type: 'custom',
        customTitle: 'Ask us',
        customDescription: 'Call the host.',
      })
    ).toMatchObject({
      presetId: 'custom',
      tiers: [],
      needsReview: true,
      legacyTitle: 'Ask us',
      legacyDescription: 'Call the host.',
    });
  });

  it('drops an unknown legacy type', () => {
    expect(normalizeCancellationPolicy({ type: 'quantum' })).toBeNull();
  });
});

describe('settings accessors', () => {
  it('reads a policy and a version id out of settings', () => {
    expect(
      readCancellationPolicyFromSettings({ cancellationPolicy: { presetId: 'standard' } })?.presetId
    ).toBe('standard');
    expect(readCancellationPolicyFromSettings({})).toBeNull();
    expect(readCancellationPolicyFromSettings(null)).toBeNull();

    expect(readCancellationPolicyVersionId({ cancellationPolicyVersionId: ' v1 ' })).toBe('v1');
    expect(readCancellationPolicyVersionId({ cancellationPolicyVersionId: 3 })).toBeNull();
    expect(readCancellationPolicyVersionId(undefined)).toBeNull();
  });
});

describe('stableStringify / equality / hash', () => {
  it('ignores key order but not array order', () => {
    expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }));
    expect(stableStringify({ a: [1, 2] })).not.toBe(stableStringify({ a: [2, 1] }));
    expect(stableStringify(null)).toBe('null');
  });

  it('compares policies structurally', () => {
    expect(cancellationPolicyEqual(buildCancellationPreset('firm'), buildCancellationPreset('firm'))).toBe(
      true
    );
    expect(cancellationPolicyEqual(buildCancellationPreset('firm'), buildCancellationPreset('limited'))).toBe(
      false
    );
    expect(cancellationPolicyEqual(null, null)).toBe(true);
  });

  it('produces a stable 16-character hex hash that changes with the policy', () => {
    const firm = buildCancellationPreset('firm');
    const hash = cancellationPolicyHash(firm);

    expect(hash).toMatch(/^[0-9a-f]{16}$/);
    expect(cancellationPolicyHash(buildCancellationPreset('firm'))).toBe(hash);
    expect(cancellationPolicyHash(buildCancellationPreset('limited'))).not.toBe(hash);
    expect(cancellationPolicyHash(null)).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('resolveCancellationPolicyDisplay', () => {
  it('tells the guest to ask when nothing is set', () => {
    expect(resolveCancellationPolicyDisplay(null)).toMatchObject({
      presetId: 'unset',
      tone: 'neutral',
      shortLabel: 'Ask the host',
      unset: true,
      needsReview: false,
      timeline: [],
    });
  });

  it('flags a migrated free-text policy for setup', () => {
    const display = resolveCancellationPolicyDisplay({
      type: 'custom',
      customTitle: 'Old terms',
    });

    expect(display).toMatchObject({
      presetId: 'custom',
      title: 'Old terms',
      tone: 'warning',
      shortLabel: 'Old terms',
      needsReview: true,
      unset: false,
      showListingHighlight: false,
    });
  });

  it('labels each preset with the right tone and highlight', () => {
    const expected = {
      flexible: ['positive', true],
      moderate: ['positive', true],
      standard: ['positive', true],
      limited: ['positive', true],
      firm: ['neutral', true],
      non_refundable: ['warning', false],
    } as const;

    for (const [presetId, [tone, highlight]] of Object.entries(expected)) {
      const display = resolveCancellationPolicyDisplay(
        buildCancellationPreset(presetId as keyof typeof expected)
      );
      expect(display.tone).toBe(tone);
      expect(display.showListingHighlight).toBe(highlight);
    }
  });

  it('builds timeline labels with correct pluralisation', () => {
    expect(
      resolveCancellationPolicyDisplay(
        buildCancellationPreset('custom', {
          tiers: [
            { daysBefore: 0, refundPercent: 10 },
            { daysBefore: 1, refundPercent: 20 },
            { daysBefore: 5, refundPercent: 30 },
          ],
        })
      ).timeline.map((row) => row.label)
    ).toEqual([
      '5 days before check-in',
      '1 day before check-in',
      // Known blemish: a 0-day tier reads "on check-in day before check-in".
      // Kept as-is because the string is mirrored byte-for-byte by the edge copy.
      'on check-in day before check-in',
    ]);
  });

  it('describes a single custom tier', () => {
    const display = resolveCancellationPolicyDisplay(
      buildCancellationPreset('custom', { tiers: [{ daysBefore: 7, refundPercent: 100 }] })
    );

    expect(display.title).toBe('100% of what you paid, 7 days before check-in');
    expect(display.shortLabel).toBe('Free cancellation');
    expect(display.tone).toBe('positive');
    expect(display.description).toContain('no refund after that.');
  });

  it('describes a tiered custom policy and its fallback', () => {
    const display = resolveCancellationPolicyDisplay({
      presetId: 'custom',
      tiers: [
        { daysBefore: 14, refundPercent: 100 },
        { daysBefore: 7, refundPercent: 50 },
      ],
      fallbackRefundPercent: 25,
    });

    expect(display.title).toBe('Tiered refunds');
    expect(display.description).toBe(
      '100% of what you paid at least 14 days before check-in, 50% of what you paid at least 7 days before check-in, 25% after that.'
    );
    expect(display.shortLabel).toBe('Free cancellation');
    expect(display.showListingHighlight).toBe(true);
  });

  it('shows a custom policy without tiers as ask-the-host terms', () => {
    const display = resolveCancellationPolicyDisplay(buildCancellationPreset('custom'));

    expect(display).toMatchObject({
      title: 'Cancellation terms',
      description: 'Contact the host for cancellation terms.',
      tone: 'neutral',
      shortLabel: 'Custom policy',
      timeline: [],
      unset: false,
    });
  });
});

describe('isCancellationPolicyNonRefundable', () => {
  it('is true for the non-refundable preset', () => {
    expect(
      isCancellationPolicyNonRefundable(
        resolveCancellationPolicyDisplay(buildCancellationPreset('non_refundable'))
      )
    ).toBe(true);
  });

  it('is true for a custom policy that refunds nothing', () => {
    expect(
      isCancellationPolicyNonRefundable(
        resolveCancellationPolicyDisplay({
          presetId: 'custom',
          tiers: [{ daysBefore: 3, refundPercent: 0 }],
          fallbackRefundPercent: 0,
        })
      )
    ).toBe(true);
  });

  it('is false when some refund is possible, or terms are unknown', () => {
    expect(
      isCancellationPolicyNonRefundable(
        resolveCancellationPolicyDisplay(buildCancellationPreset('moderate'))
      )
    ).toBe(false);
    expect(isCancellationPolicyNonRefundable(resolveCancellationPolicyDisplay(null))).toBe(false);
    expect(
      isCancellationPolicyNonRefundable(
        resolveCancellationPolicyDisplay({ type: 'custom' })
      )
    ).toBe(false);
  });
});

describe('validateCancellationPolicy', () => {
  it('requires a policy', () => {
    expect(validateCancellationPolicy(null)).toBe('Choose a cancellation policy');
  });

  it('accepts any preset', () => {
    for (const preset of CANCELLATION_PRESETS) {
      if (preset.id === 'custom') continue;
      expect(validateCancellationPolicy(buildCancellationPreset(preset.id))).toBeNull();
    }
  });

  it('accepts a migrated policy awaiting setup', () => {
    expect(validateCancellationPolicy({ type: 'custom' })).toBeNull();
  });

  it('requires at least one custom deadline', () => {
    expect(validateCancellationPolicy(buildCancellationPreset('custom'))).toBe(
      'Add at least one refund deadline'
    );
  });

  it('normalizes deadline order and duplicates before validating', () => {
    expect(
      validateCancellationPolicy({
        presetId: 'custom',
        tiers: [
          { daysBefore: 3, refundPercent: 50 },
          { daysBefore: 7, refundPercent: 100 },
          { daysBefore: 3, refundPercent: 50 },
        ],
        fallbackRefundPercent: 0,
      })
    ).toBeNull();
  });

  it('rejects a refund that grows closer to check-in', () => {
    expect(
      validateCancellationPolicy({
        presetId: 'custom',
        tiers: [
          { daysBefore: 14, refundPercent: 40 },
          { daysBefore: 7, refundPercent: 80 },
        ],
      })
    ).toBe('Refund percent cannot increase closer to check-in');
  });

  it('rejects a fallback higher than the closest deadline', () => {
    expect(
      validateCancellationPolicy({
        presetId: 'custom',
        tiers: [{ daysBefore: 7, refundPercent: 30 }],
        fallbackRefundPercent: 60,
      })
    ).toBe('The fallback refund cannot be higher than the closest deadline');
  });

  it('accepts a well-ordered custom policy', () => {
    expect(
      validateCancellationPolicy({
        presetId: 'custom',
        tiers: [
          { daysBefore: 14, refundPercent: 100 },
          { daysBefore: 7, refundPercent: 50 },
        ],
        fallbackRefundPercent: 0,
      })
    ).toBeNull();
  });
});

describe('cancellationPolicyToSettingsPatch', () => {
  it('normalizes on the way into settings', () => {
    expect(cancellationPolicyToSettingsPatch(buildCancellationPreset('firm'))).toEqual({
      cancellationPolicy: buildCancellationPreset('firm'),
    });
    expect(cancellationPolicyToSettingsPatch(null)).toEqual({ cancellationPolicy: null });
  });
});

describe('buildCancellationPolicySnapshot', () => {
  it('captures the policy, its rendered copy and a hash', () => {
    const policy = buildCancellationPreset('moderate');
    const snapshot = buildCancellationPolicySnapshot({
      policy,
      capturedFrom: 'guest_form',
      propertyPolicyVersionId: 'version-1',
      capturedAt: '2026-11-08T00:00:00.000Z',
      externalSource: 'airbnb',
    });

    expect(snapshot).toMatchObject({
      policy,
      capturedAt: '2026-11-08T00:00:00.000Z',
      capturedFrom: 'guest_form',
      propertyPolicyVersionId: 'version-1',
      externalSource: 'airbnb',
      rendered: {
        title: 'Moderate',
        shortLabel: 'Free cancellation',
        description: 'Full refund of what you paid up to 3 days before check-in.',
      },
      hash: cancellationPolicyHash(policy),
    });
    expect(snapshot).not.toHaveProperty('unset');
  });

  it('marks a snapshot without a policy as unset', () => {
    const snapshot = buildCancellationPolicySnapshot({ policy: null, capturedFrom: 'import' });

    expect(snapshot.unset).toBe(true);
    expect(snapshot.propertyPolicyVersionId).toBeNull();
    expect(snapshot.rendered.shortLabel).toBe('Ask the host');
  });
});

describe('readCancellationPolicySnapshot', () => {
  it('rejects a shapeless value', () => {
    expect(readCancellationPolicySnapshot(null)).toBeNull();
    expect(readCancellationPolicySnapshot([])).toBeNull();
    expect(readCancellationPolicySnapshot('snapshot')).toBeNull();
  });

  it('falls back to safe defaults for a partial record', () => {
    const snapshot = readCancellationPolicySnapshot({ policy: { presetId: 'flexible' } });

    expect(snapshot).toMatchObject({
      capturedAt: new Date(0).toISOString(),
      capturedFrom: 'backfill',
      propertyPolicyVersionId: null,
      rendered: { title: '', description: '', shortLabel: '' },
      hash: '',
    });
    expect(snapshot?.unset).toBeUndefined();
  });

  it('keeps a known capture source and flags an unset policy', () => {
    const snapshot = readCancellationPolicySnapshot({
      policy: null,
      capturedFrom: 'admin',
      rendered: { title: 'Ask the host' },
      hash: 'abc',
    });

    expect(snapshot).toMatchObject({ capturedFrom: 'admin', hash: 'abc', unset: true });
    expect(snapshot?.rendered.title).toBe('Ask the host');
  });

  it('rejects an unknown capture source', () => {
    expect(
      readCancellationPolicySnapshot({ policy: null, capturedFrom: 'somewhere' })?.capturedFrom
    ).toBe('backfill');
  });
});
