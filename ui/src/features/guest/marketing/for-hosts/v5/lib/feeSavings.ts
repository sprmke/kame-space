export interface FeeSavingsInput {
  /** Nightly rate in pesos. */
  rate: number;
  /** Nights booked in the month. */
  nights: number;
  /** Monthly plan price in pesos. */
  planPhp: number;
  /** Per-booking fee as a percent of the booking, e.g. 15.5. */
  feePercent: number;
}

export interface FeeSavings {
  /** What the per-booking fee adds up to for the month, in whole pesos. */
  fee: number;
  /** Fee minus the plan. Negative when the plan costs more at this volume. */
  keep: number;
  /** Nights whose fee adds up to the plan price. 0 for a free plan. */
  coverNights: number;
}

/** Compares a percentage fee on the month's bookings with a flat monthly plan. */
export function feeSavings({ rate, nights, planPhp, feePercent }: FeeSavingsInput): FeeSavings {
  const feePerNight = (rate * feePercent) / 100;
  const fee = Math.round(feePerNight * nights);
  const coverNights = planPhp > 0 && feePerNight > 0 ? Math.ceil(planPhp / feePerNight) : 0;
  return { fee, keep: fee - planPhp, coverNights };
}

export interface NightFeeComparisonInput {
  /** Nightly rate in pesos. */
  rate: number;
  /** Nights booked in the month. */
  nights: number;
  /** Monthly plan price in pesos. */
  planPhp: number;
  /** Per-booking fee as a percent of the booking, e.g. 15.5. */
  feePercent: number;
}

export interface NightFeeComparison {
  /** Fee on one night, in whole pesos. */
  feePerNight: number;
  /** What guests pay for the month's nights. */
  gross: number;
  /** Fee on the month's nights, in whole pesos. */
  fee: number;
  /** What the host gets after the fee. */
  feeNet: number;
  /** What the host gets after the plan. */
  planNet: number;
  /** `planNet - feeNet`. Negative when the plan costs more at this volume. */
  save: number;
  /** Nights whose fee adds up to the plan price. 0 for a free plan. */
  coverNights: number;
}

/** What a host gets in a month under a percentage fee vs a flat plan, counted in nights. */
export function nightFeeComparison({
  rate,
  nights,
  planPhp,
  feePercent,
}: NightFeeComparisonInput): NightFeeComparison {
  const exactFee = (rate * feePercent) / 100;
  const gross = rate * nights;
  const fee = Math.round(exactFee * nights);
  const feeNet = gross - fee;
  const planNet = gross - planPhp;
  const coverNights = planPhp > 0 && exactFee > 0 ? Math.ceil(planPhp / exactFee) : 0;
  return {
    feePerNight: Math.round(exactFee),
    gross,
    fee,
    feeNet,
    planNet,
    save: planNet - feeNet,
    coverNights,
  };
}
