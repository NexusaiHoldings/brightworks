/**
 * Brightworks pricing utilities.
 *
 * Computes retail/wholesale prices, seasonal adjustments, and installer-tier
 * discounts. Wholesale accounts are gated via @nexus/organizations-and-teams
 * RBAC; this module handles the price math once the tier is known.
 */

export type PricingTier = "retail" | "wholesale";

export interface PriceResult {
  base_price: number;
  adjusted_price: number;
  tier: PricingTier;
  seasonal_discount_pct: number;
  volume_discount_pct: number;
  total_discount_pct: number;
}

export interface VolumeBreakpoint {
  min_qty: number;
  discount_pct: number;
}

// Installer wholesale volume discount schedule
const WHOLESALE_VOLUME_BREAKPOINTS: VolumeBreakpoint[] = [
  { min_qty: 1, discount_pct: 0 },
  { min_qty: 50, discount_pct: 5 },
  { min_qty: 150, discount_pct: 10 },
  { min_qty: 300, discount_pct: 15 },
  { min_qty: 500, discount_pct: 20 },
];

/**
 * Returns the volume discount percentage for a given order quantity.
 * Applies only to wholesale accounts.
 */
export function getVolumeDiscountPct(qty: number): number {
  const applicable = WHOLESALE_VOLUME_BREAKPOINTS.filter((bp) => qty >= bp.min_qty);
  if (applicable.length === 0) return 0;
  return applicable[applicable.length - 1].discount_pct;
}

/**
 * Computes seasonal adjustment. Pre-season (Jul–Sep) orders from installers
 * receive an additional early-bird discount to incentivize sell-in before
 * the October deadline. Post-peak (Mar–Apr) orders carry a clearance discount.
 */
export function getSeasonalDiscountPct(tier: PricingTier): number {
  const month = new Date().getMonth() + 1; // 1-12
  if (tier !== "wholesale") return 0;
  // Pre-season early-bird window: encourage sell-in before Oct 1
  if (month >= 7 && month <= 9) return 8;
  // Peak season — no extra discount
  if (month >= 10 || month <= 2) return 0;
  // Late-season clearance (March–June)
  if (month >= 3 && month <= 6) return 12;
  return 0;
}

/**
 * Compute the final price for a SKU given its base prices and buyer context.
 *
 * @param wholesalePrice   - the SKU's list wholesale price
 * @param retailPrice      - the SKU's list retail price
 * @param tier             - "retail" or "wholesale"
 * @param orderQty         - total units in the order (for volume break logic)
 */
export function computePrice(
  wholesalePrice: number,
  retailPrice: number,
  tier: PricingTier,
  orderQty: number,
): PriceResult {
  const basePrice = tier === "wholesale" ? wholesalePrice : retailPrice;

  const seasonalDiscountPct = getSeasonalDiscountPct(tier);
  const volumeDiscountPct = tier === "wholesale" ? getVolumeDiscountPct(orderQty) : 0;

  // Discounts are additive (not compounding) up to a 30% ceiling
  const totalDiscountPct = Math.min(seasonalDiscountPct + volumeDiscountPct, 30);
  const adjustedPrice = Math.round(basePrice * (1 - totalDiscountPct / 100) * 100) / 100;

  return {
    base_price: basePrice,
    adjusted_price: adjustedPrice,
    tier,
    seasonal_discount_pct: seasonalDiscountPct,
    volume_discount_pct: volumeDiscountPct,
    total_discount_pct: totalDiscountPct,
  };
}

/**
 * Returns the effective per-unit price for a given tier and quantity,
 * as a convenience wrapper around computePrice.
 */
export function getPriceForTier(
  wholesalePrice: number,
  retailPrice: number,
  tier: PricingTier,
  orderQty: number = 1,
): number {
  return computePrice(wholesalePrice, retailPrice, tier, orderQty).adjusted_price;
}

/**
 * Formats a price as a USD currency string.
 */
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Estimates total order value for a set of line items at the given tier.
 */
export interface LineItem {
  wholesale_price: number;
  retail_price: number;
  qty: number;
}

export function estimateOrderValue(
  lineItems: LineItem[],
  tier: PricingTier,
): number {
  const totalQty = lineItems.reduce((sum, li) => sum + li.qty, 0);
  return lineItems.reduce((total, li) => {
    const unitPrice = getPriceForTier(li.wholesale_price, li.retail_price, tier, totalQty);
    return total + unitPrice * li.qty;
  }, 0);
}
