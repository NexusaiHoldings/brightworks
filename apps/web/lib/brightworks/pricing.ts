/**
 * Pricing logic for Brightworks seasonal SKU catalog.
 * Handles retail vs. wholesale installer tiers + seasonal adjustments.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pool: any = null;

function getPool(): {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
} {
  if (_pool) return _pool;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Pool: PgPool } = require("pg") as {
    Pool: new (config: Record<string, unknown>) => {
      query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
    };
  };
  _pool = new PgPool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
  return _pool;
}

export interface PricingTier {
  tierId: string;
  tierName: string;
  minOrderQuantity: number;
  discountPercent: number;
  isWholesale: boolean;
}

export interface SkuPricing {
  skuId: string;
  skuName: string;
  retailPrice: number;
  wholesalePrice: number;
  currentTier: PricingTier;
  seasonalAdjustment: number;
  effectivePrice: number;
}

export interface OrderCostBreakdown {
  subtotal: number;
  discount: number;
  total: number;
  unitEffectivePrice: number;
}

async function ensurePricingTiersTable(): Promise<void> {
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS brightworks_pricing_tiers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tier_name TEXT NOT NULL UNIQUE,
      min_order_quantity INTEGER NOT NULL DEFAULT 1,
      discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
      is_wholesale BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function ensureSkuPricingTable(): Promise<void> {
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS brightworks_sku_pricing (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sku_id UUID NOT NULL UNIQUE,
      retail_price NUMERIC(10,2) NOT NULL,
      wholesale_price NUMERIC(10,2) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function seedTiersIfEmpty(): Promise<void> {
  const db = getPool();
  const countResult = await db.query("SELECT COUNT(*) as cnt FROM brightworks_pricing_tiers");
  if (parseInt(String((countResult.rows[0] as { cnt: string }).cnt)) > 0) return;

  await db.query(
    `INSERT INTO brightworks_pricing_tiers (tier_name, min_order_quantity, discount_percent, is_wholesale)
     VALUES ($1, $2, $3, $4), ($5, $6, $7, $8), ($9, $10, $11, $12), ($13, $14, $15, $16)`,
    [
      "Retail",           1,   0,  false,
      "Installer Bronze", 10,  15, true,
      "Installer Silver", 50,  25, true,
      "Installer Gold",   100, 35, true,
    ]
  );
}

export async function getPricingTiers(): Promise<PricingTier[]> {
  const db = getPool();
  await ensurePricingTiersTable();
  await seedTiersIfEmpty();

  const result = await db.query(
    `SELECT id, tier_name, min_order_quantity, discount_percent, is_wholesale
     FROM brightworks_pricing_tiers
     ORDER BY min_order_quantity ASC`
  );

  return result.rows.map((row) => {
    const r = row as {
      id: string;
      tier_name: string;
      min_order_quantity: string | number;
      discount_percent: string | number;
      is_wholesale: boolean;
    };
    return {
      tierId: r.id,
      tierName: r.tier_name,
      minOrderQuantity: parseInt(String(r.min_order_quantity)),
      discountPercent: parseFloat(String(r.discount_percent)),
      isWholesale: r.is_wholesale,
    };
  });
}

// Returns a seasonal price adjustment (positive = surcharge, negative = discount).
export function calculateSeasonalAdjustment(basePrice: number, month?: number): number {
  const currentMonth = month ?? new Date().getMonth(); // 0–11
  // Peak season: Sep–Jan → 5% surcharge
  if (currentMonth >= 8 || currentMonth <= 0) return Math.round(basePrice * 0.05 * 100) / 100;
  // Pre-season: Jul–Aug → 3% early-order discount
  if (currentMonth >= 6 && currentMonth <= 7) return Math.round(basePrice * -0.03 * 100) / 100;
  // Off-season: Feb–Jun → 10% clearance discount
  return Math.round(basePrice * -0.1 * 100) / 100;
}

export function getEffectivePrice(
  retailPrice: number,
  tier: PricingTier,
  applySeasonalAdjustment: boolean = true
): number {
  const discounted = retailPrice * (1 - tier.discountPercent / 100);
  if (!applySeasonalAdjustment) return Math.round(discounted * 100) / 100;
  const adj = calculateSeasonalAdjustment(discounted);
  return Math.round((discounted + adj) * 100) / 100;
}

export async function getSkuPricing(skuId: string, tierName: string = "Retail"): Promise<SkuPricing | null> {
  const db = getPool();
  await ensureSkuPricingTable();

  const result = await db.query(
    `SELECT
       s.id          AS sku_id,
       s.name        AS sku_name,
       COALESCE(sp.retail_price, 199.99)    AS retail_price,
       COALESCE(sp.wholesale_price, 149.99) AS wholesale_price
     FROM brightworks_skus s
     LEFT JOIN brightworks_sku_pricing sp ON sp.sku_id = s.id
     WHERE s.id = $1`,
    [skuId]
  );

  if (result.rows.length === 0) return null;

  const tiers = await getPricingTiers();
  const currentTier = tiers.find((t) => t.tierName === tierName) ?? tiers[0];

  const row = result.rows[0] as {
    sku_id: string;
    sku_name: string;
    retail_price: string | number;
    wholesale_price: string | number;
  };

  const retailPrice = parseFloat(String(row.retail_price));
  const wholesalePrice = parseFloat(String(row.wholesale_price));
  const seasonalAdjustment = calculateSeasonalAdjustment(retailPrice);
  const effectivePrice = getEffectivePrice(retailPrice, currentTier);

  return {
    skuId: row.sku_id,
    skuName: row.sku_name,
    retailPrice,
    wholesalePrice,
    currentTier,
    seasonalAdjustment,
    effectivePrice,
  };
}

export function calculateOrderCost(
  unitPrice: number,
  quantity: number,
  tier: PricingTier
): OrderCostBreakdown {
  const unitEffectivePrice = getEffectivePrice(unitPrice, tier);
  const subtotal = Math.round(unitPrice * quantity * 100) / 100;
  const discount = Math.round((unitPrice - unitEffectivePrice) * quantity * 100) / 100;
  const total = Math.round(unitEffectivePrice * quantity * 100) / 100;
  return { subtotal, discount, total, unitEffectivePrice };
}
