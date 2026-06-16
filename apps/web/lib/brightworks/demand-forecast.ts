import { Pool } from 'pg';

let _pool: Pool | null = null;

function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return _pool;
}

export interface SkuRecord {
  id: string;
  name: string;
  sku_code: string;
  category: string;
  current_inventory: number;
  reorder_point: number;
  lead_time_days: number;
}

export interface DemandForecast {
  id: string;
  sku_name: string;
  sku_code: string;
  category: string;
  current_inventory: number;
  reorder_point: number;
  forecasted_demand: number;
  trend_score: number;
  weather_score: number;
  replenishment_qty: number;
  stockout_risk: 'high' | 'medium' | 'low';
  days_to_deadline: number;
  recommendation_notes: string;
  last_updated: Date | null;
}

export interface ReplenishmentRecommendation {
  sku_code: string;
  sku_name: string;
  current_inventory: number;
  forecasted_demand: number;
  replenishment_qty: number;
  stockout_risk: 'high' | 'medium' | 'low';
  trend_score: number;
  weather_score: number;
  recommendation_notes: string;
}

const SEED_SKUS = [
  { name: 'Winter Parka XL', sku_code: 'WP-XL-001', category: 'Outerwear', current_inventory: 245, reorder_point: 100, lead_time_days: 21 },
  { name: 'Thermal Base Layer Set', sku_code: 'TBL-SET-002', category: 'Layering', current_inventory: 180, reorder_point: 80, lead_time_days: 14 },
  { name: 'Snow Boots Size 10', sku_code: 'SB-10-003', category: 'Footwear', current_inventory: 95, reorder_point: 120, lead_time_days: 28 },
  { name: 'Insulated Gloves L', sku_code: 'IG-L-004', category: 'Accessories', current_inventory: 320, reorder_point: 150, lead_time_days: 14 },
  { name: 'Ski Jacket Pro', sku_code: 'SJ-PRO-005', category: 'Outerwear', current_inventory: 60, reorder_point: 100, lead_time_days: 35 },
  { name: 'Fleece Pullover M', sku_code: 'FP-M-006', category: 'Layering', current_inventory: 410, reorder_point: 200, lead_time_days: 14 },
  { name: 'Winter Beanie Pack', sku_code: 'WB-PACK-007', category: 'Accessories', current_inventory: 580, reorder_point: 250, lead_time_days: 7 },
  { name: 'Snow Pants XL', sku_code: 'SP-XL-008', category: 'Outerwear', current_inventory: 75, reorder_point: 100, lead_time_days: 21 },
  { name: 'Heated Vest', sku_code: 'HV-009', category: 'Layering', current_inventory: 40, reorder_point: 80, lead_time_days: 42 },
  { name: 'Cold Weather Socks 6pk', sku_code: 'CWS-6PK-010', category: 'Accessories', current_inventory: 720, reorder_point: 300, lead_time_days: 7 },
];

