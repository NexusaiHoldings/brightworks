import { Pool } from 'pg';

export type StockoutRisk = 'critical' | 'high' | 'medium' | 'low';

export interface SkuForecast {
  id: string;
  skuId: string;
  skuName: string;
  category: string;
  currentInventory: number;
  forecastedDemand: number;
  recommendedReorder: number;
  trendScore: number;
  weatherFactor: number;
  stockoutRiskLevel: StockoutRisk;
  stockoutDate: Date | null;
  sellInDeadline: Date;
  lastUpdated: Date;
}

export interface ForecastSummary {
  totalSkus: number;
  criticalCount: number;
  highRiskCount: number;
  totalReorderUnits: number;
  lastRunAt: Date | null;
}

export interface TrendData {
  keyword: string;
  score: number;
  region: string;
}

export interface WeatherData {
  region: string;
  onsetDate: Date;
  temperatureDelta: number;
}

let dbPool: Pool | null = null;

function getPool(): Pool {
  if (!dbPool) {
    dbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 5,
    });
  }
  return dbPool;
}

export async function ensureForecastSchema(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS bw_sku_forecasts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sku_id VARCHAR(64) UNIQUE NOT NULL,
        sku_name VARCHAR(256) NOT NULL,
        category VARCHAR(128) NOT NULL,
        current_inventory INTEGER NOT NULL DEFAULT 0,
        forecasted_demand INTEGER NOT NULL DEFAULT 0,
        recommended_reorder INTEGER NOT NULL DEFAULT 0,
        trend_score NUMERIC(5,2) NOT NULL DEFAULT 0,
        weather_factor NUMERIC(6,4) NOT NULL DEFAULT 1.0,
        stockout_risk_level VARCHAR(16) NOT NULL DEFAULT 'low',
        stockout_date TIMESTAMPTZ,
        sell_in_deadline TIMESTAMPTZ NOT NULL,
        last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_bw_sku_risk ON bw_sku_forecasts(stockout_risk_level)`
    );
  } finally {
    client.release();
  }
}

export function computeStockoutRisk(
  currentInventory: number,
  forecastedDemand: number,
  sellInDeadline: Date,
  daysUntilSeason: number
): { riskLevel: StockoutRisk; stockoutDate: Date | null } {
  if (forecastedDemand <= 0) {
    return { riskLevel: 'low', stockoutDate: null };
  }
  const coverageRatio = currentInventory / forecastedDemand;
  const dailyDemand = forecastedDemand / Math.max(daysUntilSeason, 1);
  const daysOfStock = currentInventory / Math.max(dailyDemand, 0.01);
  const today = new Date();
  const projectedStockout = new Date(today.getTime() + daysOfStock * 86400000);
  const daysUntilDeadline = Math.max(
    Math.floor((sellInDeadline.getTime() - today.getTime()) / 86400000),
    1
  );

  let riskLevel: StockoutRisk;
  if (coverageRatio < 0.5 || daysOfStock < daysUntilDeadline * 0.5) {
    riskLevel = 'critical';
  } else if (coverageRatio < 0.75 || daysOfStock < daysUntilDeadline * 0.75) {
    riskLevel = 'high';
  } else if (coverageRatio < 1.0) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }

  const stockoutDate = daysOfStock < daysUntilDeadline + 30 ? projectedStockout : null;
  return { riskLevel, stockoutDate };
}

export async function upsertSkuForecast(
  forecast: Omit<SkuForecast, 'id'>
): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query(
      `INSERT INTO bw_sku_forecasts (
        sku_id, sku_name, category, current_inventory, forecasted_demand,
        recommended_reorder, trend_score, weather_factor, stockout_risk_level,
        stockout_date, sell_in_deadline, last_updated
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
      ON CONFLICT (sku_id) DO UPDATE SET
        sku_name = EXCLUDED.sku_name,
        category = EXCLUDED.category,
        current_inventory = EXCLUDED.current_inventory,
        forecasted_demand = EXCLUDED.forecasted_demand,
        recommended_reorder = EXCLUDED.recommended_reorder,
        trend_score = EXCLUDED.trend_score,
        weather_factor = EXCLUDED.weather_factor,
        stockout_risk_level = EXCLUDED.stockout_risk_level,
        stockout_date = EXCLUDED.stockout_date,
        sell_in_deadline = EXCLUDED.sell_in_deadline,
        last_updated = NOW()`,
      [
        forecast.skuId,
        forecast.skuName,
        forecast.category,
        forecast.currentInventory,
        forecast.forecastedDemand,
        forecast.recommendedReorder,
        forecast.trendScore,
        forecast.weatherFactor,
        forecast.stockoutRiskLevel,
        forecast.stockoutDate?.toISOString() ?? null,
        forecast.sellInDeadline.toISOString(),
      ]
    );
  } finally {
    client.release();
  }
}

export async function getSkuForecasts(): Promise<SkuForecast[]> {
  const client = await getPool().connect();
  try {
    const result = await client.query(`
      SELECT
        id, sku_id, sku_name, category,
        current_inventory, forecasted_demand, recommended_reorder,
        trend_score, weather_factor, stockout_risk_level,
        stockout_date, sell_in_deadline, last_updated
      FROM bw_sku_forecasts
      ORDER BY
        CASE stockout_risk_level
          WHEN 'critical' THEN 0
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          ELSE 3
        END,
        stockout_date ASC NULLS LAST,
        sku_name ASC
    `);
    return result.rows.map(row => ({
      id: row.id as string,
      skuId: row.sku_id as string,
      skuName: row.sku_name as string,
      category: row.category as string,
      currentInventory: Number(row.current_inventory),
      forecastedDemand: Number(row.forecasted_demand),
      recommendedReorder: Number(row.recommended_reorder),
      trendScore: Number(row.trend_score),
      weatherFactor: Number(row.weather_factor),
      stockoutRiskLevel: row.stockout_risk_level as StockoutRisk,
      stockoutDate: row.stockout_date ? new Date(row.stockout_date as string) : null,
      sellInDeadline: new Date(row.sell_in_deadline as string),
      lastUpdated: new Date(row.last_updated as string),
    }));
  } finally {
    client.release();
  }
}

export async function getForecastSummary(): Promise<ForecastSummary> {
  const client = await getPool().connect();
  try {
    const result = await client.query(`
      SELECT
        COUNT(*) as total_skus,
        COUNT(*) FILTER (WHERE stockout_risk_level = 'critical') as critical_count,
        COUNT(*) FILTER (WHERE stockout_risk_level IN ('critical','high')) as high_risk_count,
        COALESCE(SUM(recommended_reorder), 0) as total_reorder_units,
        MAX(last_updated) as last_run_at
      FROM bw_sku_forecasts
    `);
    const row = result.rows[0];
    return {
      totalSkus: Number(row.total_skus),
      criticalCount: Number(row.critical_count),
      highRiskCount: Number(row.high_risk_count),
      totalReorderUnits: Number(row.total_reorder_units),
      lastRunAt: row.last_run_at ? new Date(row.last_run_at as string) : null,
    };
  } finally {
    client.release();
  }
}
