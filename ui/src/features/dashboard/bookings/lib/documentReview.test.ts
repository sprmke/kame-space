import { describe, expect, it } from 'vitest';

import type { DocumentRequirementCompletion } from '@/features/dashboard/bookings/lib/documentRequirements';
import {
  DOC_REJECTION_REASONS,
  DOC_REJECTION_REASON_LABELS,
  docRejectionReasonLabel,
  formatDocReviewDate,
  pendingDocReviewState,
} from '@/features/dashboard/bookings/lib/documentReview';

function completion(
  overrides: Partial<DocumentRequirementCompletion> = {}
): DocumentRequirementCompletion {
  return { completedAt: null, approvedPdfUrl: null, ...overrides };
}

describe('pendingDocReviewState', () => {
  it('lets a file on record win over an earlier rejection', () => {
    expect(pendingDocReviewState(completion({ rejectedAt: '2026-11-01T00:00:00Z' }), true)).toBe('received');
  });

  it('reports a rejection when no replacement was uploaded', () => {
    expect(pendingDocReviewState(completion({ rejectedAt: '2026-11-01T00:00:00Z' }), false)).toBe('rejected');
  });

  it('is awaiting while nothing has happened', () => {
    expect(pendingDocReviewState(undefined, false)).toBe('awaiting');
    expect(pendingDocReviewState(completion(), false)).toBe('awaiting');
  });
});

describe('rejection reasons', () => {
  it('lists every reason with a label', () => {
    expect(DOC_REJECTION_REASONS.sort()).toEqual(Object.keys(DOC_REJECTION_REASON_LABELS).sort());

    for (const reason of DOC_REJECTION_REASONS) {
      expect(DOC_REJECTION_REASON_LABELS[reason].trim()).not.toBe('');
    }
  });

  it('labels a known reason and drops an unknown one', () => {
    expect(docRejectionReasonLabel('expired')).toBe('Expired');
    expect(docRejectionReasonLabel('made_up')).toBeNull();
    expect(docRejectionReasonLabel(null)).toBeNull();
    expect(docRejectionReasonLabel(undefined)).toBeNull();
  });
});

describe('formatDocReviewDate', () => {
  const now = new Date('2026-06-01T00:00:00Z');

  it('shows a short Manila date without the year in the current year', () => {
    expect(formatDocReviewDate('2026-11-08T02:00:00Z', now)).toBe('Nov 8');
  });

  it('adds the year for a date in another year', () => {
    expect(formatDocReviewDate('2025-11-08T02:00:00Z', now)).toContain('2025');
  });

  it('returns null for blank or unparseable input', () => {
    expect(formatDocReviewDate(null, now)).toBeNull();
    expect(formatDocReviewDate(undefined, now)).toBeNull();
    expect(formatDocReviewDate('not-a-date', now)).toBeNull();
  });
});
