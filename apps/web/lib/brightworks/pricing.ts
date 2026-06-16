/**
 * Pricing utilities for Brightworks LED lighting products.
 * Handles wholesale/retail tier pricing and seasonal demand multipliers
 * used by the demand-forecasting model to estimate revenue at risk.
 */

export type PricingTierName = 'retail' | 'wholesale' | 'distributor';

export interface PricingTier {
  tier: PricingTierName;
  /** Fraction of retail list price. */
  multiplier: number;
  minQuantity: number;
}

export const PRICING_TIERS: PricingTier[] = [
  { tier: 'retail',      multiplier: 1.00, minQuantity: 1  },
  { tier: 'wholesale',   multiplier: 0.65, minQuantity: 10 },
  { tier: 'distributor', multiplier: 0.55, minQuantity: 50 },
];

/**
 * Returns the seasonal demand multiplier for a given calendar month (1–12).
 * Peak season for commercial lighting: Aug–Oct (pre-holiday installer buy-in).
 */
export function getSeasonalMultiplier(month: number): number {
  if (month >= 8 && month <= 10) return 1.15;  // peak
  if ((month >= 5 && month <= 7) || month === 11) return 1.05;  // shoulder
  return 0.92;  // off-peak
}

/**
 * Adjusts the base retail price for the current selling season.
 */
export function calculateRetailPrice(baseRetailPrice: number, month: number): number {
  const adjusted = baseRetailPrice * getSeasonalMultiplier(month);
  return Math.round(adjusted * 100) / 100;
}

/**
 * Resolves the effective wholesale price given order quantity and month.
 * Quantities ≥50 qualify for the distributor tier.
 */
export function calculateWholesalePrice(
  baseWholesalePrice: number,
  quantity: number,
  month: number
): number {
  const seasonal = getSeasonalMultiplier(month);
  let tierAdjust = 1.0;
  if (quantity >= 50) {
    // Distributor multiplier relative to wholesale base
    tierAdjust = PRICING_TIERS[2].multiplier / PRICING_TIERS[1].multiplier;
  }
  return Math.round(baseWholesalePrice * tierAdjust * seasonal * 100) / 100;
}

/**
 * Gross margin as a percentage (0–100).
 */
export function calculateMargin(sellingPrice: number, unitCost: number): number {
  if (sellingPrice <= 0) return 0;
  return Math.round(((sellingPrice - unitCost) / sellingPrice) * 10_000) / 100;
}

/**
 * Estimates the revenue lost if `stockoutUnits` cannot be sold due to
 * insufficient inventory during the peak season window.
 */
export function calculateSeasonalRevenueAtRisk(
  unitCost: number,
  retailPrice: number,
  stockoutUnits: number,
  month: number
): number {
  const effectivePrice = calculateRetailPrice(retailPrice, month);
  const margin = calculateMargin(effectivePrice, unitCost);
  // Revenue at risk is margin dollars on the unsatisfied demand
  return Math.round(stockoutUnits * effectivePrice * (margin / 100) * 100) / 100;
}

/**
 * Returns the resolved price and gross margin for a given buyer tier,
 * quantity, and selling month.
 */
export function getEffectivePrice(
  unitCost: number,
  wholesalePrice: number,
  retailPrice: number,
  tier: PricingTierName,
  quantity: number,
  month: number
): { price: number; margin: number } {
  const seasonal = getSeasonalMultiplier(month);
  let price: number;

  if (tier === 'retail') {
    price = Math.round(retailPrice * seasonal * 100) / 100;
  } else if (tier === 'wholesale') {
    price = Math.round(wholesalePrice * seasonal * 100) / 100;
  } else {
    const distTier = PRICING_TIERS.find(t => t.tier === 'distributor')!;
    price = Math.round(retailPrice * distTier.multiplier * seasonal * 100) / 100;
    void quantity; // quantity already gates tier selection upstream
  }

  return { price, margin: calculateMargin(price, unitCost) };
}
