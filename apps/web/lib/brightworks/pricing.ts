import { Pool } from 'pg';

let _pricingPool: Pool | null = null;

function getPool(): Pool {
  if (!_pricingPool) {
    _pricingPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return _pricingPool;
}

export type PricingTierName = 'retail' | 'wholesale' | 'installer';

export interface PricingTier {
  tier: PricingTierName;
  discount_pct: number;
  min_order_qty: number;
  description: string;
}

export interface SkuPricing {
  sku_code: string;
  sku_name: string;
  category: string;
  msrp: number;
  wholesale_price: number;
  installer_price: number;
  currency: string;
}

export interface ReplenishmentValueBreakdown {
  total_units: number;
  retail_value: number;
  wholesale_value: number;
  installer_value: number;
  currency: string;
}

export const PRICING_TIERS: PricingTier[] = [
  { tier: 'retail', discount_pct: 0, min_order_qty: 1, description: 'Full MSRP for direct consumers' },
  { tier: 'wholesale', discount_pct: 0.35, min_order_qty: 12, description: 'Bulk distributor pricing' },
  { tier: 'installer', discount_pct: 0.45, min_order_qty: 24, description: 'Installer partner pricing (RBAC-gated)' },
];

// Base MSRP by category — installer dashboard sell-in prices for October deadline
const MSRP_BY_CATEGORY: Record<string, number> = {
  Outerwear: 189.99,
  Footwear: 149.99,
  Layering: 79.99,
  Accessories: 39.99,
};

export async function initializePricingTables(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS brightworks_sku_pricing (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sku_id UUID NOT NULL REFERENCES brightworks_skus(id) ON DELETE CASCADE,
        msrp NUMERIC(10,2) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (sku_id, effective_from)
      )
    `);

    // Seed pricing for any SKUs that don't have it yet
    await client.query(`
      INSERT INTO brightworks_sku_pricing (sku_id, msrp, currency)
      SELECT
        s.id,
        CASE s.category
          WHEN 'Outerwear'   THEN 189.99
          WHEN 'Footwear'    THEN 149.99
          WHEN 'Layering'    THEN 79.99
          WHEN 'Accessories' THEN 39.99
          ELSE 99.99
        END,
        'USD'
      FROM brightworks_skus s
      WHERE NOT EXISTS (
        SELECT 1 FROM brightworks_sku_pricing p WHERE p.sku_id = s.id
      )
    `);
  } finally {
    client.release();
  }
}

export function calculateTierPrice(msrp: number, tier: PricingTierName): number {
  const tierConfig = PRICING_TIERS.find((t) => t.tier === tier);
  if (!tierConfig) return msrp;
  return Math.round(msrp * (1 - tierConfig.discount_pct) * 100) / 100;
}

export async function getSkuPricing(skuCode: string): Promise<SkuPricing | null> {
  const pool = getPool();
  const result = await pool.query<{
    sku_code: string;
    name: string;
    category: string;
    msrp: string;
    currency: string;
  }>(
    `SELECT s.sku_code, s.name, s.category, p.msrp, p.currency
     FROM brightworks_skus s
     JOIN brightworks_sku_pricing p ON p.sku_id = s.id
     WHERE s.sku_code = $1
     ORDER BY p.effective_from DESC
     LIMIT 1`,
    [skuCode]
  );

  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  const msrp = parseFloat(row.msrp);

  return {
    sku_code: row.sku_code,
    sku_name: row.name,
    category: row.category,
    msrp,
    wholesale_price: calculateTierPrice(msrp, 'wholesale'),
    installer_price: calculateTierPrice(msrp, 'installer'),
    currency: row.currency,
  };
}

export async function getAllSkuPricing(): Promise<SkuPricing[]> {
  const pool = getPool();
  const result = await pool.query<{
    sku_code: string;
    name: string;
    category: string;
    msrp: string;
    currency: string;
  }>(`
    SELECT DISTINCT ON (s.id)
      s.sku_code, s.name, s.category, p.msrp, p.currency
    FROM brightworks_skus s
    JOIN brightworks_sku_pricing p ON p.sku_id = s.id
    ORDER BY s.id, p.effective_from DESC
  `);

  return result.rows.map((row) => {
    const msrp = parseFloat(row.msrp);
    return {
      sku_code: row.sku_code,
      sku_name: row.name,
      category: row.category,
      msrp,
      wholesale_price: calculateTierPrice(msrp, 'wholesale'),
      installer_price: calculateTierPrice(msrp, 'installer'),
      currency: row.currency,
    };
  });
}

export function getMsrpByCategory(category: string): number {
  return MSRP_BY_CATEGORY[category] ?? 99.99;
}

export async function calculateReplenishmentValue(
  skuCodes: string[],
  quantities: number[]
): Promise<ReplenishmentValueBreakdown> {
  if (skuCodes.length !== quantities.length) {
    throw new Error('skuCodes and quantities arrays must have the same length');
  }

  const pool = getPool();
  const result = await pool.query<{
    sku_code: string;
    category: string;
    msrp: string;
    currency: string;
  }>(
    `SELECT DISTINCT ON (s.id)
       s.sku_code, s.category, p.msrp, p.currency
     FROM brightworks_skus s
     JOIN brightworks_sku_pricing p ON p.sku_id = s.id
     WHERE s.sku_code = ANY($1)
     ORDER BY s.id, p.effective_from DESC`,
    [skuCodes]
  );

  const priceMap = new Map<string, number>();
  for (const row of result.rows) {
    priceMap.set(row.sku_code, parseFloat(row.msrp));
  }

  let totalUnits = 0;
  let retailValue = 0;
  let wholesaleValue = 0;
  let installerValue = 0;

  for (let idx = 0; idx < skuCodes.length; idx++) {
    const qty = quantities[idx] ?? 0;
    const msrp = priceMap.get(skuCodes[idx] ?? '') ?? 99.99;
    totalUnits += qty;
    retailValue += qty * msrp;
    wholesaleValue += qty * calculateTierPrice(msrp, 'wholesale');
    installerValue += qty * calculateTierPrice(msrp, 'installer');
  }

  return {
    total_units: totalUnits,
    retail_value: Math.round(retailValue * 100) / 100,
    wholesale_value: Math.round(wholesaleValue * 100) / 100,
    installer_value: Math.round(installerValue * 100) / 100,
    currency: 'USD',
  };
}
