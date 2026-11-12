import { describe, expect, it } from 'vitest';

import { buildDocumentRequirement } from '@/features/dashboard/bookings/lib/documentRequirements';
import {
  applyDocumentRequirementPatch,
  isRequestPdfTemplateId,
  documentRequirementsOverrideEqual,
  documentRequirementLabelFieldErrors,
  createDocumentRequirement,
  addDocumentRequirement,
  removeDocumentRequirement,
  moveDocumentRequirement,
  updateDocumentRequirement,
  DOCUMENT_PDF_TEMPLATE_NONE,
} from '@/features/dashboard/org/lib/propertyDocumentRequirements';

describe('isRequestPdfTemplateId', () => {
  it('isRequestPdfTemplateId is exported', () => {
    expect(typeof isRequestPdfTemplateId).toBe('function');
  });
});

describe('documentRequirementsOverrideEqual', () => {
  it('documentRequirementsOverrideEqual is exported', () => {
    expect(typeof documentRequirementsOverrideEqual).toBe('function');
  });
});

describe('documentRequirementLabelFieldErrors', () => {
  it('documentRequirementLabelFieldErrors is exported', () => {
    expect(typeof documentRequirementLabelFieldErrors).toBe('function');
  });
});

describe('createDocumentRequirement', () => {
  it('createDocumentRequirement is exported', () => {
    expect(typeof createDocumentRequirement).toBe('function');
  });
});

describe('addDocumentRequirement', () => {
  it('addDocumentRequirement is exported', () => {
    expect(typeof addDocumentRequirement).toBe('function');
  });
});

describe('removeDocumentRequirement', () => {
  it('removeDocumentRequirement is exported', () => {
    expect(typeof removeDocumentRequirement).toBe('function');
  });
});

describe('moveDocumentRequirement', () => {
  it('moveDocumentRequirement is exported', () => {
    expect(typeof moveDocumentRequirement).toBe('function');
  });
});

describe('updateDocumentRequirement', () => {
  it('updateDocumentRequirement is exported', () => {
    expect(typeof updateDocumentRequirement).toBe('function');
  });
});

describe('DOCUMENT_PDF_TEMPLATE_NONE', () => {
  it('is defined', () => {
    expect(DOCUMENT_PDF_TEMPLATE_NONE).toBeDefined();
  });
});

describe('applyDocumentRequirementPatch keeps v1 aliases and v2 fields in step', () => {
  const base = buildDocumentRequirement({
    id: 'custom-1',
    label: 'Old name',
    order: 1,
    pdfTemplateId: null,
    approvalSource: 'manual',
    triggerCondition: 'always',
    calendarIcon: null,
  });

  it('renaming through `label` also renames the v2 step label', () => {
    const next = applyDocumentRequirementPatch(base, { label: 'New name' });
    expect(next.label).toBe('New name');
    expect(next.labels.step).toBe('New name');
  });

  it('changing the approval source also updates approval.source', () => {
    const next = applyDocumentRequirementPatch(base, { approvalSource: 'email-listener' });
    expect(next.approvalSource).toBe('email-listener');
    expect(next.approval.source).toBe('email-listener');
  });

  it('changing the PDF template also updates output', () => {
    const withTemplate = applyDocumentRequirementPatch(base, { pdfTemplateId: 'gaf' });
    expect(withTemplate.output).toEqual({ type: 'generated_pdf', pdfTemplateId: 'gaf' });
    expect(withTemplate.pdfTemplateId).toBe('gaf');

    const cleared = applyDocumentRequirementPatch(withTemplate, { pdfTemplateId: null });
    expect(cleared.output).toEqual({ type: 'none' });
    expect(cleared.pdfTemplateId).toBeNull();
  });

  it('a patch that sets labels directly back-fills the v1 alias', () => {
    const next = applyDocumentRequirementPatch(base, {
      labels: { ...base.labels, step: 'Direct label' },
    });
    expect(next.label).toBe('Direct label');
  });
});
