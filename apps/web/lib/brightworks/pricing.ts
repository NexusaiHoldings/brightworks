/**
 * SKU pricing utilities — wholesale vs. retail tier lookup and seasonal
 * adjustment calculations for the demand-forecasting dashboard.
 */

export type PricingTier = "retail" | "wholesale";

export interface SkuPricingSummary {
  skuId: string;
  skuName: string;
  category: string;
  unitCost: number;
  retailPrice: number;
  wholesalePrice: number;
  margin: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pricingPool: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPricingPool(): any {
  if (_pricingPool) return _pricingPool;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Pool } = require("pg") as {
    Pool: new (cfg: Record<string, unknown>) => unknown;
  };
  _pricingPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30_000,
  });
  return _pricingPool;
}

const RETAIL_MARKUP = 2.2;
const WHOLESALE_MARKUP = 1.5;

export function calculateRetailPrice(unitCost: number): number {
  return Math.round(unitCost * RETAIL_MARKUP * 100) / 100;
}

export function calculateWholesalePrice(unitCost: number): number {
  return Math.round(unitCost * WHOLESALE_MARKUP * 100) / 100;
}

export function calculateSeasonalAdjustment(
  basePrice: number,
  demandMultiplier: number,
): number {
  // Cap seasonal premium at 15% above base price.
  const maxPremium = basePrice * 1.15;
  const adjusted = basePrice * demandMultiplier;
  return Math.round(Math.min(adjusted, maxPremium) * 100) / 100;
}

export function getWholesaleDiscount(organizationTier: string): number {
  const discounts: Record<string, number> = {
    platinum: 0.35,
    gold: 0.28,
    silver: 0.20,
    standard: 0.12,
  };
  return discounts[organizationTier.toLowerCase()] ?? 0.12;
}

export function calculateReplenishmentValue(
  quantity: number,
  unitCost: number,
  tier: PricingTier = "retail",
): number {
  const price =
    tier === "wholesale" ? calculateWholesalePrice(unitCost) : calculateRetailPrice(unitCost);
  return Math.round(quantity * price * 100) / 100;
}

export function calculateMargin(unitCost: number, tier: PricingTier = "retail"): number {
  const price =
    tier === "wholesale" ? calculateWholesalePrice(unitCost) : calculateRetailPrice(unitCost);
  return Math.round(((price - unitCost) / price) * 100 * 10) / 10;
}

export async function getSkuPricingSummary(): Promise<SkuPricingSummary[]> {
  const pool = getPricingPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      "SELECT id, name, category, unit_cost FROM brightworks_skus ORDER BY category, name",
    ) as {
      rows: { id: string; name: string; category: string; unit_cost: string }[];
    };
    return rows.map((row) => {
      const unitCost = parseFloat(row.unit_cost);
      const retailPrice = calculateRetailPrice(unitCost);
      const wholesalePrice = calculateWholesalePrice(unitCost);
      const margin = calculateMargin(unitCost, "retail");
      return {
        skuId: row.id,
        skuName: row.name,
        category: row.category,
        unitCost,
        retailPrice,
        wholesalePrice,
        margin,
      };
    });
  } catch {
    return [];
  } finally {
    client.release();
  }
}
