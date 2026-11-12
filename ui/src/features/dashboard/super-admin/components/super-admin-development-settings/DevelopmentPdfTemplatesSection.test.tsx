import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DevelopmentPdfTemplatesSection } from '@/features/dashboard/super-admin/components/super-admin-development-settings/DevelopmentPdfTemplatesSection';

// The upload path is an edge call; this file covers the mapping surface.
vi.mock('@/features/dashboard/org/lib/edgeClient', () => ({
  callEdgeFunction: vi.fn(),
}));

const TEMPLATE = {
  id: 'pdf-1',
  name: 'Move-in permit',
  storagePath: 'developments/dev-1/pdf-templates/1-move-in.pdf',
  fieldMap: { unitOwner: 'property.unitOwner', hoaReference: 'not.a.key' },
  signatureField: null,
  signatureNameField: null,
  version: 1,
};

function renderSection(overrides: Partial<Parameters<typeof DevelopmentPdfTemplatesSection>[0]> = {}) {
  const onChange = vi.fn();
  render(
    <DevelopmentPdfTemplatesSection
      developmentId="dev-1"
      templates={[TEMPLATE]}
      onChange={onChange}
      {...overrides}
    />
  );
  return { onChange };
}

describe('DevelopmentPdfTemplatesSection', () => {
  it('lists each PDF field and counts the ones left blank', () => {
    renderSection();

    expect(screen.getByText('Move-in permit')).toBeTruthy();
    expect(screen.getByText('unitOwner')).toBeTruthy();
    expect(screen.getByText('hoaReference')).toBeTruthy();
    expect(screen.getByText('1 field left blank.')).toBeTruthy();
  });

  it('removing a template reports the list without it', () => {
    const { onChange } = renderSection();

    fireEvent.click(screen.getByLabelText('Remove Move-in permit'));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('says so when a PDF carries no form fields', () => {
    renderSection({ templates: [{ ...TEMPLATE, fieldMap: {} }] });

    expect(screen.getByText('This PDF has no form fields.')).toBeTruthy();
  });

  it('offers the upload control even with no templates yet', () => {
    renderSection({ templates: [] });

    expect(screen.getByRole('button', { name: /upload/i })).toBeTruthy();
    expect(screen.getByLabelText('PDF')).toBeTruthy();
  });
});
