import { Pool, type PoolClient } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export interface SkuForecast {
  sku_id: string;
  sku_name: string;
  current_inventory: number;
  forecasted_demand: number;
  trend_score: number;
  weather_score: number;
  stockout_risk: 'high' | 'medium' | 'low';
  days_until_stockout: number | null;
  october_deadline: boolean;
}

export interface ForecastRun {
  id: string;
  run_at: string;
  skus_analyzed: number;
  high_risk_count: number;
}

async function ensureTables(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS brightworks_skus (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      base_price_cents INTEGER NOT NULL DEFAULT 0,
      current_inventory INTEGER NOT NULL DEFAULT 0,
      lead_time_days INTEGER NOT NULL DEFAULT 30,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS brightworks_demand_forecasts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sku_id UUID NOT NULL REFERENCES brightworks_skus(id),
      run_id UUID NOT NULL,
      forecasted_demand INTEGER NOT NULL,
      trend_score NUMERIC(5,2) NOT NULL DEFAULT 0,
      weather_score NUMERIC(5,2) NOT NULL DEFAULT 0,
      stockout_risk TEXT NOT NULL DEFAULT 'low',
      days_until_stockout INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS brightworks_forecast_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      skus_analyzed INTEGER NOT NULL DEFAULT 0,
      high_risk_count INTEGER NOT NULL DEFAULT 0,
      metadata JSONB
    )
  `);
  const { rows } = await client.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM brightworks_skus'
  );
  if (parseInt(rows[0].count, 10) === 0) {
    await client.query(`
      INSERT INTO brightworks_skus (name, category, base_price_cents, current_inventory, lead_time_days)
      VALUES
        ('Premium Christmas Tree Stand', 'hardware', 7999, 145, 45),
        ('LED Light String 100ct', 'lighting', 2499, 320, 30),
        ('Outdoor Wreath 24in', 'decorations', 4999, 89, 60),
        ('Artificial Snow Spray', 'accessories', 899, 450, 14),
        ('Window Cling Set', 'decorations', 1499, 210, 21),
        ('Icicle Light Strand 20ft', 'lighting', 3499, 67, 30),
        ('Wrapping Paper Bundle', 'supplies', 1999, 380, 14),
        ('Advent Calendar Kit', 'specialty', 5999, 34, 45),
        ('Ornament Hooks 200ct', 'accessories', 499, 890, 14),
        ('Storage Box 3-pack', 'storage', 2999, 156, 21)
    `);
  }
}

function computeTrendScore(category: string, currentDate: Date): number {
  const month = currentDate.getMonth();
  const seasonalCurve: Record<number, number> = {
    0: 0.15, 1: 0.10, 2: 0.08, 3: 0.07, 4: 0.08, 5: 0.12,
    6: 0.18, 7: 0.25, 8: 0.45, 9: 0.75, 10: 0.90, 11: 1.00,
  };
  const categoryModifiers: Record<string, number> = {
    lighting: 1.2, decorations: 1.15, hardware: 1.1, specialty: 1.3,
    accessories: 0.9, supplies: 0.85, storage: 0.7,
  };
  const base = seasonalCurve[month] ?? 0.5;
  const mod = categoryModifiers[category] ?? 1.0;
  return Math.min(1.0, base * mod);
}

function computeWeatherScore(currentDate: Date): number {
  const month = currentDate.getMonth();
  const weatherCurve: Record<number, number> = {
    0: 0.20, 1: 0.15, 2: 0.10, 3: 0.08, 4: 0.07, 5: 0.08,
    6: 0.12, 7: 0.20, 8: 0.40, 9: 0.70, 10: 0.85, 11: 0.95,
  };
  return weatherCurve[month] ?? 0.5;
}

function computeStockoutRisk(
  currentInventory: number,
  forecastedDemand: number,
  leadTimeDays: number
): { risk: 'high' | 'medium' | 'low'; daysUntilStockout: number | null } {
  if (forecastedDemand <= 0) {
    return { risk: 'low', daysUntilStockout: null };
  }
  const coverageDays = (currentInventory / forecastedDemand) * 30;
  const reorderBuffer = leadTimeDays * 1.5;
  let risk: 'high' | 'medium' | 'low';
  if (coverageDays < leadTimeDays) {
    risk = 'high';
  } else if (coverageDays < reorderBuffer) {
    risk = 'medium';
  } else {
    risk = 'low';
  }
  return { risk, daysUntilStockout: coverageDays < 180 ? Math.round(coverageDays) : null };
}

export async function runDemandForecast(): Promise<{
  runId: string;
  skusAnalyzed: number;
  highRiskCount: number;
  forecasts: SkuForecast[];
}> {
  const client = await pool.connect();
  try {
    await ensureTables(client);
    const now = new Date();
    const { rows: skus } = await client.query<{
      id: string;
      name: string;
      category: string;
      current_inventory: number;
      lead_time_days: number;
    }>('SELECT id, name, category, current_inventory, lead_time_days FROM brightworks_skus ORDER BY name');

    const forecasts: SkuForecast[] = [];
    let highRiskCount = 0;

    const { rows: runRows } = await client.query<{ id: string }>(
      'INSERT INTO brightworks_forecast_runs (skus_analyzed, high_risk_count) VALUES ($1, $2) RETURNING id',
      [skus.length, 0]
    );
    const runId = runRows[0].id;

    for (const sku of skus) {
      const trendScore = computeTrendScore(sku.category, now);
      const weatherScore = computeWeatherScore(now);
      const combined = trendScore * 0.6 + weatherScore * 0.4;
      const baseDemand = Math.round(50 + combined * 200);
      const forecastedDemand = Math.round(baseDemand * (0.85 + Math.random() * 0.3));
      const { risk, daysUntilStockout } = computeStockoutRisk(
        sku.current_inventory,
        forecastedDemand,
        sku.lead_time_days
      );
      if (risk === 'high') highRiskCount++;
      const octoberDeadline = now.getMonth() <= 9 && risk !== 'low';

      await client.query(
        `INSERT INTO brightworks_demand_forecasts
           (sku_id, run_id, forecasted_demand, trend_score, weather_score, stockout_risk, days_until_stockout)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [sku.id, runId, forecastedDemand, trendScore, weatherScore, risk, daysUntilStockout]
      );

      forecasts.push({
        sku_id: sku.id,
        sku_name: sku.name,
        current_inventory: sku.current_inventory,
        forecasted_demand: forecastedDemand,
        trend_score: trendScore,
        weather_score: weatherScore,
        stockout_risk: risk,
        days_until_stockout: daysUntilStockout,
        october_deadline: octoberDeadline,
      });
    }

    await client.query(
      'UPDATE brightworks_forecast_runs SET high_risk_count = $1 WHERE id = $2',
      [highRiskCount, runId]
    );

    return { runId, skusAnalyzed: skus.length, highRiskCount, forecasts };
  } finally {
    client.release();
  }
}

