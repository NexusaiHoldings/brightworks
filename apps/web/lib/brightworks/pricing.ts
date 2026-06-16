/**
 * Brightworks seasonal pricing and replenishment logic.
 *
 * Computes seasonal price adjustments and inventory replenishment
 * recommendations based on demand forecast data.
 */

export interface PricingRecommendation {
  sku_id: string;
  sku_code: string;
  name: string;
  current_price: number;
  recommended_price: number;
  adjustment_pct: number;
  reason: string;
}

export interface ReplenishmentOrder {
  sku_id: string;
  sku_code: string;
  name: string;
  current_inventory: number;
  forecast_demand: number;
  units_to_order: number;
  urgency: "critical" | "high" | "medium" | "low";
  order_by_date: string;
}

/** October 1 sell-in deadline for the current season. */
export const SELL_IN_DEADLINE = new Date(
  new Date().getFullYear() + (new Date().getMonth() >= 9 ? 1 : 0),
  9, // October (0-indexed)
  1
);

/** Days remaining until the October sell-in deadline. */
export function daysUntilDeadline(): number {
  const now = new Date();
  const diff = SELL_IN_DEADLINE.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Compute a seasonal demand multiplier based on Google Trends score (0–100)
 * and how close we are to the October sell-in deadline.
 *
 * Multiplier rises from 1.0 at baseline to up to 2.5 when trends are peaking
 * and the deadline is within 30 days.
 */
export function computeSeasonalMultiplier(
  trendsScore: number,
  daysToDeadline: number
): number {
  const trendsFactor = 1 + (trendsScore / 100) * 0.8; // 1.0 – 1.8
  const urgencyFactor =
    daysToDeadline <= 14
      ? 1.4
      : daysToDeadline <= 30
      ? 1.2
      : daysToDeadline <= 60
      ? 1.1
      : 1.0;
  return Math.round(trendsFactor * urgencyFactor * 100) / 100;
}

/**
 * Compute how many units to order to avoid stockout given current inventory,
 * forecast demand, and supplier lead time.
 *
 * Adds a 20 % safety buffer on top of the net shortfall.
 */
export function computeReplenishmentUnits(
  currentInventory: number,
  forecastDemand: number,
  leadTimeDays: number,
  safetyBufferPct: number = 0.2
): number {
  const dailyDemand = forecastDemand / 90; // 90-day season
  const leadTimeDemand = Math.ceil(dailyDemand * leadTimeDays);
  const reorderPoint = leadTimeDemand * (1 + safetyBufferPct);
  const netShortfall = Math.max(0, forecastDemand - currentInventory);
  const toOrder = Math.ceil(netShortfall + reorderPoint);
  return Math.max(0, toOrder);
}

/**
 * Derive a recommended price for a SKU given its current price and the
 * seasonal multiplier. Caps upward adjustment at 25 % to avoid alarming
 * wholesale partners.
 */
export function computeRecommendedPrice(
  currentPrice: number,
  seasonalMultiplier: number
): number {
  const rawPrice = currentPrice * seasonalMultiplier;
  const maxPrice = currentPrice * 1.25;
  return Math.round(Math.min(rawPrice, maxPrice) * 100) / 100;
}

/**
 * Build a plain-English reason string for a pricing recommendation.
 */
export function buildPricingReason(
  trendsScore: number,
  daysToDeadline: number,
  adjustmentPct: number
): string {
  const parts: string[] = [];
  if (trendsScore >= 70) {
    parts.push("high holiday search volume");
  } else if (trendsScore >= 40) {
    parts.push("moderate search interest");
  } else {
    parts.push("low search interest");
  }
  if (daysToDeadline <= 30) {
    parts.push("deadline within 30 days");
  }
  if (adjustmentPct > 10) {
    parts.push(`+${adjustmentPct.toFixed(1)}% seasonal premium applied`);
  }
  return parts.join("; ") || "standard seasonal pricing";
}

/**
 * Determine order urgency from days until stockout and days until deadline.
 */
export function classifyUrgency(
  daysToStockout: number,
  daysToDeadlineVal: number
): "critical" | "high" | "medium" | "low" {
  if (daysToStockout <= 7 || (daysToDeadlineVal <= 14 && daysToStockout <= 21)) {
    return "critical";
  }
  if (daysToStockout <= 21 || daysToDeadlineVal <= 30) {
    return "high";
  }
  if (daysToStockout <= 45) {
    return "medium";
  }
  return "low";
}

/**
 * Format an order-by date as YYYY-MM-DD, `leadTimeDays` before the deadline.
 */
export function computeOrderByDate(leadTimeDays: number): string {
  const orderBy = new Date(SELL_IN_DEADLINE);
  orderBy.setDate(orderBy.getDate() - leadTimeDays - 7); // 1-week buffer
  return orderBy.toISOString().split("T")[0];
}
