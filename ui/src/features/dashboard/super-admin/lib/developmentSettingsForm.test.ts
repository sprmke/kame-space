import { describe, expect, it } from 'vitest';

import {
  developmentProfileDraftFromDevelopment,
  developmentProfileDraftIsDirty,
  buildDevelopmentUpdatePayload,
  validateDevelopmentProfileDraft,
  developmentPmoEmailPlaceholder,
} from '@/features/dashboard/super-admin/lib/developmentSettingsForm';
import type { Development } from '@/features/dashboard/super-admin/types/development';

function development(settings: Record<string, unknown>): Development {
  return {
    id: 'dev-1',
    slug: 'test-residence',
    name: 'Test Residence',
    developerName: null,
    type: 'SUBDIVISION',
    status: 'INACTIVE',
    location: null,
    city: null,
    description: null,
    coverImageUrl: null,
    settings,
    stats: { propertyCount: 0, parkingCount: 0 },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as Development;
}

describe('developmentProfileDraftFromDevelopment', () => {
  it('developmentProfileDraftFromDevelopment is exported', () => {
    expect(typeof developmentProfileDraftFromDevelopment).toBe('function');
  });
});

describe('developmentProfileDraftIsDirty', () => {
  it('developmentProfileDraftIsDirty is exported', () => {
    expect(typeof developmentProfileDraftIsDirty).toBe('function');
  });
});

describe('buildDevelopmentUpdatePayload', () => {
  it('buildDevelopmentUpdatePayload is exported', () => {
    expect(typeof buildDevelopmentUpdatePayload).toBe('function');
  });
});

describe('validateDevelopmentProfileDraft', () => {
  it('validateDevelopmentProfileDraft is exported', () => {
    expect(typeof validateDevelopmentProfileDraft).toBe('function');
  });
});

describe('developmentPmoEmailPlaceholder', () => {
  it('developmentPmoEmailPlaceholder is exported', () => {
    expect(typeof developmentPmoEmailPlaceholder).toBe('function');
  });
});

describe('structure draft', () => {
  it('derives structure from legacy flat keys when settings.structure is absent', () => {
    const draft = developmentProfileDraftFromDevelopment(
      development({
        propertyTowers: ['Monaco', 'Bay'],
        parkingTowers: ['Monaco', 'Bay'],
        parkingLevels: ['Level 1', 'Level 2'],
      })
    );

    expect(draft.structure.propertyTowers.map((tower) => tower.name)).toEqual(['Monaco', 'Bay']);
    expect(draft.structure.parkingTowers[0]).toMatchObject({
      name: 'Monaco',
      levels: ['Level 1', 'Level 2'],
      parkingType: 'inside_tower',
    });
    expect(draft.structure.parkingTowers[1]).toMatchObject({
      name: 'Bay',
      levels: ['Level 1', 'Level 2'],
      parkingType: 'outside_tower',
    });
  });

  it('prefers settings.structure when present', () => {
    const draft = developmentProfileDraftFromDevelopment(
      development({
        propertyTowers: ['Ignored'],
        structure: {
          towerLabel: 'Phase',
          unitLabel: 'Block & Lot',
          towersRequired: false,
          propertyTowers: [{ name: 'Phase 1', code: 'P1', active: true }],
          unitNumberFormat: { preset: 'alnum', example: 'Blk 3 Lot 5' },
          parkingSlotFormat: { preset: 'alnum', example: 'P-12' },
        },
      })
    );

    expect(draft.structure.towerLabel).toBe('Phase');
    expect(draft.structure.propertyTowers.map((tower) => tower.name)).toEqual(['Phase 1']);
  });

  it('saves structure and keeps the legacy flat keys in sync', () => {
    const draft = developmentProfileDraftFromDevelopment(
      development({
        structure: {
          towerLabel: 'Tower',
          unitLabel: 'Unit',
          towersRequired: true,
          propertyTowers: [{ name: 'Monaco', code: 'M', active: true }],
          parkingTowers: [
            { name: 'Monaco', code: 'M', levels: ['Level 1'], parkingType: 'inside_tower' },
          ],
          unitNumberFormat: { preset: 'digits4', example: '2604' },
          parkingSlotFormat: { preset: 'digits1to4', example: '26' },
        },
      })
    );

    const payload = buildDevelopmentUpdatePayload(draft) as Record<string, unknown>;

    expect(payload.structure).toEqual(draft.structure);
    expect(payload.propertyTowers).toEqual(['Monaco']);
    expect(payload.parkingTowers).toEqual(['Monaco']);
    expect(payload.parkingLevels).toEqual(['Level 1']);
  });

  it('is not dirty after a save round-trip', () => {
    const draft = developmentProfileDraftFromDevelopment(development({}));
    expect(developmentProfileDraftIsDirty(draft, { ...draft })).toBe(false);
  });

  it('rejects duplicate towers', () => {
    const draft = developmentProfileDraftFromDevelopment(development({}));
    draft.structure = {
      ...draft.structure,
      propertyTowers: [
        { name: 'Monaco', code: 'M', active: true },
        { name: 'monaco', code: 'M2', active: true },
      ],
    };

    expect(validateDevelopmentProfileDraft(draft)).toBe('Duplicate tower: monaco');
  });

  it('does not require a PMO email when no step emails the building admin (F14)', () => {
    const draft = developmentProfileDraftFromDevelopment(development({}));
    draft.pmoEmail = '';
    draft.documentRequirements = [];

    expect(validateDevelopmentProfileDraft(draft)).toBeNull();
  });

  it('requires a PMO email when an email-listener step exists', () => {
    const draft = developmentProfileDraftFromDevelopment(development({}));
    draft.pmoEmail = '';
    draft.documentRequirements = [
      {
        id: 'gaf',
        label: 'GAF Request',
        order: 1,
        pdfTemplateId: 'gaf',
        approvalSource: 'email-listener',
        triggerCondition: 'always',
        calendarIcon: null,
      },
    ];

    expect(validateDevelopmentProfileDraft(draft)).toBe(
      'PMO email is required for email approval steps'
    );
  });
});