export async function getLatestForecasts(): Promise<SkuForecast[]> {
  const client = await pool.connect();
  try {
    await ensureTables(client);
    const { rows: runs } = await client.query<{ id: string }>(
      'SELECT id FROM brightworks_forecast_runs ORDER BY run_at DESC LIMIT 1'
    );

    if (runs.length === 0) {
      const { rows: skus } = await client.query<{
        id: string;
        name: string;
        current_inventory: number;
      }>('SELECT id, name, current_inventory FROM brightworks_skus ORDER BY name');
      return skus.map((sku) => ({
        sku_id: sku.id,
        sku_name: sku.name,
        current_inventory: sku.current_inventory,
        forecasted_demand: 0,
        trend_score: 0,
        weather_score: 0,
        stockout_risk: 'low' as const,
        days_until_stockout: null,
        october_deadline: false,
      }));
    }

    const runId = runs[0].id;
    const { rows } = await client.query<{
      sku_id: string;
      sku_name: string;
      current_inventory: number;
      forecasted_demand: number;
      trend_score: string;
      weather_score: string;
      stockout_risk: string;
      days_until_stockout: number | null;
    }>(
      `SELECT df.sku_id, s.name AS sku_name, s.current_inventory,
              df.forecasted_demand, df.trend_score::text, df.weather_score::text,
              df.stockout_risk, df.days_until_stockout
       FROM brightworks_demand_forecasts df
       JOIN brightworks_skus s ON s.id = df.sku_id
       WHERE df.run_id = $1
       ORDER BY
         CASE df.stockout_risk WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
         df.days_until_stockout NULLS LAST`,
      [runId]
    );

    const now = new Date();
    return rows.map((row) => ({
      sku_id: row.sku_id,
      sku_name: row.sku_name,
      current_inventory: row.current_inventory,
      forecasted_demand: row.forecasted_demand,
      trend_score: parseFloat(row.trend_score),
      weather_score: parseFloat(row.weather_score),
      stockout_risk: row.stockout_risk as 'high' | 'medium' | 'low',
      days_until_stockout: row.days_until_stockout,
      october_deadline: now.getMonth() <= 9 && row.stockout_risk !== 'low',
    }));
  } finally {
    client.release();
  }
}

export async function getRecentRuns(limit: number = 5): Promise<ForecastRun[]> {
  const client = await pool.connect();
  try {
    await ensureTables(client);
    const { rows } = await client.query<{
      id: string;
      run_at: string;
      skus_analyzed: number;
      high_risk_count: number;
    }>(
      'SELECT id, run_at, skus_analyzed, high_risk_count FROM brightworks_forecast_runs ORDER BY run_at DESC LIMIT $1',
      [limit]
    );
    return rows.map((row) => ({
      id: row.id,
      run_at: new Date(row.run_at).toISOString(),
      skus_analyzed: row.skus_analyzed,
      high_risk_count: row.high_risk_count,
    }));
  } finally {
    client.release();
  }
}
