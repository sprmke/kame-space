import { expect, test } from '@playwright/test';

import { seedSupabaseAuthSession } from '../../../shared/authSeam';
import { mockEdgeFunctions } from '../../../shared/interceptEdge';

const REFUND_ROW = {
  id: 'txn-refund-001',
  bookingId: 'booking-refund-001',
  parkingId: 'parking-e2e-001',
  parkingName: 'Slot 12A',
  organizationId: 'org-e2e-001',
  organizationName: 'Sample Stays PH',
  guestName: 'Jamie Park',
  checkInDate: '2027-08-25',
  checkOutDate: '2027-08-27',
  nights: 2,
  guestChargeTotal: 800,
  hostGrossTotal: 700,
  commissionPct: 0.1,
  bookingChannel: 'standard',
  hostNetTotal: 630,
  paymentFeeAmount: 25,
  platformNetTotal: 145,
  status: 'refund_review',
  paidAt: '2026-11-01T00:00:00.000Z',
  disbursedAt: null,
  disbursementReference: null,
  disbursementMethod: 'manual',
  clawbackAmount: null,
  clawbackReason: null,
  clawbackAt: null,
  refundReviewAt: '2026-11-02T00:00:00.000Z',
  refundedAt: null,
  refundAmount: null,
  refundReference: null,
  refundReason: 'Host cancelled after payment',
  failureReason: null,
};

test.describe('@ci super-admin parking payouts', () => {
  test('shows refund review rows and opens the refund form', async ({ page }) => {
    await seedSupabaseAuthSession(page, 'host');
    await mockEdgeFunctions(page, [
      {
        name: 'list-organizations',
        body: { success: true, data: { organizations: [], isSuperAdmin: true } },
      },
      {
        name: 'platform-parking-settings',
        body: {
          success: true,
          data: {
            settings: {
              commissionPct: 0.1,
              directCommissionPct: 0.05,
              guestRateWeekday: 400,
              guestRateWeekend: 400,
              paymentFeePct: 0.03125,
              paymentFeeFixed: 15,
              supportEscalationPhone: null,
            },
          },
        },
      },
      {
        name: 'parking-payouts',
        handler: async (route) => {
          const status = new URL(route.request().url()).searchParams.get('status') ?? 'paid';
          const transactions = status === 'refund_review' || status === 'all' ? [REFUND_ROW] : [];
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: { transactions } }),
          });
        },
      },
    ]);

    await page.goto('/admin/parking/payouts');
    await expect(page.getByRole('heading', { name: 'Parking payouts' })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('button', { name: 'Refund review' }).click();
    await expect(page.getByText('Jamie Park').first()).toBeVisible();
    await expect(page.getByText('Refund review').first()).toBeVisible();
    await page.getByRole('button', { name: 'Record refund' }).click();
    await expect(page.getByRole('heading', { name: 'Record a guest refund' })).toBeVisible();
  });
});
