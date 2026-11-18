import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AddPropertyBillingNote } from '@/features/dashboard/org/components/AddPropertyBillingNote';
import type { AddPropertyPreview } from '@/features/dashboard/plans/lib/orgPlanApi';

const covered: AddPropertyPreview = {
  kind: 'add_property',
  status: 'covered',
  planName: 'Pro',
  propertyCount: 1,
  addsMonthlyPhp: 639,
  trueUpPhp: 320,
  nextRenewalPhp: 1438,
  renewsAt: '2026-09-01T00:00:00.000Z',
};

describe('AddPropertyBillingNote', () => {
  it('shows nothing before the quote loads or on Free', () => {
    const { container, rerender } = render(<AddPropertyBillingNote preview={undefined} />);
    expect(container.firstChild).toBeNull();
    rerender(<AddPropertyBillingNote preview={{ ...covered, status: 'free' }} />);
    expect(container.firstChild).toBeNull();
  });

  it('says what a covered property adds and what joins the next payment', () => {
    render(<AddPropertyBillingNote preview={covered} />);
    const note = screen.getByRole('note');
    expect(note.textContent).toContain('a month to your Pro plan from Sep 1, 2026');
    expect(note.textContent).toContain('for the rest of this period is added to your next payment');
  });

  it('leaves out the true-up sentence when nothing is owed for this period', () => {
    render(<AddPropertyBillingNote preview={{ ...covered, trueUpPhp: 0 }} />);
    expect(screen.getByRole('note').textContent).not.toContain('next payment');
  });

  it('warns that an overdue plan keeps the property on Free', () => {
    render(<AddPropertyBillingNote preview={{ ...covered, status: 'overdue', trueUpPhp: 0 }} />);
    expect(screen.getByRole('note').textContent).toContain('stays on Free until you pay');
  });
});
