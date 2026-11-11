import { describe, expect, it } from 'vitest';

import {
  buildDocumentRequirement,
  mergeDocumentRequirements,
} from '@/features/dashboard/bookings/lib/documentRequirements';
import { updateDocumentRequirement } from '@/features/dashboard/org/lib/propertyDocumentRequirements';
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
      buildDocumentRequirement({
        id: 'gaf',
        label: 'GAF Request',
        order: 1,
        pdfTemplateId: 'gaf',
        approvalSource: 'email-listener',
        triggerCondition: 'always',
        calendarIcon: null,
      }),
    ];

    expect(validateDevelopmentProfileDraft(draft)).toBe(
      'PMO email is required for email approval steps'
    );
  });
});

describe('approval steps round-trip through the editor', () => {
  const settings = {
    workflowDefaults: {
      documentRequirements: [
        {
          id: 'gaf',
          label: 'GAF Request',
          order: 1,
          pdfTemplateId: 'gaf',
          approvalSource: 'email-listener',
          triggerCondition: 'always',
          calendarIcon: null,
        },
        {
          id: 'carpet',
          label: 'Carpet inspection',
          order: 2,
          pdfTemplateId: null,
          approvalSource: 'manual',
          triggerCondition: 'always',
          calendarIcon: null,
        },
      ],
    },
  };

  it('keeps an edited step label after saving and re-reading the row', () => {
    const draft = developmentProfileDraftFromDevelopment(development(settings));
    draft.documentRequirements = updateDocumentRequirement(draft.documentRequirements, 0, {
      label: 'Visitor pass',
    });

    const saved = buildDevelopmentUpdatePayload(draft).documentRequirements;
    const reloaded = mergeDocumentRequirements(saved);
    expect(reloaded[0]?.labels.step).toBe('Visitor pass');
    expect(reloaded[0]?.label).toBe('Visitor pass');
    // Azure identity survives an unrelated rename.
    expect(reloaded[0]?.legacyKind).toBe('gaf');
  });

  it('keeps a guest-facing name and the retired flag', () => {
    const draft = developmentProfileDraftFromDevelopment(development(settings));
    draft.documentRequirements = updateDocumentRequirement(draft.documentRequirements, 1, {
      labels: {
        ...draft.documentRequirements[1]!.labels,
        approved: 'Approved carpet slip',
      },
      active: false,
    });

    const saved = buildDevelopmentUpdatePayload(draft).documentRequirements;
    const reloaded = mergeDocumentRequirements(saved);

    expect(reloaded[1]?.labels.approved).toBe('Approved carpet slip');
    expect(reloaded[1]?.active).toBe(false);
  });

  it('a retired email step no longer requires a PMO email', () => {
    const draft = developmentProfileDraftFromDevelopment(development(settings));
    draft.pmoEmail = '';
    draft.documentRequirements = updateDocumentRequirement(draft.documentRequirements, 0, {
      approvalSource: 'none',
    });

    expect(validateDevelopmentProfileDraft(draft)).toBeNull();

    draft.documentRequirements = updateDocumentRequirement(draft.documentRequirements, 0, {
      approvalSource: 'email-listener',
      active: false,
    });
    expect(validateDevelopmentProfileDraft(draft)).toBeNull();
  });
});

describe('pdf templates round-trip through the editor', () => {
  const template = {
    id: 'pdf-1',
    name: 'Move-in permit',
    storagePath: 'developments/dev-1/pdf-templates/1-move-in.pdf',
    fieldMap: { unitOwner: 'property.unitOwner', mystery: 'not.a.key' },
    signatureField: null,
    signatureNameField: null,
    version: 1,
  };

  it('reads stored templates into the draft', () => {
    const draft = developmentProfileDraftFromDevelopment(
      development({ approvals: { pdfTemplates: [template] } })
    );

    expect(draft.pdfTemplates).toHaveLength(1);
    expect(draft.pdfTemplates[0]?.name).toBe('Move-in permit');
    expect(draft.pdfTemplates[0]?.fieldMap.unitOwner).toBe('property.unitOwner');
  });

  it('sends the templates back on save and drops a malformed entry', () => {
    const draft = developmentProfileDraftFromDevelopment(
      development({ approvals: { pdfTemplates: [template] } })
    );
    draft.pdfTemplates = [...draft.pdfTemplates, { ...template, id: 'pdf-2', name: 'Second' }];

    const payload = buildDevelopmentUpdatePayload(draft);
    expect(payload.pdfTemplates).toHaveLength(2);
    expect(payload.pdfTemplates[1]?.name).toBe('Second');
  });

  it('a development with no templates starts empty', () => {
    const draft = developmentProfileDraftFromDevelopment(development({}));
    expect(draft.pdfTemplates).toEqual([]);
  });
});

describe('property seeds round-trip through the editor', () => {
  it('reads stored seeds and sends them back on save', () => {
    const draft = developmentProfileDraftFromDevelopment(
      development({ propertySeeds: { amenityIds: ['wifi'], houseRuleIds: ['no_smoking'] } })
    );

    expect(draft.propertySeeds.amenityIds).toEqual(['wifi']);
    draft.propertySeeds = { amenityIds: ['wifi', 'pool'], houseRuleIds: ['no_smoking'] };

    const payload = buildDevelopmentUpdatePayload(draft);
    expect(payload.propertySeeds).toEqual({
      amenityIds: ['wifi', 'pool'],
      houseRuleIds: ['no_smoking'],
    });
  });

  it('a development with no seeds starts empty', () => {
    const draft = developmentProfileDraftFromDevelopment(development({}));
    expect(draft.propertySeeds).toEqual({ amenityIds: [], houseRuleIds: [] });
  });
});

describe('building rules and visibility round-trip through the editor', () => {
  it('reads stored rules and visibility', () => {
    const draft = developmentProfileDraftFromDevelopment(
      development({
        buildingRules: [{ id: 'no-smoking', text: 'No smoking.', type: 'prohibited' }],
        guestInfoVisibility: { stayGuide: false, propertyPage: true },
      })
    );

    expect(draft.buildingRules).toEqual([
      { id: 'no-smoking', text: 'No smoking.', type: 'prohibited' },
    ]);
    expect(draft.guestInfoVisibility).toEqual({ stayGuide: false, propertyPage: true });
  });

  it('defaults to shown when the settings say nothing', () => {
    const draft = developmentProfileDraftFromDevelopment(development({}));
    expect(draft.guestInfoVisibility).toEqual({ stayGuide: true, propertyPage: true });
    expect(draft.buildingRules).toEqual([]);
  });

  it('sends both back on save', () => {
    const draft = developmentProfileDraftFromDevelopment(development({}));
    draft.buildingRules = [{ id: 'rule-1', text: 'Pool closes at 10 PM.', type: 'info' }];
    draft.guestInfoVisibility = { stayGuide: true, propertyPage: false };

    const payload = buildDevelopmentUpdatePayload(draft);
    expect(payload.buildingRules).toEqual([
      { id: 'rule-1', text: 'Pool closes at 10 PM.', type: 'info' },
    ]);
    expect(payload.guestInfoVisibility).toEqual({ stayGuide: true, propertyPage: false });
  });
});
