/**
 * Subscription list price + discount math — keep in sync with ui/.../planPricing.ts.
 */

export function normalizePlanDiscountPercent(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.floor(value)));
}

/** Whole pesos only; always rounds down. */
export function discountedPlanPricePhp(
  listPricePhp: number | null | undefined,
  discountPercent: number | null | undefined
): number {
  const list = Math.max(0, Math.floor(Number(listPricePhp ?? 0)));
  if (list <= 0) return 0;

  const discount = normalizePlanDiscountPercent(discountPercent);
  if (discount <= 0) return list;
  if (discount >= 100) return 0;

  return Math.floor((list * (100 - discount)) / 100);
}

export function resolvePlanCheckoutPricePhp(input: {
  listPricePhp: number | null | undefined;
  discountPercent: number | null | undefined;
  isDefault?: boolean;
}): number {
  if (input.isDefault) return 0;
  return discountedPlanPricePhp(input.listPricePhp, input.discountPercent);
}

export type VolumeDiscountTier = { minProperties: number; discountPercent: number };

/** Default per-property floor at {@link DEFAULT_VOLUME_RAMP_AT_COUNT} (used when DB value is null). */
export const DEFAULT_VOLUME_RAMP_FLOOR_PHP = 500;

/** Default property count where the linear ramp reaches the floor. */
export const DEFAULT_VOLUME_RAMP_AT_COUNT = 10;

/** @deprecated Use {@link DEFAULT_VOLUME_RAMP_FLOOR_PHP} */
export const ORG_VOLUME_RAMP_FLOOR_PHP = DEFAULT_VOLUME_RAMP_FLOOR_PHP;

/** @deprecated Use {@link DEFAULT_VOLUME_RAMP_AT_COUNT} */
export const ORG_VOLUME_RAMP_AT_COUNT = DEFAULT_VOLUME_RAMP_AT_COUNT;

/** Generic default volume curve for new paid tiers (Pro-shaped). Super-admin can override per plan. */
export const DEFAULT_VOLUME_DISCOUNT_TIERS: VolumeDiscountTier[] = [
  { minProperties: 10, discountPercent: 37 },
  { minProperties: 20, discountPercent: 45 },
  { minProperties: 50, discountPercent: 62 },
  { minProperties: 100, discountPercent: 78 },
  { minProperties: 200, discountPercent: 85 },
  { minProperties: 300, discountPercent: 88 },
];

export type OrgVolumePricingOptions = {
  volumeRampFloorPhp?: number | null;
  volumeRampAtCount?: number | null;
};

export function normalizeVolumeRampFloorPhp(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return DEFAULT_VOLUME_RAMP_FLOOR_PHP;
  return Math.max(0, Math.floor(value));
}

export function normalizeVolumeRampAtCount(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return DEFAULT_VOLUME_RAMP_AT_COUNT;
  return Math.max(1, Math.floor(value));
}

/** Parses pricing_plans.volume_discount_tiers JSONB: drops malformed/sub-1 entries, clamps
 * discountPercent, sorts ascending by minProperties, dedupes by minProperties (last wins). */
export function normalizeVolumeDiscountTiers(value: unknown): VolumeDiscountTier[] {
  if (!Array.isArray(value)) return [];

  const byMinProperties = new Map<number, VolumeDiscountTier>();
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const entry = raw as Record<string, unknown>;
    const minProperties = Math.floor(Number(entry.minProperties));
    if (!Number.isFinite(minProperties) || minProperties < 1) continue;
    const discountPercent = normalizePlanDiscountPercent(entry.discountPercent as number);
    byMinProperties.set(minProperties, { minProperties, discountPercent });
  }

  return Array.from(byMinProperties.values()).sort((a, b) => a.minProperties - b.minProperties);
}

/** Highest-minProperties tier whose minProperties <= propertyCount; 0 if none/empty. */
export function resolveVolumeDiscountPercent(
  tiers: VolumeDiscountTier[],
  propertyCount: number
): number {
  let percent = 0;
  for (const tier of tiers) {
    if (tier.minProperties <= propertyCount) {
      percent = tier.discountPercent;
    } else {
      break;
    }
  }
  return percent;
}

/**
 * Linear per-property ramp for 1…{@link ORG_VOLUME_RAMP_AT_COUNT} listings: full promo rate at
 * 1 property, stepping down to {@link ORG_VOLUME_RAMP_FLOOR_PHP}/property at 10. Skipped when
 * the promo rate is already at or below the floor (e.g. Starter).
 */