export async function initializeTables(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS brightworks_skus (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        sku_code TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        current_inventory INTEGER NOT NULL DEFAULT 0,
        reorder_point INTEGER NOT NULL DEFAULT 50,
        lead_time_days INTEGER NOT NULL DEFAULT 14,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS brightworks_demand_forecasts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sku_id UUID NOT NULL REFERENCES brightworks_skus(id) ON DELETE CASCADE,
        forecasted_demand INTEGER NOT NULL,
        trend_score NUMERIC(5,2) NOT NULL DEFAULT 0,
        weather_score NUMERIC(5,2) NOT NULL DEFAULT 0,
        replenishment_qty INTEGER NOT NULL DEFAULT 0,
        stockout_risk TEXT NOT NULL DEFAULT 'low',
        recommendation_notes TEXT NOT NULL DEFAULT '',
        forecast_period DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const countResult = await client.query<{ cnt: string }>(
      'SELECT COUNT(*) as cnt FROM brightworks_skus'
    );
    if (parseInt(countResult.rows[0].cnt, 10) === 0) {
      for (const sku of SEED_SKUS) {
        await client.query(
          `INSERT INTO brightworks_skus (name, sku_code, category, current_inventory, reorder_point, lead_time_days)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [sku.name, sku.sku_code, sku.category, sku.current_inventory, sku.reorder_point, sku.lead_time_days]
        );
      }
    }
  } finally {
    client.release();
  }
}

export async function getDashboardData(): Promise<DemandForecast[]> {
  await initializeTables();
  const pool = getPool();

  const result = await pool.query<{
    id: string;
    sku_name: string;
    sku_code: string;
    category: string;
    current_inventory: string;
    reorder_point: string;
    forecasted_demand: string;
    trend_score: string;
    weather_score: string;
    replenishment_qty: string;
    stockout_risk: string;
    recommendation_notes: string;
    last_updated: Date | null;
  }>(`
    SELECT
      s.id,
      s.name AS sku_name,
      s.sku_code,
      s.category,
      s.current_inventory,
      s.reorder_point,
      COALESCE(f.forecasted_demand, 0) AS forecasted_demand,
      COALESCE(f.trend_score, 0) AS trend_score,
      COALESCE(f.weather_score, 0) AS weather_score,
      COALESCE(f.replenishment_qty, 0) AS replenishment_qty,
      COALESCE(f.stockout_risk, 'low') AS stockout_risk,
      COALESCE(f.recommendation_notes, 'Forecast pending — run cron to generate') AS recommendation_notes,
      f.created_at AS last_updated
    FROM brightworks_skus s
    LEFT JOIN brightworks_demand_forecasts f ON s.id = f.sku_id
      AND f.created_at = (
        SELECT MAX(f2.created_at)
        FROM brightworks_demand_forecasts f2
        WHERE f2.sku_id = s.id
      )
    ORDER BY
      CASE COALESCE(f.stockout_risk, 'low')
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        ELSE 3
      END,
      s.name
  `);

  const octDeadline = new Date('2026-10-01T00:00:00Z');
  const today = new Date();
  const daysToDeadline = Math.max(
    0,
    Math.ceil((octDeadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  );

  return result.rows.map((row) => ({
    id: row.id,
    sku_name: row.sku_name,
    sku_code: row.sku_code,
    category: row.category,
    current_inventory: parseInt(row.current_inventory, 10),
    reorder_point: parseInt(row.reorder_point, 10),
    forecasted_demand: parseInt(row.forecasted_demand, 10),
    trend_score: parseFloat(row.trend_score),
    weather_score: parseFloat(row.weather_score),
    replenishment_qty: parseInt(row.replenishment_qty, 10),
    stockout_risk: row.stockout_risk as 'high' | 'medium' | 'low',
    days_to_deadline: daysToDeadline,
    recommendation_notes: row.recommendation_notes,
    last_updated: row.last_updated,
  }));
}

export async function storeRecommendations(
  recommendations: ReplenishmentRecommendation[]
): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    for (const rec of recommendations) {
      await client.query(
        `INSERT INTO brightworks_demand_forecasts
           (sku_id, forecasted_demand, trend_score, weather_score, replenishment_qty, stockout_risk, recommendation_notes)
         SELECT id, $1, $2, $3, $4, $5, $6
         FROM brightworks_skus
         WHERE sku_code = $7`,
        [
          rec.forecasted_demand,
          rec.trend_score,
          rec.weather_score,
          rec.replenishment_qty,
          rec.stockout_risk,
          rec.recommendation_notes,
          rec.sku_code,
        ]
      );
    }
  } finally {
    client.release();
  }
}

// Returns a seasonal trend score 0-100 based on current month and optional live fetch
export async function fetchGoogleTrendsSignal(keywords: string[]): Promise<number> {
  const today = new Date();
  const month = today.getMonth() + 1;

  // Seasonal interest curve for winter apparel (based on historical Google Trends patterns)
  const monthScores: Record<number, number> = {
    1: 45, 2: 35, 3: 20, 4: 15, 5: 10,
    6: 8, 7: 12, 8: 28, 9: 58, 10: 82,
    11: 92, 12: 78,
  };
  const baseScore = monthScores[month] ?? 50;

  try {
    // Attempt live Google Trends explore API (unofficial, best-effort)
    const req = JSON.stringify({
      comparisonItem: keywords.slice(0, 3).map((kw) => ({
        keyword: kw, geo: 'US', time: 'today 3-m',
      })),
      category: 0,
      property: '',
    });
    const url = `https://trends.google.com/trends/api/explore?hl=en-US&tz=300&req=${encodeURIComponent(req)}`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BrightworksBot/1.0)' },
      signal: AbortSignal.timeout(4000),
    });
    if (!resp.ok) return baseScore;

    const text = await resp.text();
    // Strip XSSI prefix ")]}'\n" before parsing
    const stripped = text.replace(/^\)\]\}'\n/, '');
    const parsed = JSON.parse(stripped) as {
      widgets?: Array<{ averages?: number[] }>;
    };
    const widget = parsed.widgets?.find((w) => Array.isArray(w.averages));
    if (widget?.averages && widget.averages.length > 0) {
      const avg = widget.averages.reduce((a, b) => a + b, 0) / widget.averages.length;
      // Blend live data (70%) with seasonal model (30%)
      return Math.round(avg * 0.7 + baseScore * 0.3);
    }
  } catch {
    // Network errors or parse failures → fall through to seasonal model
  }

  return baseScore;
}

