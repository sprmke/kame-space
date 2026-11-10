import { describe, expect, it } from 'vitest';

import {
  requirementApplies,
  parseDocumentRequirements,
  mergeDocumentRequirements,
  requirementMatchesPdfTemplate,
  hasApplicableDocumentPdfTemplate,
  requirementDocKind,
  requirementNeedsApprovedPdf,
} from '@/features/dashboard/bookings/lib/documentRequirements';

describe('requirementApplies', () => {
  it('requirementApplies is exported', () => {
    expect(typeof requirementApplies).toBe('function');
  });
});

describe('parseDocumentRequirements', () => {
  it('parseDocumentRequirements is exported', () => {
    expect(typeof parseDocumentRequirements).toBe('function');
  });
});

describe('mergeDocumentRequirements', () => {
  it('mergeDocumentRequirements is exported', () => {
    expect(typeof mergeDocumentRequirements).toBe('function');
  });
});

describe('requirementMatchesPdfTemplate', () => {
  it('requirementMatchesPdfTemplate is exported', () => {
    expect(typeof requirementMatchesPdfTemplate).toBe('function');
  });
});

describe('hasApplicableDocumentPdfTemplate', () => {
  it('hasApplicableDocumentPdfTemplate is exported', () => {
    expect(typeof hasApplicableDocumentPdfTemplate).toBe('function');
  });
});

describe('requirementDocKind', () => {
  it('requirementDocKind is exported', () => {
    expect(typeof requirementDocKind).toBe('function');
  });
});

describe('requirementNeedsApprovedPdf', () => {
  it('requirementNeedsApprovedPdf is exported', () => {
    expect(typeof requirementNeedsApprovedPdf).toBe('function');
  });
});

describe('document requirements v2 (client mirror)', () => {
  it('upgrades an Azure v1 row and keeps the approved-file rule', () => {
    const [gaf] = mergeDocumentRequirements([
      {
        id: 'gaf',
        label: 'GAF Request',
        order: 1,
        pdfTemplateId: 'gaf',
        approvalSource: 'email-listener',
        triggerCondition: 'always',
        calendarIcon: null,
      },
    ]);

    expect(gaf?.legacyKind).toBe('gaf');
    expect(gaf?.approval.requiresApprovedFile).toBe(true);
    expect(gaf?.labels.approved).toBe('Approved GAF');
    expect(requirementNeedsApprovedPdf(gaf!)).toBe(true);
  });

  it('never classifies a step from its label', () => {
    const [carpet] = mergeDocumentRequirements([
      {
        id: 'carpet',
        label: 'Carpet inspection',
        order: 1,
        pdfTemplateId: null,
        approvalSource: 'manual',
        triggerCondition: 'always',
        calendarIcon: null,
      },
    ]);

    expect(requirementDocKind(carpet)).toBe('other');
    expect(requirementNeedsApprovedPdf(carpet!)).toBe(false);
  });
});
