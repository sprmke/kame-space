import { describe, expect, it } from 'vitest';

import {
  guestJourneyNextStep,
  guestJourneyReviewExpectation,
  guestJourneyStatusTone,
  guestJourneyStatusWord,
  guestJourneySummary,
} from '@/features/guest/trip/lib/guestJourneyCopy';

import {
  guestJourneyNextStep as edgeNextStep,
  guestJourneyReviewExpectation as edgeReviewExpectation,
  guestJourneyStatusTone as edgeStatusTone,
  guestJourneyStatusWord as edgeStatusWord,
  guestJourneySummary as edgeSummary,
} from '../../../../../../supabase/functions/_shared/guestJourneyCopy.ts';

import { guestTripStatusLabel } from '@/features/guest/trip/lib/guestTripPhase';

/**
 * One vocabulary across UI, emails, chat card and host dashboard (plan §11). The UI module
 * re-exports the edge module, so this asserts the shipped status words stay in step with the
 * trip page pill and with the plan's §3.3 table.
 */
const STATUSES = [
  'PENDING_REVIEW',
  'PENDING_DOCUMENTS',
  'PENDING_GAF',
  'PENDING_PARKING_REQUEST',
  'PENDING_PET_REQUEST',
  'READY_FOR_CHECKIN',
  'READY_FOR_CHECKOUT',
  'PENDING_SD_REFUND',
  'COMPLETED',
  'CANCELLED',
];

describe('guest journey vocabulary', () => {
  it('uses the plan vocabulary for every status', () => {
    expect(guestJourneyStatusWord('PENDING_REVIEW')).toBe('Request sent');
    expect(guestJourneyStatusWord('PENDING_DOCUMENTS')).toBe('Confirmed');
    expect(guestJourneyStatusWord('PENDING_GAF')).toBe('Confirmed');
    expect(guestJourneyStatusWord('PENDING_PARKING_REQUEST')).toBe('Confirmed');
    expect(guestJourneyStatusWord('PENDING_PET_REQUEST')).toBe('Confirmed');
    expect(guestJourneyStatusWord('READY_FOR_CHECKIN')).toBe('Ready for check-in');
    expect(guestJourneyStatusWord('READY_FOR_CHECKOUT')).toBe('Checked out');
    expect(guestJourneyStatusWord('PENDING_SD_REFUND')).toBe('Deposit refund');
    expect(guestJourneyStatusWord('COMPLETED')).toBe('Completed');
    expect(guestJourneyStatusWord('CANCELLED')).toBe('Cancelled');
  });

  it('never says confirmed or approved while the booking is still under review', () => {
    const word = guestJourneyStatusWord('PENDING_REVIEW');
    expect(word).not.toMatch(/confirmed|approved|booked/i);
  });

  it('never says approved as a status word', () => {
    for (const status of STATUSES) {
      expect(guestJourneyStatusWord(status)).not.toMatch(/approved/i);
    }
  });

  it('matches the edge module for every status', () => {
    for (const status of STATUSES) {
      expect(guestJourneyStatusWord(status)).toBe(edgeStatusWord(status));
      expect(guestJourneyStatusTone(status)).toBe(edgeStatusTone(status));
    }
  });

  it('matches the edge module for every next step', () => {
    const input = {
      status: 'READY_FOR_CHECKIN',
      checkInDateLabel: 'Sat, Oct 10',
      checkInTimeLabel: '2:00 PM',
      checkOutDateLabel: 'Sun, Oct 12',
      checkOutTimeLabel: '11:00 AM',
      amountDueLabel: '₱3,200',
      hasBalanceDue: true,
      documentsPending: false,
    };
    for (const status of STATUSES) {
      expect(guestJourneyNextStep({ ...input, status })).toEqual(
        edgeNextStep({ ...input, status })
      );
      expect(guestJourneySummary({ ...input, status })).toEqual(
        edgeSummary({ ...input, status })
      );
    }
  });

  it('matches the edge module for the review expectation', () => {
    for (const hours of [null, 0, 1, 5, 23, 24, 50, -3]) {
      expect(guestJourneyReviewExpectation(hours)).toBe(edgeReviewExpectation(hours));
    }
  });

  it('falls back to a generic review expectation without a real median', () => {
    expect(guestJourneyReviewExpectation(null)).toBe('Most hosts reply within a day');
    expect(guestJourneyReviewExpectation(Number.NaN)).toBe('Most hosts reply within a day');
    expect(guestJourneyReviewExpectation(4)).toBe('Hosts usually reply within 4 hours');
    expect(guestJourneyReviewExpectation(30)).toBe('Hosts usually reply within 1 day');
  });
});

describe('trip page status label', () => {
  it('agrees with the shared vocabulary', () => {
    const labels: Record<string, string> = {
      PENDING_REVIEW: 'Request sent',
      PENDING_DOCUMENTS: 'Confirmed',
      PENDING_GAF: 'Confirmed',
      READY_FOR_CHECKIN: 'Ready for check-in',
      READY_FOR_CHECKOUT: 'Checked out',
      PENDING_SD_REFUND: 'Deposit refund',
      COMPLETED: 'Completed',
      CANCELLED: 'Cancelled',
    };
    for (const [status, expected] of Object.entries(labels)) {
      expect(guestTripStatusLabel(status)).toBe(expected);
    }
  });
});