// Returns a weather-onset demand multiplier 0-100 based on temperature drop signals
export async function fetchWeatherOnsetSignal(): Promise<number> {
  // Key installer/retail markets for winter goods
  const cities = [
    { name: 'Chicago', lat: 41.85, lon: -87.65 },
    { name: 'Minneapolis', lat: 44.98, lon: -93.27 },
    { name: 'Denver', lat: 39.74, lon: -104.98 },
    { name: 'Boston', lat: 42.36, lon: -71.06 },
    { name: 'Portland', lat: 45.52, lon: -122.68 },
  ];

  try {
    const scores: number[] = [];
    await Promise.all(
      cities.map(async (city) => {
        const url =
          `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}` +
          `&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&forecast_days=7&timezone=auto`;
        const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!resp.ok) return;
        const data = (await resp.json()) as {
          daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[] };
        };
        const maxTemps = data.daily?.temperature_2m_max ?? [];
        const minTemps = data.daily?.temperature_2m_min ?? [];
        if (maxTemps.length === 0) return;

        const avgHigh = maxTemps.reduce((a, b) => a + b, 0) / maxTemps.length;
        const avgLow = minTemps.reduce((a, b) => a + b, 0) / minTemps.length;
        const avgTemp = (avgHigh + avgLow) / 2;

        // Demand score: colder temps drive higher winter goods demand
        // 70°F → score 0; 20°F → score 100; linear interpolation
        const score = Math.min(100, Math.max(0, Math.round(((70 - avgTemp) / 50) * 100)));
        scores.push(score);
      })
    );

    if (scores.length === 0) return getSeasonalWeatherFallback();
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  } catch {
    return getSeasonalWeatherFallback();
  }
}

function getSeasonalWeatherFallback(): number {
  const month = new Date().getMonth() + 1;
  const fallback: Record<number, number> = {
    1: 85, 2: 80, 3: 55, 4: 30, 5: 15,
    6: 5, 7: 5, 8: 15, 9: 40, 10: 70,
    11: 85, 12: 90,
  };
  return fallback[month] ?? 50;
}

export function computeStockoutRisk(
  currentInventory: number,
  forecastedDemand: number,
  leadTimeDays: number,
  daysToDeadline: number
): 'high' | 'medium' | 'low' {
  if (forecastedDemand === 0) return 'low';
  const coverageRatio = currentInventory / forecastedDemand;
  const leadTimeBuffer = leadTimeDays / Math.max(1, daysToDeadline);

  if (coverageRatio < 0.8 || (coverageRatio < 1.0 && leadTimeBuffer > 0.6)) {
    return 'high';
  }
  if (coverageRatio < 1.2 || leadTimeBuffer > 0.4) {
    return 'medium';
  }
  return 'low';
}

export async function generateReplenishmentRecommendations(): Promise<
  ReplenishmentRecommendation[]
> {
  await initializeTables();
  const pool = getPool();

  const skusResult = await pool.query<{
    id: string;
    name: string;
    sku_code: string;
    category: string;
    current_inventory: string;
    reorder_point: string;
    lead_time_days: string;
  }>('SELECT id, name, sku_code, category, current_inventory, reorder_point, lead_time_days FROM brightworks_skus');

  const winterKeywords = ['winter jacket', 'snow boots', 'thermal wear', 'ski gear'];
  const [trendScore, weatherScore] = await Promise.all([
    fetchGoogleTrendsSignal(winterKeywords),
    fetchWeatherOnsetSignal(),
  ]);

  const octDeadline = new Date('2026-10-01T00:00:00Z');
  const today = new Date();
  const daysToDeadline = Math.max(
    0,
    Math.ceil((octDeadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  );

  // Category-specific demand multipliers (outerwear peaks earlier than accessories)
  const categoryMultiplier: Record<string, number> = {
    Outerwear: 1.4,
    Footwear: 1.3,
    Layering: 1.2,
    Accessories: 1.1,
  };

  const recommendations: ReplenishmentRecommendation[] = [];

  for (const row of skusResult.rows) {
    const currentInventory = parseInt(row.current_inventory, 10);
    const reorderPoint = parseInt(row.reorder_point, 10);
    const leadTimeDays = parseInt(row.lead_time_days, 10);
    const catMult = categoryMultiplier[row.category] ?? 1.0;

    // Demand model: base = reorder_point * seasonal_signal
    const seasonalSignal = ((trendScore + weatherScore) / 200) * catMult;
    const forecastedDemand = Math.round(reorderPoint * (1 + seasonalSignal));

    const stockoutRisk = computeStockoutRisk(
      currentInventory,
      forecastedDemand,
      leadTimeDays,
      daysToDeadline
    );

    // Replenishment = target stock (demand * 1.3 safety factor) - current
    const targetStock = Math.round(forecastedDemand * 1.3);
    const replenishmentQty = Math.max(0, targetStock - currentInventory);

    let notes = `Trend signal: ${trendScore}/100 · Weather onset: ${weatherScore}/100. `;
    if (stockoutRisk === 'high') {
      notes += `URGENT: ${daysToDeadline}d to Oct sell-in deadline — order ${replenishmentQty} units immediately (${leadTimeDays}d lead time).`;
    } else if (stockoutRisk === 'medium') {
      notes += `Monitor closely — current stock covers ${Math.round((currentInventory / forecastedDemand) * 100)}% of forecast. Consider ordering ${replenishmentQty} units.`;
    } else {
      notes += `Stock sufficient. Review again in 2 weeks or when trend score exceeds 75.`;
    }

    recommendations.push({
      sku_code: row.sku_code,
      sku_name: row.name,
      current_inventory: currentInventory,
      forecasted_demand: forecastedDemand,
      replenishment_qty: replenishmentQty,
      stockout_risk: stockoutRisk,
      trend_score: trendScore,
      weather_score: weatherScore,
      recommendation_notes: notes,
    });
  }

  return recommendations;
}
