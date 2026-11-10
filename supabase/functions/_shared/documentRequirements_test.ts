import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  buildDocumentRequirement,
  mergeDocumentRequirements,
  parseDocumentRequirements,
  requirementApplies,
  requirementDocKind,
  requirementMatchesPdfTemplate,
  requirementNeedsApprovedPdf,
} from './documentRequirements.ts';

const AZURE_LIST = [
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
    id: 'pet',
    label: 'Pet Approval',
    order: 2,
    pdfTemplateId: 'pet',
    approvalSource: 'email-listener',
    triggerCondition: 'has_pets',
    calendarIcon: '🐶',
  },
];

Deno.test('mergeDocumentRequirements: no list means no building approvals (F1)', () => {
  assertEquals(mergeDocumentRequirements(undefined), []);
  assertEquals(mergeDocumentRequirements(null), []);
  assertEquals(mergeDocumentRequirements([]), []);
});

Deno.test('mergeDocumentRequirements: malformed input degrades to an empty list', () => {
  assertEquals(mergeDocumentRequirements('nope'), []);
  assertEquals(mergeDocumentRequirements({ id: 'gaf' }), []);
  assertEquals(mergeDocumentRequirements([{ id: 'x' }, null, 3]), []);
});

Deno.test('parseDocumentRequirements: keeps a valid list ordered by order', () => {
  const parsed = parseDocumentRequirements([...AZURE_LIST].reverse());
  assertEquals(parsed?.map((entry) => entry.id), ['gaf', 'pet']);
  assertEquals(parsed?.[1]?.calendarIcon, '🐶');
});

Deno.test('parseDocumentRequirements: rejects a non-array', () => {
  assertEquals(parseDocumentRequirements(undefined), null);
  assertEquals(parseDocumentRequirements('gaf'), null);
});

Deno.test('requirementApplies: trigger conditions read booking flags', () => {
  const [gaf, pet] = mergeDocumentRequirements(AZURE_LIST);
  assertEquals(requirementApplies(gaf, {}), true);
  assertEquals(requirementApplies(pet, {}), false);
  assertEquals(requirementApplies(pet, { has_pets: true }), true);
  assertEquals(requirementApplies(pet, { has_pets: 'true' }), true);
  assertEquals(requirementApplies(pet, { has_pets: false }), false);
});

// ─── Document Requirements v2 ──────────────────────────────────────────────────

/** A custom step whose label happens to contain "pet" — the old F4 label sniffing. */
const CARPET_STEP = {
  id: 'carpet',
  label: 'Carpet inspection',
  order: 3,
  pdfTemplateId: null,
  approvalSource: 'manual',
  triggerCondition: 'always',
  calendarIcon: null,
};

Deno.test('v1 upgrade: Azure steps keep their identity and approved-file rule', () => {
  const [gaf, pet] = mergeDocumentRequirements(AZURE_LIST);

  assertEquals(gaf?.legacyKind, 'gaf');
  assertEquals(pet?.legacyKind, 'pet');
  assertEquals(gaf?.approval.requiresApprovedFile, true);
  assertEquals(pet?.approval.requiresApprovedFile, true);
  assertEquals(gaf?.active, true);
  assertEquals(gaf?.blocksCheckIn, true);
  assertEquals(gaf?.output, { type: 'generated_pdf', pdfTemplateId: 'gaf' });
});

Deno.test('v1 upgrade: Azure labels match the strings the UI rendered before', () => {
  const [gaf, pet] = mergeDocumentRequirements(AZURE_LIST);

  assertEquals(gaf?.labels, {
    step: 'GAF Request',
    short: 'GAF',
    guest: 'Guest Advise Form',
    approved: 'Approved GAF',
  });
  assertEquals(pet?.labels.approved, 'Approved pet form');
  // v1 aliases stay derived so older callers keep working.
  assertEquals(gaf?.label, 'GAF Request');
  assertEquals(gaf?.pdfTemplateId, 'gaf');
  assertEquals(gaf?.approvalSource, 'email-listener');
});

Deno.test('v2 parse: a labels-only row fills the v1 aliases', () => {
  const [requirement] = mergeDocumentRequirements([
    {
      id: 'move-in',
      order: 1,
      triggerCondition: 'always',
      approval: { source: 'manual', requiresApprovedFile: false },
      labels: {
        step: 'Move-in permit',
        short: 'Permit',
        guest: 'Move-in permit',
        approved: 'Approved move-in permit',
      },
      output: { type: 'none' },
    },
  ]);

  assertEquals(requirement?.label, 'Move-in permit');
  assertEquals(requirement?.labels.short, 'Permit');
  assertEquals(requirement?.pdfTemplateId, null);
  assertEquals(requirement?.legacyKind, null);
  assertEquals(requirement?.blocksCheckIn, true);
});

Deno.test('F4: a label containing "pet" is no longer a pet document', () => {
  const [, , carpet] = mergeDocumentRequirements([...AZURE_LIST, CARPET_STEP]);

  assertEquals(requirementDocKind(carpet), 'other');
  assertEquals(requirementNeedsApprovedPdf(carpet!), false);
});

Deno.test('F4: a custom step using the GAF template generates it but is not the GAF step', () => {
  const [custom] = mergeDocumentRequirements([
    {
      id: 'hoa-form',
      label: 'HOA clearance',
      order: 1,
      pdfTemplateId: 'gaf',
      approvalSource: 'manual',
      triggerCondition: 'always',
      calendarIcon: null,
    },
  ]);

  assertEquals(requirementMatchesPdfTemplate(custom!, 'gaf'), true);
  assertEquals(requirementDocKind(custom), 'other');
  assertEquals(custom?.legacyKind, null);
  assertEquals(requirementNeedsApprovedPdf(custom!), false);
});

Deno.test('legacy nested sub-status ids still classify as gaf and pet', () => {
  const [gaf, pet] = mergeDocumentRequirements(AZURE_LIST);

  assertEquals(requirementDocKind(gaf, 'PENDING_GAF'), 'gaf');
  assertEquals(requirementDocKind(pet, 'PENDING_PET_REQUEST'), 'pet');
});

Deno.test('a retired step never applies to a booking', () => {
  const [retired] = mergeDocumentRequirements([{ ...CARPET_STEP, active: false }]);

  assertEquals(retired?.active, false);
  assertEquals(requirementApplies(retired!, {}), false);
});

Deno.test('buildDocumentRequirement: the editor factory produces the derived fields', () => {
  const draft = buildDocumentRequirement({
    id: 'custom-3',
    label: 'Parking sticker',
    order: 3,
    pdfTemplateId: null,
    approvalSource: 'manual',
    triggerCondition: 'need_parking',
    calendarIcon: null,
  });

  assertEquals(draft.labels.step, 'Parking sticker');
  assertEquals(draft.labels.short, 'Parking sticker');
  assertEquals(draft.legacyKind, null);
  assertEquals(draft.approval.requiresApprovedFile, false);
  assertEquals(draft.output, { type: 'none' });
});
