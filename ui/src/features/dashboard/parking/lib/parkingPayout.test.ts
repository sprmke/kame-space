import { describe, expect, it } from 'vitest';

import {
  computeParkingBookingBreakdown,
  computeParkingDirectLinkNet,
  computeParkingNightlyPayout,
} from './parkingPayout';

const SETTINGS = {
  guestFeePct: 0.05,
  guestFeeFixed: 15,
  paymentFeePct: 0.03125,
  paymentFeeFixed: 15,
};

describe('parking payout display math', () => {
  it('splits a nightly rate into the platform fee and what the host receives', () => {
    expect(computeParkingNightlyPayout({ hostRate: 300, commissionPct: 0.1 })).toEqual({
      hostGross: 300,
      commissionAmount: 30,
      hostNet: 270,
    });
  });

  it('uses the direct-link fee for direct-link net', () => {
    expect(computeParkingDirectLinkNet(300, 0.05)).toBe(285);
    expect(computeParkingDirectLinkNet(300, 0.1)).toBe(270);
  });

  it('never returns a negative host net', () => {
    expect(computeParkingNightlyPayout({ hostRate: 300, commissionPct: 2 })).toMatchObject({
      hostNet: 0,
    });
  });
});

describe('parking booking breakdown (guest fee on top of the host rate)', () => {
  it('matches the server for a 1 night, 300 booking', () => {
    expect(
      computeParkingBookingBreakdown({ hostGrossTotal: 300, commissionPct: 0.1, ...SETTINGS })
    ).toEqual({
      hostGross: 300,
      guestFee: 30,
      guestCharge: 330,
      commissionAmount: 30,
      hostNet: 270,
      paymentFeeAmount: 25.31,
      platformNetTotal: 34.69,
    });
  });

  it('keeps the platform positive at the 100 minimum on both channels', () => {
    const standard = computeParkingBookingBreakdown({
      hostGrossTotal: 100,
      commissionPct: 0.1,
      ...SETTINGS,
    });
    const direct = computeParkingBookingBreakdown({
      hostGrossTotal: 100,
      commissionPct: 0.05,
      ...SETTINGS,
    });
    expect(standard.platformNetTotal).toBe(11.25);
    expect(direct.platformNetTotal).toBe(6.25);
  });

  it('charges no fee on a zero gross', () => {
    expect(
      computeParkingBookingBreakdown({ hostGrossTotal: 0, commissionPct: 0.1, ...SETTINGS })
    ).toMatchObject({ guestFee: 0, guestCharge: 0 });
  });
});
