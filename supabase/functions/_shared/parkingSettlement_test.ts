import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import { computeParkingSettlement } from "./parkingSettlement.ts";

const BASE = {
  guestChargeTotal: 400,
  hostGrossTotal: 300,
  commissionPct: 0.1,
  paymentFeePct: 0.03125,
  paymentFeeFixed: 15,
};

Deno.test("standard booking: host keeps 90%, processor takes its cut, platform keeps the rest", () => {
  const result = computeParkingSettlement(BASE);
  assertEquals(result.commissionAmount, 30);
  assertEquals(result.hostNetTotal, 270);
  assertEquals(result.paymentFeeAmount, 27.5);
  assertEquals(result.platformNetTotal, 102.5);
});

Deno.test("direct-link booking: the lower commission raises the host payout", () => {
  const result = computeParkingSettlement({ ...BASE, commissionPct: 0.05 });
  assertEquals(result.commissionAmount, 15);
  assertEquals(result.hostNetTotal, 285);
  assertEquals(result.platformNetTotal, 87.5);
});

Deno.test("offline booking: no processor fee", () => {
  const result = computeParkingSettlement({ ...BASE, chargePaymentFee: false });
  assertEquals(result.paymentFeeAmount, 0);
  assertEquals(result.platformNetTotal, 130);
});

Deno.test("processor fee never exceeds the guest charge", () => {
  const result = computeParkingSettlement({
    ...BASE,
    guestChargeTotal: 10,
    hostGrossTotal: 0,
    paymentFeePct: 1,
    paymentFeeFixed: 15,
  });
  assertEquals(result.paymentFeeAmount, 10);
  assertEquals(result.platformNetTotal, 0);
});

Deno.test("commission is clamped to 0..1 and host net never goes below zero", () => {
  const result = computeParkingSettlement({ ...BASE, commissionPct: 1.5 });
  assertEquals(result.hostNetTotal, 0);
  assertEquals(result.commissionAmount, 300);
});

Deno.test("platform net can be negative when a host is priced at the guest rate and a fee applies", () => {
  const result = computeParkingSettlement({
    guestChargeTotal: 400,
    hostGrossTotal: 400,
    commissionPct: 0,
    paymentFeePct: 0.03125,
    paymentFeeFixed: 15,
  });
  assertEquals(result.hostNetTotal, 400);
  assertEquals(result.platformNetTotal, -27.5);
});
