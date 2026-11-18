import { describe, expect, it } from 'vitest';

import { DEFAULT_DOCUMENT_REQUIREMENTS } from '@/features/dashboard/bookings/lib/documentRequirements';
import {
  bookingPipeline,
  canTransition,
  initialViewedWorkflowStep,
  isLiveWorkflowView,
  isPendingDocumentsFamilyStatus,
  nestedDocKeyFromLegacyOrKanbanStatus,
  nextStep,
  workflowContentForView,
} from '@/features/dashboard/bookings/lib/workflow';

describe('workflow client mirror @smoke', () => {
  it('canTransition matches server happy path', () => {
    expect(canTransition('PENDING_REVIEW', 'PENDING_DOCUMENTS', { manual: false })).toBe(true);
    expect(canTransition('PENDING_DOCUMENTS', 'READY_FOR_CHECKIN', { manual: false })).toBe(true);
  });

  it('manual backward only when manual', () => {
    expect(canTransition('PENDING_DOCUMENTS', 'PENDING_REVIEW', { manual: false })).toBe(false);
    expect(canTransition('PENDING_DOCUMENTS', 'PENDING_REVIEW', { manual: true })).toBe(true);
  });

  it('bookingPipeline skips SD refund when deposit is zero', () => {
    const pipeline = bookingPipeline({ security_deposit: 0 }, 'PENDING_REVIEW');
    expect(pipeline).not.toContain('PENDING_SD_REFUND');
  });

  it('bookingPipeline D2 skips pending documents when requirements empty', () => {
    const pipeline = bookingPipeline({}, 'PENDING_REVIEW', []);
    expect(pipeline).not.toContain('PENDING_DOCUMENTS');
    expect(pipeline).toContain('READY_FOR_CHECKIN');
  });

  it('nextStep advances along pipeline', () => {
    expect(nextStep({ security_deposit: 1000 }, 'PENDING_REVIEW')).toBe('PENDING_DOCUMENTS');
    expect(nextStep({ security_deposit: 0 }, 'READY_FOR_CHECKOUT')).toBe('COMPLETED');
  });
});

describe('legacy / Kanban nested doc keys', () => {
  const booking = { need_parking: false, has_pets: false };

  it('maps PENDING_GAF column/status to requirement id gaf', () => {
    expect(nestedDocKeyFromLegacyOrKanbanStatus('PENDING_GAF')).toBe('gaf');
    expect(nestedDocKeyFromLegacyOrKanbanStatus('PENDING_PET_REQUEST')).toBe('pet');
    expect(nestedDocKeyFromLegacyOrKanbanStatus('PENDING_PARKING_REQUEST')).toBe(
      'PENDING_PARKING_REQUEST'
    );
  });

  it('opens legacy PENDING_GAF on nested gaf content (not empty pipeline)', () => {
    const viewed = initialViewedWorkflowStep('PENDING_GAF', booking, DEFAULT_DOCUMENT_REQUIREMENTS);
    expect(viewed).toEqual({ kind: 'pending-doc-sub', sub: 'gaf' });
    expect(workflowContentForView(viewed, booking, DEFAULT_DOCUMENT_REQUIREMENTS)).toBe(
      'doc_sub_status'
    );
    expect(isLiveWorkflowView(viewed, 'PENDING_GAF', booking)).toBe(true);
    expect(isPendingDocumentsFamilyStatus('PENDING_GAF')).toBe(true);
  });

  it('resolves pending-doc-sub still keyed as PENDING_GAF', () => {
    expect(
      workflowContentForView(
        { kind: 'pending-doc-sub', sub: 'PENDING_GAF' },
        booking,
        DEFAULT_DOCUMENT_REQUIREMENTS
      )
    ).toBe('doc_sub_status');
  });
});
