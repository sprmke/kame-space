import { expect, test, type Page } from '@playwright/test';

import {
  createHostVerificationState,
  installHostVerificationMocks,
  type IdentitySummary,
} from './shared/hostVerificationHarness';

const pendingIdentity: IdentitySummary = {
  id: 'ver-e2e-1',
  verdict: 'partially_verified',
  method: 'philsys_qr',
  document_type: 'philid',
  full_name: 'E2E H.',
  signature_valid: false,
  liveness_grade: 'clientside',
  face_match_verdict: 'likely_match',
  flags: [{ code: 'liveness_unavailable', severity: 'info' }],
  verified_at: '2026-11-07T00:00:00.000Z',
  expires_at: '2027-11-07T00:00:00.000Z',
  created_at: '2026-11-07T00:00:00.000Z',
};

async function openPendingReview(page: Page) {
  await page.goto('/admin/approvals');
  const row = page.locator('[aria-label="Review Test Host Org"]').first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.click();
  await expect(page.getByRole('dialog', { name: 'Test Host Org' })).toBeVisible({
    timeout: 20_000,
  });
}

test.describe('@ci super admin host verification review', () => {
  test('the queue shows the pre-screen before any document is opened', async ({ page }) => {
    const state = createHostVerificationState({ baseStatus: 'pending', identity: pendingIdentity });
    await installHostVerificationMocks(page, state, { asSuperAdmin: true });

    await openPendingReview(page);

    await expect(page.getByText('Identity check')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('PhilSys QR')).toBeVisible();
    await expect(page.getByText('Device check')).toBeVisible();
    await expect(page.getByText('No signature proof')).toBeVisible();
    await expect(page.getByText('likely_match')).toBeVisible();
    await expect(page.getByText(/Liveness check could not run/i)).toBeVisible();
  });

  test('approve resolves the queue row', async ({ page }) => {
    const state = createHostVerificationState({ baseStatus: 'pending', identity: pendingIdentity });
    await installHostVerificationMocks(page, state, { asSuperAdmin: true });

    await openPendingReview(page);

    const approveResponse = page.waitForResponse(
      (res) =>
        res.request().method() === 'POST' &&
        res.url().includes('/functions/v1/approve-org-verification') &&
        res.ok()
    );
    await page.getByRole('button', { name: 'Approve' }).click();
    await approveResponse;

    expect(state.calls.approve).toHaveLength(1);
    expect(state.baseStatus).toBe('approved');
    await expect(page.locator('[aria-label="Review Test Host Org"]')).toHaveCount(0, {
      timeout: 20_000,
    });
  });

  test('request changes sends the reason and the document list', async ({ page }) => {
    const state = createHostVerificationState({ baseStatus: 'pending', identity: pendingIdentity });
    await installHostVerificationMocks(page, state, { asSuperAdmin: true });

    await openPendingReview(page);

    await page.getByRole('button', { name: 'Request changes' }).click();
    await page.locator('#request-change-reason-unclear_documents').check();
    await page.locator('#request-change-doc-validId').check();

    const rejectResponse = page.waitForResponse(
      (res) =>
        res.request().method() === 'POST' &&
        res.url().includes('/functions/v1/reject-org-verification') &&
        res.ok()
    );
    await page.getByRole('button', { name: 'Request changes' }).click();
    await rejectResponse;

    expect(state.calls.reject).toHaveLength(1);
    expect(state.lastRejectBody).toMatchObject({
      tier: 'base',
      kind: 'changes',
      changesRequestedDocs: ['validId'],
    });
    expect(state.baseStatus).toBe('rejected');
    expect(state.baseRejectionKind).toBe('changes');
  });

  test('hard reject requires a preset reason and stores it', async ({ page }) => {
    const state = createHostVerificationState({ baseStatus: 'pending', identity: pendingIdentity });
    await installHostVerificationMocks(page, state, { asSuperAdmin: true });

    await openPendingReview(page);

    await page.getByRole('button', { name: 'Reject' }).click();
    // The confirm stays disabled until a reason is chosen.
    await expect(page.getByRole('button', { name: 'Confirm reject' })).toBeDisabled();
    await page.locator('#reject-reason-select').click();
    await page.getByRole('option', { name: 'Identity does not match the documents provided' }).click();

    const rejectResponse = page.waitForResponse(
      (res) =>
        res.request().method() === 'POST' &&
        res.url().includes('/functions/v1/reject-org-verification') &&
        res.ok()
    );
    await page.getByRole('button', { name: 'Confirm reject' }).click();
    await rejectResponse;

    expect(state.lastRejectBody).toMatchObject({ tier: 'base', kind: 'rejected' });
    expect(String(state.lastRejectBody?.reason ?? '')).toContain(
      'Identity does not match the documents provided'
    );
    expect(state.baseRejectionKind).toBe('rejected');
  });
});
