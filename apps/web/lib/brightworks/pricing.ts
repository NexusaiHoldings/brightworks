/**
 * Pricing utilities for Brightworks SKUs.
 *
 * Handles margin calculation, seasonal price adjustments, and wholesale vs.
 * retail differentiation for the single-season physical goods catalogue.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SkuPricingInput {
  unit_cost: number;
  wholesale_price: number;
  retail_price: number;
  category: string;
}

export interface PricingResult {
  unit_cost: number;
  wholesale_price: number;
  retail_price: number;
  wholesale_margin_pct: number;
  retail_margin_pct: number;
  wholesale_markup_pct: number;
  retail_markup_pct: number;
  seasonal_adjusted_retail: number;
  seasonal_adjusted_wholesale: number;
  seasonal_multiplier: number;
}

export interface ReplenishmentCost {
  units: number;
  unit_cost: number;
  total_cost: number;
  total_wholesale_revenue: number;
  projected_margin: number;
  projected_margin_pct: number;
}

// ---------------------------------------------------------------------------
// Seasonal pricing model
// ---------------------------------------------------------------------------

// Seasonal retail price multipliers by month (0 = Jan … 11 = Dec).
// Prices are kept flat for most of the year and lifted during peak demand so
// margin is captured during the October sell-in and holiday windows.
const SEASONAL_PRICE_MULTIPLIERS: readonly number[] = [
  0.95, // Jan — clearance
  0.97, // Feb
  1.00, // Mar
  1.00, // Apr
  1.00, // May
  0.98, // Jun
  0.97, // Jul
  1.00, // Aug
  1.02, // Sep
  1.05, // Oct — sell-in peak
  1.08, // Nov — Black Friday / holiday
  1.10, // Dec — last-chance premium
];

// Wholesale multipliers are more stable — installers negotiate volume rates and
// expect predictability, so we dampen the seasonal swing significantly.
const WHOLESALE_SEASONAL_MULTIPLIERS: readonly number[] = [
  0.98, // Jan
  0.99, // Feb
  1.00, // Mar
  1.00, // Apr
  1.00, // May
  0.99, // Jun
  0.98, // Jul
  1.00, // Aug
  1.01, // Sep
  1.02, // Oct
  1.03, // Nov
  1.03, // Dec
];

/**
 * Returns the retail and wholesale seasonal multipliers for a given date.
 */
export function getSeasonalMultipliers(date: Date): {
  retail: number;
  wholesale: number;
} {
  const month = date.getMonth();
  return {
    retail: SEASONAL_PRICE_MULTIPLIERS[month],
    wholesale: WHOLESALE_SEASONAL_MULTIPLIERS[month],
  };
}

// ---------------------------------------------------------------------------
// Core pricing calculations
// ---------------------------------------------------------------------------

/**
 * Calculate gross margin percentage:  (price − cost) / price × 100
 */
export function grossMarginPct(price: number, unitCost: number): number {
  if (price <= 0) return 0;
  return Math.round(((price - unitCost) / price) * 10000) / 100;
}

/**
 * Calculate markup percentage over cost:  (price − cost) / cost × 100
 */
export function markupPct(price: number, unitCost: number): number {
  if (unitCost <= 0) return 0;
  return Math.round(((price - unitCost) / unitCost) * 10000) / 100;
}

/**
 * Full pricing result for a SKU at a given date, including seasonal adjustments.
 */
export function computePricing(input: SkuPricingInput, date: Date = new Date()): PricingResult {
  const { retail: retailMult, wholesale: wholesaleMult } = getSeasonalMultipliers(date);

  const adjustedRetail = Math.round(input.retail_price * retailMult * 100) / 100;
  const adjustedWholesale = Math.round(input.wholesale_price * wholesaleMult * 100) / 100;

  return {
    unit_cost: input.unit_cost,
    wholesale_price: input.wholesale_price,
    retail_price: input.retail_price,
    wholesale_margin_pct: grossMarginPct(input.wholesale_price, input.unit_cost),
    retail_margin_pct: grossMarginPct(input.retail_price, input.unit_cost),
    wholesale_markup_pct: markupPct(input.wholesale_price, input.unit_cost),
    retail_markup_pct: markupPct(input.retail_price, input.unit_cost),
    seasonal_adjusted_retail: adjustedRetail,
    seasonal_adjusted_wholesale: adjustedWholesale,
    seasonal_multiplier: retailMult,
  };
}

/**
 * Compute the cost and projected margin for a replenishment order at the
 * current seasonal wholesale price.
 */
export function computeReplenishmentCost(
  unitsToOrder: number,
  unitCost: number,
  wholesalePrice: number,
  date: Date = new Date(),
): ReplenishmentCost {
  const { wholesale: wholesaleMult } = getSeasonalMultipliers(date);
  const adjustedWholesale = wholesalePrice * wholesaleMult;

  const totalCost = Math.round(unitsToOrder * unitCost * 100) / 100;
  const totalWholesaleRevenue = Math.round(unitsToOrder * adjustedWholesale * 100) / 100;
  const projectedMargin = Math.round((totalWholesaleRevenue - totalCost) * 100) / 100;
  const projectedMarginPct = grossMarginPct(adjustedWholesale, unitCost);

  return {
    units: unitsToOrder,
    unit_cost: unitCost,
    total_cost: totalCost,
    total_wholesale_revenue: totalWholesaleRevenue,
    projected_margin: projectedMargin,
    projected_margin_pct: projectedMarginPct,
  };
}

/**
 * Suggest a retail price for a new SKU given a cost and target margin.
 *
 * @param unitCost       - The landed cost per unit.
 * @param targetMarginPct - Desired gross margin as a percentage (e.g. 55 for 55 %).
 */
export function suggestRetailPrice(unitCost: number, targetMarginPct: number): number {
  if (targetMarginPct >= 100 || targetMarginPct < 0) {
    throw new RangeError(`targetMarginPct must be in [0, 100); got ${targetMarginPct}`);
  }
  const price = unitCost / (1 - targetMarginPct / 100);
  return Math.round(price * 100) / 100;
}

/**
 * Suggest a wholesale price given cost and a target wholesale margin.
 * Installer accounts are typically offered 40–50 % margin over cost.
 */
export function suggestWholesalePrice(unitCost: number, targetMarginPct = 45): number {
  return suggestRetailPrice(unitCost, targetMarginPct);
}

/**
 * Format a dollar amount for display (e.g. 49.99 → "$49.99").
 */
export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Determine whether a SKU's current wholesale margin is healthy.
 * Returns "good" (≥ 40 %), "warn" (25–39 %), or "poor" (< 25 %).
 */
export function assessWholesaleMarginHealth(
  wholesalePrice: number,
  unitCost: number,
): "good" | "warn" | "poor" {
  const margin = grossMarginPct(wholesalePrice, unitCost);
  if (margin >= 40) return "good";
  if (margin >= 25) return "warn";
  return "poor";
}