export function resolveRampEffectivePerPropertyPhp(
  pricePerPropertyPhp: number,
  propertyCount: number,
  floorPerPropertyPhp: number = DEFAULT_VOLUME_RAMP_FLOOR_PHP,
  rampAtCount: number = DEFAULT_VOLUME_RAMP_AT_COUNT
): number | null {
  const rate = Math.max(0, Math.floor(pricePerPropertyPhp));
  const count = Math.max(0, Math.floor(propertyCount));
  const floor = Math.max(0, Math.floor(floorPerPropertyPhp));
  const rampAt = Math.max(1, Math.floor(rampAtCount));

  if (rate <= 0 || count <= 0 || rate <= floor) return null;
  if (count > rampAt) return null;
  if (rampAt <= 1) return floor;

  return Math.floor(rate - ((rate - floor) * (count - 1)) / (rampAt - 1));
}

/**
 * Total org subscription price: (per-property rate x property count), with the volume
 * discount for that count applied on top. `pricePerPropertyPhp` is expected to already be
 * promo-discounted (pass it through discountedPlanPricePhp first).
 *
 * Counts 1…10 (when base rate > ₱500): linear ramp — per-property rate steps down from the
 * promo rate to ₱500 at 10 properties. Counts above 10: `volume_discount_tiers` from the
 * plan row (10+, 20+, 50+, 100+, …) applied to the extended total via
 * {@link discountedPlanPricePhp}'s floor-to-whole-peso rule.
 */
export function computeOrgSubscriptionTotalPhp(
  pricePerPropertyPhp: number | null | undefined,
  volumeDiscountTiers: unknown,
  propertyCount: number,
  volumePricing?: OrgVolumePricingOptions
): number {
  const rate = Math.max(0, Math.floor(Number(pricePerPropertyPhp ?? 0)));
  const count = Math.max(0, Math.floor(propertyCount));
  if (rate <= 0 || count <= 0) return 0;

  const floor = normalizeVolumeRampFloorPhp(volumePricing?.volumeRampFloorPhp);
  const rampAt = normalizeVolumeRampAtCount(volumePricing?.volumeRampAtCount);
  const rampRate = resolveRampEffectivePerPropertyPhp(rate, count, floor, rampAt);
  if (rampRate != null) return rampRate * count;

  const extended = rate * count;
  const volumeDiscountPercent = resolveVolumeDiscountPercent(
    normalizeVolumeDiscountTiers(volumeDiscountTiers),
    count
  );
  return discountedPlanPricePhp(extended, volumeDiscountPercent);
}

export type PricedPlanRow = {
  price_php: number | null;
  discount_percent: number | null;
  volume_discount_tiers: unknown;
  volume_ramp_floor_php: number | null;
  volume_ramp_at_count: number | null;
};

/** The pricing a subscription bought. Stored on org_subscriptions.pricing_snapshot. */
export type PlanPricingParams = {
  pricePhp: number;
  discountPercent: number;
  volumeDiscountTiers: VolumeDiscountTier[];
  volumeRampFloorPhp: number;
  volumeRampAtCount: number;
};

export function pricingParamsFromPlan(plan: PricedPlanRow): PlanPricingParams {
  return {
    pricePhp: Math.max(0, Math.floor(Number(plan.price_php ?? 0))),
    discountPercent: normalizePlanDiscountPercent(plan.discount_percent),
    volumeDiscountTiers: normalizeVolumeDiscountTiers(plan.volume_discount_tiers),
    volumeRampFloorPhp: normalizeVolumeRampFloorPhp(plan.volume_ramp_floor_php),
    volumeRampAtCount: normalizeVolumeRampAtCount(plan.volume_ramp_at_count),
  };
}

/** Reads a stored snapshot defensively; null when missing or malformed. */
export function parsePricingSnapshot(value: unknown): PlanPricingParams | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const price = Number(raw.pricePhp);
  if (!Number.isFinite(price) || price < 0) return null;
  return {
    pricePhp: Math.floor(price),
    discountPercent: normalizePlanDiscountPercent(Number(raw.discountPercent)),
    volumeDiscountTiers: normalizeVolumeDiscountTiers(raw.volumeDiscountTiers),
    volumeRampFloorPhp: normalizeVolumeRampFloorPhp(Number(raw.volumeRampFloorPhp)),
    volumeRampAtCount: normalizeVolumeRampAtCount(Number(raw.volumeRampAtCount)),
  };
}

export function computeTotalFromPricingParams(
  params: PlanPricingParams,
  propertyCount: number
): number {
  return computeOrgSubscriptionTotalPhp(
    discountedPlanPricePhp(params.pricePhp, params.discountPercent),
    params.volumeDiscountTiers,
    propertyCount,
    {
      volumeRampFloorPhp: params.volumeRampFloorPhp,
      volumeRampAtCount: params.volumeRampAtCount,
    }
  );
}

/** Monthly total for a plan at a property count: promo rate, ramp, volume discount. */
export function computePlanTotalPhp(plan: PricedPlanRow, propertyCount: number): number {
  return computeTotalFromPricingParams(pricingParamsFromPlan(plan), propertyCount);
}

export function pricingParamsEqual(a: PlanPricingParams, b: PlanPricingParams): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
