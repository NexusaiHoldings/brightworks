/**
 * Demand forecasting core — seasonal inventory replenishment logic.
 * Ingests Google Trends search volume + weather-onset factors to produce
 * per-SKU stockout risk scores and reorder recommendations.
 */

interface PgPool {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
}

let _pool: PgPool | null = null;

function getPool(): PgPool {
  if (_pool) return _pool;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Pool } = require('pg') as {
    Pool: new (cfg: Record<string, unknown>) => PgPool;
  };
  _pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
  return _pool;
}

export interface SkuInventory {
  id: string;
  sku_code: string;
  name: string;
  category: string;
  current_stock: number;
  reorder_point: number;
  lead_time_days: number;
  unit_cost: number;
  wholesale_price: number;
  retail_price: number;
}

export interface DemandForecast {
  id: string;
  sku_id: string;
  sku_code: string;
  sku_name: string;
  current_stock: number;
  forecast_date: string;
  predicted_demand: number;
  confidence_score: number;
  stockout_risk: number;
  recommended_reorder_qty: number;
  trends_index: number;
  weather_factor: number;
  created_at: string;
}

export interface ForecastSummary {
  forecasts: DemandForecast[];
  at_risk_count: number;
  total_skus: number;
  last_run_at: string | null;
}

export async function ensureTablesExist(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS brightworks_skus (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sku_code VARCHAR(64) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(128) NOT NULL,
      current_stock INTEGER NOT NULL DEFAULT 0,
      reorder_point INTEGER NOT NULL DEFAULT 50,
      lead_time_days INTEGER NOT NULL DEFAULT 30,
      unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
      wholesale_price NUMERIC(10,2) NOT NULL DEFAULT 0,
      retail_price NUMERIC(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS brightworks_demand_forecasts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sku_id UUID NOT NULL REFERENCES brightworks_skus(id),
      forecast_date DATE NOT NULL,
      predicted_demand INTEGER NOT NULL,
      confidence_score NUMERIC(4,3) NOT NULL DEFAULT 0.5,
      stockout_risk NUMERIC(4,3) NOT NULL DEFAULT 0,
      recommended_reorder_qty INTEGER NOT NULL DEFAULT 0,
      trends_index NUMERIC(6,2) NOT NULL DEFAULT 50,
      weather_factor NUMERIC(4,3) NOT NULL DEFAULT 1.0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const result = await pool.query(
    'SELECT COUNT(*)::int AS cnt FROM brightworks_skus'
  );
  const cnt = (result.rows[0] as { cnt: number }).cnt;
  if (cnt === 0) {
    await seedSampleSkus(pool);
  }
}

async function seedSampleSkus(pool: PgPool): Promise<void> {
  const skus = [
    { code: 'BW-LITE-001', name: 'Brightworks LED Canopy Light 100W', cat: 'Lighting',      stock: 142, reorder: 60,  lead: 35, cost: 89.0,  ws: 145.0, ret: 225.0 },
    { code: 'BW-LITE-002', name: 'Brightworks LED Canopy Light 150W', cat: 'Lighting',      stock: 87,  reorder: 50,  lead: 35, cost: 112.0, ws: 185.0, ret: 285.0 },
    { code: 'BW-CTRL-001', name: 'Brightworks Smart Dimmer Controller', cat: 'Controls',    stock: 210, reorder: 80,  lead: 21, cost: 45.0,  ws: 78.0,  ret: 120.0 },
    { code: 'BW-CTRL-002', name: 'Brightworks Occupancy Sensor',       cat: 'Controls',     stock: 38,  reorder: 75,  lead: 28, cost: 32.0,  ws: 55.0,  ret: 89.0  },
    { code: 'BW-PANEL-001', name: 'Brightworks LED Panel 2x4ft 50W',   cat: 'Panels',       stock: 175, reorder: 100, lead: 42, cost: 67.0,  ws: 110.0, ret: 165.0 },
    { code: 'BW-PANEL-002', name: 'Brightworks LED Panel 2x2ft 40W',   cat: 'Panels',       stock: 24,  reorder: 60,  lead: 42, cost: 52.0,  ws: 88.0,  ret: 135.0 },
    { code: 'BW-STRIP-001', name: 'Brightworks LED Strip 16ft 24W',    cat: 'Strip Lighting', stock: 312, reorder: 120, lead: 14, cost: 18.0, ws: 32.0,  ret: 52.0  },
    { code: 'BW-FLOOD-001', name: 'Brightworks LED Flood 200W Outdoor', cat: 'Outdoor',     stock: 56,  reorder: 70,  lead: 45, cost: 135.0, ws: 220.0, ret: 340.0 },
  ];
  for (const s of skus) {
    await pool.query(
      `INSERT INTO brightworks_skus
         (sku_code, name, category, current_stock, reorder_point, lead_time_days,
          unit_cost, wholesale_price, retail_price)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (sku_code) DO NOTHING`,
      [s.code, s.name, s.cat, s.stock, s.reorder, s.lead, s.cost, s.ws, s.ret]
    );
  }
}

export async function getAllSkus(): Promise<SkuInventory[]> {
  const pool = getPool();
  const result = await pool.query(`
    SELECT id, sku_code, name, category, current_stock, reorder_point,
           lead_time_days,
           unit_cost::float8 AS unit_cost,
           wholesale_price::float8 AS wholesale_price,
           retail_price::float8 AS retail_price
    FROM brightworks_skus
    ORDER BY category, name
  `);
  return result.rows as SkuInventory[];
}

export function calculateStockoutRisk(
  currentStock: number,
  predictedDemand: number,
  reorderPoint: number,
  leadTimeDays: number
): number {
  if (predictedDemand <= 0) return 0;
  const demandPerDay = predictedDemand / 90;
  if (demandPerDay <= 0) return 0;
  const daysOfStock = currentStock / demandPerDay;
  // Must cover lead time plus a safety buffer proportional to the reorder point
  const criticalDays = leadTimeDays + Math.ceil(reorderPoint / (demandPerDay * 7));
  if (daysOfStock <= 0) return 1.0;
  if (daysOfStock >= criticalDays * 1.5) return 0.05;
  return Math.min(1.0, Math.max(0.0, 1 - daysOfStock / criticalDays));
}

export function calculateReorderQuantity(
  currentStock: number,
  predictedDemand: number,
  reorderPoint: number
): number {
  const targetStock = Math.ceil(predictedDemand * 1.2) + reorderPoint;
  const shortfall = targetStock - currentStock;
  return shortfall > 0 ? shortfall : 0;
}

export async function getLatestForecasts(): Promise<DemandForecast[]> {
  const pool = getPool();
  const result = await pool.query(`
    WITH latest AS (
      SELECT DISTINCT ON (sku_id) *
      FROM brightworks_demand_forecasts
      ORDER BY sku_id, created_at DESC
    )
    SELECT
      l.id, l.sku_id,
      s.sku_code, s.name AS sku_name, s.current_stock,
      l.forecast_date::text      AS forecast_date,
      l.predicted_demand,
      l.confidence_score::float8 AS confidence_score,
      l.stockout_risk::float8    AS stockout_risk,
      l.recommended_reorder_qty,
      l.trends_index::float8     AS trends_index,
      l.weather_factor::float8   AS weather_factor,
      l.created_at::text         AS created_at
    FROM latest l
    JOIN brightworks_skus s ON s.id = l.sku_id
    ORDER BY l.stockout_risk DESC, s.name
  `);
  return result.rows as DemandForecast[];
}

export async function getForecastSummary(): Promise<ForecastSummary> {
  const pool = getPool();
  const forecasts = await getLatestForecasts();
  const runResult = await pool.query(
    `SELECT MAX(created_at)::text AS last_run FROM brightworks_demand_forecasts`
  );
  const lastRunAt = (runResult.rows[0] as { last_run: string | null }).last_run;
  return {
    forecasts,
    at_risk_count: forecasts.filter(f => f.stockout_risk >= 0.5).length,
    total_skus: forecasts.length,
    last_run_at: lastRunAt,
  };
}

export async function saveForecast(
  skuId: string,
  forecastDate: string,
  predictedDemand: number,
  confidenceScore: number,
  stockoutRisk: number,
  recommendedReorderQty: number,
  trendsIndex: number,
  weatherFactor: number
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO brightworks_demand_forecasts
       (sku_id, forecast_date, predicted_demand, confidence_score,
        stockout_risk, recommended_reorder_qty, trends_index, weather_factor)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [skuId, forecastDate, predictedDemand, confidenceScore,
     stockoutRisk, recommendedReorderQty, trendsIndex, weatherFactor]
  );
}
