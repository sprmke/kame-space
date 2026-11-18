import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrgBillingAdminDetail } from '@/features/dashboard/super-admin/hooks/useOrgBillingAdmin';

const mutate = vi.fn();
let detail: OrgBillingAdminDetail;

vi.mock('@/features/dashboard/super-admin/hooks/useOrgBillingAdmin', () => ({
  useOrgBillingAdmin: () => ({ data: detail, isLoading: false, error: null }),
  useOrgBillingAdminAction: () => ({ mutate, isPending: false }),
}));

const { SuperAdminOrgBillingPanel } =
  await import('@/features/dashboard/super-admin/components/super-admin-orgs/SuperAdminOrgBillingPanel');

function baseDetail(overrides: Partial<OrgBillingAdminDetail> = {}): OrgBillingAdminDetail {
  return {
    subscription: {
      id: 'sub-1',
      planId: 'plan-pro',
      planName: 'Pro',
      planCode: 'growth',
      status: 'active',
      source: 'purchase',
      pricePhpSnapshot: 799,
      currentPeriodStart: '2026-08-01T00:00:00.000Z',
      currentPeriodEnd: '2026-09-01T00:00:00.000Z',
      graceEndsAt: null,
      suspendedAt: null,
      cancelAtPeriodEnd: false,
      scheduledPlanId: null,
      scheduledChangeAt: null,
      priceOverridePhp: null,
    },
    recentEvents: [],
    transactions: [],
    ledger: [],
    ledgerBalancePhp: 0,
    ...overrides,
  };
}

describe('SuperAdminOrgBillingPanel', () => {
  const realConfirm = window.confirm;

  beforeEach(() => {
    mutate.mockReset();
    detail = baseDetail();
  });

  afterEach(() => {
    window.confirm = realConfirm;
  });

  /** happy-dom has no confirm(); the panel asks before destructive actions. */
  const answerConfirm = (answer: boolean) => {
    const confirm = vi.fn(() => answer);
    window.confirm = confirm;
    return confirm;
  };

  it('shows the plan, period end and account credit', () => {
    detail = baseDetail({ ledgerBalancePhp: -250 });
    render(<SuperAdminOrgBillingPanel organizationId="org-1" />);
    expect(screen.getByText('Pro')).toBeTruthy();
    expect(screen.getByText('Sep 1, 2026')).toBeTruthy();
    expect(screen.getByText(/₱250 credit/)).toBeTruthy();
  });

  it('merges events, payments and credit into one newest-first history', () => {
    detail = baseDetail({
      recentEvents: [
        {
          id: 'e1',
          event_type: 'change_scheduled',
          created_at: '2026-08-10T00:00:00.000Z',
        },
      ],
      transactions: [
        {
          id: 't1',
          amount: 799,
          status: 'paid',
          applied: true,
          purpose: 'renewal',
          created_at: '2026-08-01T00:00:00.000Z',
          paid_at: '2026-08-01T00:00:00.000Z',
        },
      ],
      ledger: [
        {
          id: 'l1',
          amount_php: -100,
          kind: 'admin_adjustment',
          created_at: '2026-08-15T00:00:00.000Z',
        },
      ],
    });
    const { container } = render(<SuperAdminOrgBillingPanel organizationId="org-1" />);
    // The history is the only ordered list on the panel.
    const items = Array.from(container.querySelectorAll('ol > li')).map(
      (item) => item.textContent ?? ''
    );
    expect(items).toHaveLength(3);
    // Newest first: the credit (Aug 15), then the scheduled downgrade (Aug 10), then the payment.
    expect(items[1]).toContain('Downgrade scheduled');
  });

  it('removes or applies a scheduled change through the state machine actions', () => {
    detail = baseDetail({
      subscription: {
        ...baseDetail().subscription!,
        scheduledPlanId: 'plan-starter',
        scheduledChangeAt: '2026-09-01T00:00:00.000Z',
      },
    });
    answerConfirm(true);
    render(<SuperAdminOrgBillingPanel organizationId="org-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove scheduled change' }));
    expect(mutate).toHaveBeenLastCalledWith({ action: 'clear_intent' });

    fireEvent.click(screen.getByRole('button', { name: 'Apply now' }));
    expect(mutate).toHaveBeenLastCalledWith({ action: 'apply_intent_now' });
    // A scheduled change replaces the plain "cancel at period end" control.
    expect(screen.queryByRole('button', { name: 'Cancel at period end' })).toBeNull();
  });

  it('asks before ending a plan now and stops when declined', () => {
    const confirm = answerConfirm(false);
    render(<SuperAdminOrgBillingPanel organizationId="org-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'End plan now' }));
    expect(confirm).toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('lists a held payment and resolves it as credit', () => {
    detail = baseDetail({
      transactions: [
        {
          id: 'held-1',
          amount: 799,
          status: 'paid',
          applied: false,
          review_reason: 'paid_after_expiry',
          created_at: '2026-08-20T00:00:00.000Z',
          paid_at: '2026-08-20T00:00:00.000Z',
        },
      ],
    });
    render(<SuperAdminOrgBillingPanel organizationId="org-1" />);
    expect(screen.getByText('Held payments')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Keep as credit' }));
    expect(mutate).toHaveBeenLastCalledWith({
      action: 'resolve_payment',
      transactionId: 'held-1',
      resolution: 'keep_credit',
    });
  });

  it('marks a payment refunded only after confirming, and never lists held payments', () => {
    detail = baseDetail({
      transactions: [
        {
          id: 'paid-1',
          amount: 799,
          status: 'paid',
          applied: true,
          purpose: 'renewal',
          receipt_number: 'KS-R-2026-000123',
          created_at: '2026-08-01T00:00:00.000Z',
          paid_at: '2026-08-01T00:00:00.000Z',
        },
        {
          id: 'held-1',
          amount: 799,
          status: 'paid',
          applied: false,
          review_reason: 'paid_after_expiry',
          created_at: '2026-08-20T00:00:00.000Z',
          paid_at: '2026-08-20T00:00:00.000Z',
        },
      ],
    });
    render(<SuperAdminOrgBillingPanel organizationId="org-1" />);
    expect(screen.getByText('KS-R-2026-000123')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Mark refunded' })).toHaveLength(1);

    answerConfirm(false);
    fireEvent.click(screen.getByRole('button', { name: 'Mark refunded' }));
    expect(mutate).not.toHaveBeenCalled();

    answerConfirm(true);
    fireEvent.click(screen.getByRole('button', { name: 'Mark refunded' }));
    expect(mutate).toHaveBeenLastCalledWith({ action: 'record_refund', transactionId: 'paid-1' });
  });

  it('needs an amount and a reason before adjusting credit', () => {
    render(<SuperAdminOrgBillingPanel organizationId="org-1" />);
    const apply = screen.getAllByRole('button', { name: 'Apply' })[0] as HTMLButtonElement;
    expect(apply.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Credit amount in pesos'), { target: { value: '300' } });
    expect(apply.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Reason for the adjustment'), {
      target: { value: 'Goodwill after an outage' },
    });
    expect(apply.disabled).toBe(false);

    fireEvent.click(apply);
    expect(mutate).toHaveBeenCalledWith(
      { action: 'adjust_credit', creditPhp: 300, note: 'Goodwill after an outage' },
      expect.any(Object)
    );
  });
});
