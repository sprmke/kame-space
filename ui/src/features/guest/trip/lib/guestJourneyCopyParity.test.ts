import { describe, expect, it } from 'vitest';

import {
  guestJourneyReviewExpectation,
  guestJourneyStatusWord,
  MIN_RESPONSE_SAMPLES,
} from '@/features/guest/trip/lib/guestJourneyCopy';
import { guestTripStatusLabel } from '@/features/guest/trip/lib/guestTripPhase';

import {
  guestJourneyReviewExpectation as edgeReviewExpectation,
  guestJourneyStatusWord as edgeStatusWord,
  MIN_RESPONSE_SAMPLES as EDGE_MIN_RESPONSE_SAMPLES,
} from '../../../../../../supabase/functions/_shared/guestJourneyCopy.ts';

/**
 * One vocabulary across the trip page, the account list, the emails and the host dashboard
 * (plan §3.3 and §11). The UI module mirrors the edge module, so this asserts the two
 * agree and that the trip page pill uses the same words.
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
  it('uses the plan words for every booking status', () => {
    expect(guestJourneyStatusWord('PENDING_REVIEW')).toBe('Request sent');
    expect(guestJourneyStatusWord('PENDING_DOCUMENTS')).toBe('Confirmed');
    expect(guestJourneyStatusWord('PENDING_GAF')).toBe('Confirmed');
    expect(guestJourneyStatusWord('READY_FOR_CHECKIN')).toBe('Ready for check-in');
    expect(guestJourneyStatusWord('READY_FOR_CHECKOUT')).toBe('Checked out');
    expect(guestJourneyStatusWord('PENDING_SD_REFUND')).toBe('Deposit refund');
    expect(guestJourneyStatusWord('COMPLETED')).toBe('Completed');
    expect(guestJourneyStatusWord('CANCELLED')).toBe('Cancelled');
  });

  it('names an expired request instead of calling it a cancellation', () => {
    expect(guestJourneyStatusWord('CANCELLED', 'request_expired')).toBe('Request expired');
    expect(guestJourneyStatusWord('CANCELLED', 'change_of_plans')).toBe('Cancelled');
    expect(guestJourneyStatusWord('CANCELLED', null)).toBe('Cancelled');
    // The reason never changes a live booking's word.
    expect(guestJourneyStatusWord('READY_FOR_CHECKIN', 'request_expired')).toBe(
      'Ready for check-in'
    );
  });

  it('matches the edge module for the expiry reason', () => {
    for (const reason of ['request_expired', 'change_of_plans', null, undefined, '']) {
      expect(guestJourneyStatusWord('CANCELLED', reason)).toBe(
        edgeStatusWord('CANCELLED', reason)
      );
    }
  });

  it('never claims a pending review is confirmed, approved or booked', () => {
    expect(guestJourneyStatusWord('PENDING_REVIEW')).not.toMatch(/confirmed|approved|booked/i);
  });

  it('never says approved as a status word', () => {
    for (const status of STATUSES) {
      expect(guestJourneyStatusWord(status)).not.toMatch(/approved/i);
    }
  });

  it('falls back to the request word for an unknown status', () => {
    expect(guestJourneyStatusWord('')).toBe('Request sent');
    expect(guestJourneyStatusWord('SOMETHING_NEW')).toBe('Request sent');
  });

  it('matches the edge module for every status', () => {
    for (const status of STATUSES) {
      expect(guestJourneyStatusWord(status)).toBe(edgeStatusWord(status));
    }
  });

  it('matches the edge module for the review expectation', () => {
    const cases = [null, 0, 1, 5, 23, 24, 50, -3, Number.NaN];
    for (const hours of cases) {
      expect(guestJourneyReviewExpectation(hours)).toBe(edgeReviewExpectation(hours));
    }
  });

  it('only quotes a number once the sample floor is met', () => {
    expect(MIN_RESPONSE_SAMPLES).toBe(EDGE_MIN_RESPONSE_SAMPLES);
    expect(guestJourneyReviewExpectation(null)).toBe('Most hosts reply within a day');
    expect(guestJourneyReviewExpectation(4)).toBe('Hosts usually reply within 4 hours');
    expect(guestJourneyReviewExpectation(30)).toBe('Hosts usually reply within 1 day');
  });

  it('is the same vocabulary the trip page pill shows', () => {
    for (const status of STATUSES) {
      expect(guestTripStatusLabel(status)).toBe(guestJourneyStatusWord(status));
    }
  });
});
