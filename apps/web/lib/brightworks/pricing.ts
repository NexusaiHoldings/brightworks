import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export interface SkuPrice {
  sku_id: string;
  sku_name: string;
  base_price_cents: number;
  wholesale_price_cents: number;
  retail_price_cents: number;
  margin_percent: number;
}

export type WholesaleTier = 'standard' | 'premium' | 'enterprise';

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export function calculateWholesalePrice(basePriceCents: number, tier: WholesaleTier): number {
  const discountRates: Record<WholesaleTier, number> = {
    standard: 0.30,
    premium: 0.40,
    enterprise: 0.50,
  };
  return Math.round(basePriceCents * (1 - discountRates[tier]));
}

export function calculateRetailPrice(basePriceCents: number): number {
  return Math.round(basePriceCents * 2.2);
}

export function calculateMargin(wholesalePriceCents: number, costCents: number): number {
  if (wholesalePriceCents === 0) return 0;
  return Math.round(((wholesalePriceCents - costCents) / wholesalePriceCents) * 100);
}

export async function getSkuPricing(tier: WholesaleTier = 'standard'): Promise<SkuPrice[]> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{
      id: string;
      name: string;
      base_price_cents: number;
    }>('SELECT id, name, base_price_cents FROM brightworks_skus ORDER BY name');
    return rows.map((row) => {
      const wholesalePriceCents = calculateWholesalePrice(row.base_price_cents, tier);
      const retailPriceCents = calculateRetailPrice(row.base_price_cents);
      return {
        sku_id: row.id,
        sku_name: row.name,
        base_price_cents: row.base_price_cents,
        wholesale_price_cents: wholesalePriceCents,
        retail_price_cents: retailPriceCents,
        margin_percent: calculateMargin(wholesalePriceCents, row.base_price_cents),
      };
    });
  } finally {
    client.release();
  }
}

export async function updateSkuPrice(skuId: string, basePriceCents: number): Promise<void> {
  if (basePriceCents < 0) throw new Error('Price cannot be negative');
  const client = await pool.connect();
  try {
    await client.query(
      'UPDATE brightworks_skus SET base_price_cents = $1, updated_at = NOW() WHERE id = $2',
      [basePriceCents, skuId]
    );
  } finally {
    client.release();
  }
}
