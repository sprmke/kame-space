import { describe, expect, it } from 'vitest';

import {
  computeParkingDirectLinkNet,
  computeParkingNightlyPayout,
  computeParkingPlatformSettlement,
} from './parkingPayout';

describe('parking payout display math', () => {
  it('splits a standard booking into guest pays, fee and host net', () => {
    expect(
      computeParkingNightlyPayout({ hostRate: 300, guestRate: 400, commissionPct: 0.1 })
    ).toEqual({
      guestPays: 400,
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
    expect(
      computeParkingNightlyPayout({ hostRate: 300, guestRate: 400, commissionPct: 2 })
    ).toMatchObject({ hostNet: 0 });
  });

  it('computes the platform margin after the host payout and the processor fee', () => {
    expect(
      computeParkingPlatformSettlement({
        guestChargeTotal: 400,
        hostGrossTotal: 300,
        commissionPct: 0.1,
        paymentFeePct: 0.03125,
        paymentFeeFixed: 15,
      })
    ).toEqual({
      commissionAmount: 30,
      hostNet: 270,
      paymentFeeAmount: 27.5,
      platformNetTotal: 102.5,
    });
  });
});
