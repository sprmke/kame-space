/** Pure money checks for parking payout actions. */
export function parkingRefundAmountError(amount: number, guestCharge: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return 'amount must be a positive number';
  if (amount > guestCharge + 0.005) return 'amount cannot exceed the guest charge';
  return null;
}
