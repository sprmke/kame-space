import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { buildDocumentRequirement } from '@/features/dashboard/bookings/lib/documentRequirements';
import { DocumentRequirementsListEditor } from '@/features/dashboard/org/components/document-requirements/DocumentRequirementsListEditor';

const GAF = buildDocumentRequirement({
  id: 'gaf',
  label: 'GAF Request',
  order: 1,
  pdfTemplateId: 'gaf',
  approvalSource: 'email-listener',
  triggerCondition: 'always',
  calendarIcon: null,
});

function renderEditor(onChange = vi.fn()) {
  render(<DocumentRequirementsListEditor list={[GAF]} onChange={onChange} />);
  return onChange;
}

describe('DocumentRequirementsListEditor v2 fields', () => {
  it('shows the guest-facing name from the v2 labels', () => {
    renderEditor();
    expect((screen.getByLabelText('Guest-facing name') as HTMLInputElement).value).toBe(
      'Approved GAF'
    );
  });

  it('renaming the step patches the label', () => {
    const onChange = renderEditor();

    fireEvent.change(screen.getByLabelText('Document label'), {
      target: { value: 'Visitor pass' },
    });

    const next = onChange.mock.calls[0]?.[0] as Array<{ label: string; labels: { step: string } }>;
    expect(next[0]?.label).toBe('Visitor pass');
    expect(next[0]?.labels.step).toBe('Visitor pass');
  });

  it('retiring a step keeps the row and flips active', () => {
    const onChange = renderEditor();

    fireEvent.click(screen.getByLabelText('Active'));

    const next = onChange.mock.calls[0]?.[0] as Array<{ id: string; active: boolean }>;
    expect(next).toHaveLength(1);
    expect(next[0]?.id).toBe('gaf');
    expect(next[0]?.active).toBe(false);
  });
});
