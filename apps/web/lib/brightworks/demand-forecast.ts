/**
 * Seasonal demand forecasting logic for Brightworks.
 *
 * Ingests Google Trends holiday search volume scores and regional weather-onset
 * indices to produce per-SKU weekly demand forecasts and replenishment
 * recommendations. Targets the October sell-in deadline (the primary
 * operational risk for a single-season physical goods business).
 */

import { buildDb } from "@/lib/db";

type Db = ReturnType<typeof buildDb>;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface Sku {
  id: string;
  sku_code: string;
  name: string;
  category: string;
  unit_cost: number;
  wholesale_price: number;
  retail_price: number;
  base_weekly_sales: number;
  current_inventory: number;
  reorder_point: number;
  lead_time_days: number;
  created_at: string;
  updated_at: string;
}

export interface DemandForecast {
  id: string;
  sku_id: string;
  forecast_date: string;
  period: "weekly" | "monthly";
  forecasted_units: number;
  trend_score: number;
  weather_index: number;
  confidence: number;
  notes: string | null;
  created_at: string;
}

export type StockoutRisk = "low" | "medium" | "high" | "critical";

export interface ForecastWithSku {
  id: string;
  sku_id: string;
  forecast_date: string;
  period: string;
  forecasted_units: number;
  trend_score: number;
  weather_index: number;
  confidence: number;
  notes: string | null;
  created_at: string;
  sku_code: string;
  sku_name: string;
  category: string;
  current_inventory: number;
  reorder_point: number;
  lead_time_days: number;
  stockout_risk: StockoutRisk;
  days_of_stock_remaining: number;
  units_to_order: number;
}

export interface ForecastSummary {
  total_skus: number;
  critical_skus: number;
  high_risk_skus: number;
  medium_risk_skus: number;
  last_run_at: string | null;
}

// ---------------------------------------------------------------------------
// Seasonal demand model
// ---------------------------------------------------------------------------

// Monthly baseline multipliers (0 = January … 11 = December).
// Calibrated for seasonal home goods / outdoor lighting (US market).
const SEASONAL_MULTIPLIERS: readonly number[] = [
  0.55, // Jan — post-holiday slump
  0.60, // Feb
  0.72, // Mar — spring onset
  0.82, // Apr
  0.88, // May
  0.78, // Jun
  0.68, // Jul — summer lull
  0.74, // Aug
  0.92, // Sep — pre-holiday ramp
  1.25, // Oct — peak sell-in
  1.48, // Nov — holiday season
  1.52, // Dec — peak holiday
];

// Extra demand boosts applied over the seasonal baseline by month/day range.
const HOLIDAY_BOOSTS: ReadonlyArray<{
  month: number;
  dayStart: number;
  dayEnd: number;
  boost: number;
}> = [
  { month: 9, dayStart: 1, dayEnd: 31, boost: 1.25 },   // All of October
  { month: 10, dayStart: 15, dayEnd: 22, boost: 1.4 },  // Week before Thanksgiving
  { month: 10, dayStart: 23, dayEnd: 30, boost: 1.9 },  // Black Friday week
  { month: 11, dayStart: 1, dayEnd: 24, boost: 1.75 },  // Christmas shopping
];

/**
 * Compute a seasonal demand index (multiplier) for a given date.
 * Returns a value in [0.5, 2.5].
 */
export function computeSeasonalDemandIndex(date: Date): number {
  const month = date.getMonth();
  const day = date.getDate();
  let multiplier = SEASONAL_MULTIPLIERS[month];

  for (const boost of HOLIDAY_BOOSTS) {
    if (month === boost.month && day >= boost.dayStart && day <= boost.dayEnd) {
      multiplier = Math.max(multiplier, SEASONAL_MULTIPLIERS[month] * boost.boost);
    }
  }

  return Math.min(Math.max(multiplier, 0.5), 2.5);
}

/**
 * Simulate a Google Trends score (0–100) for a product category on a given date.
 * In production this would call the SerpAPI / pytrends endpoint; here we derive
 * a realistic score from the seasonal model plus category-specific weighting.
 */
export function simulateGoogleTrendsScore(category: string, date: Date): number {
  const seasonalIndex = computeSeasonalDemandIndex(date);

  const categoryWeights: Record<string, number> = {
    lighting: 1.2,
    outdoor: 1.1,
    seasonal: 1.45,
    decorative: 1.3,
    default: 1.0,
  };

  const catWeight = categoryWeights[category.toLowerCase()] ?? categoryWeights.default;

  // Introduce a small stochastic variance (±8 %) so repeated calls differ
  // slightly, simulating real-world trend fluctuation.
  const noise = 0.92 + Math.random() * 0.16;

  return Math.min(100, Math.round(seasonalIndex * catWeight * noise * 62));
}

/**
 * Return a normalised weather-onset index in [0, 1] for a US region and date.
 * Higher values indicate conditions that drive demand for seasonal home goods.
 */
export function computeWeatherIndex(date: Date, region = "US"): number {
  const month = date.getMonth();

  const regionProfiles: Record<string, readonly number[]> = {
    US: [0.30, 0.35, 0.50, 0.60, 0.70, 0.65, 0.55, 0.60, 0.76, 0.86, 0.91, 0.80],
    Northeast: [0.20, 0.25, 0.45, 0.55, 0.65, 0.60, 0.50, 0.55, 0.72, 0.92, 0.96, 0.85],
    South: [0.40, 0.45, 0.60, 0.70, 0.80, 0.75, 0.65, 0.70, 0.80, 0.75, 0.80, 0.70],
    Midwest: [0.15, 0.20, 0.40, 0.55, 0.65, 0.60, 0.50, 0.55, 0.76, 0.95, 1.00, 0.90],
    West: [0.45, 0.50, 0.65, 0.70, 0.80, 0.75, 0.70, 0.75, 0.80, 0.80, 0.85, 0.75],
  };

  const profile = regionProfiles[region] ?? regionProfiles.US;
  return profile[month];
}

/**
 * Combine a base sales rate with trend and weather signals to produce a daily
 * demand estimate (rounded to whole units).
 */
export function calculateDailyDemand(
  baseDailySales: number,
  trendsScore: number,
  weatherIndex: number,
): number {
  // Normalise signals around 1.0 at their typical values.
  const trendWeight = trendsScore / 62;    // 62 ≈ average score at neutral season
  const weatherWeight = weatherIndex / 0.65; // 0.65 ≈ average index

  const combined = baseDailySales * (0.5 * trendWeight + 0.5 * weatherWeight);
  return Math.max(0, Math.round(combined));
}

/**
 * Classify stockout risk based on remaining inventory vs. lead time.
 */
export function calculateStockoutRisk(
  currentInventory: number,
  dailyDemand: number,
  leadTimeDays: number,
): StockoutRisk {
  if (dailyDemand <= 0) return "low";
  const daysOfStock = currentInventory / dailyDemand;
  if (daysOfStock <= leadTimeDays * 0.5) return "critical";
  if (daysOfStock <= leadTimeDays) return "high";
  if (daysOfStock <= leadTimeDays * 1.5) return "medium";
  return "low";
}

/**
 * Calculate the number of units to order to reach a target weeks-of-stock
 * buffer beyond the replenishment lead time.
 */
export function calculateUnitsToOrder(
  currentInventory: number,
  weeklyForecast: number,
  leadTimeDays: number,
  targetWeeksOfStock = 8,
): number {
  const dailyDemand = weeklyForecast / 7;
  const safetyStock = dailyDemand * leadTimeDays * 2;
  const targetInventory = safetyStock + weeklyForecast * targetWeeksOfStock;
  return Math.max(0, Math.round(targetInventory - currentInventory));
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

/**
 * Ensure the brightworks-specific tables exist and seed sample SKUs when empty.
 * Uses CREATE TABLE IF NOT EXISTS so this is safe to call on every cron run.
 */
export async function ensureTablesExist(db: Db): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS brightworks_skus (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sku_code          TEXT NOT NULL UNIQUE,
      name              TEXT NOT NULL,
      category          TEXT NOT NULL,
      unit_cost         NUMERIC(10,2) NOT NULL DEFAULT 0,
      wholesale_price   NUMERIC(10,2) NOT NULL DEFAULT 0,
      retail_price      NUMERIC(10,2) NOT NULL DEFAULT 0,
      base_weekly_sales INTEGER NOT NULL DEFAULT 10,
      current_inventory INTEGER NOT NULL DEFAULT 0,
      reorder_point     INTEGER NOT NULL DEFAULT 0,
      lead_time_days    INTEGER NOT NULL DEFAULT 14,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS brightworks_demand_forecasts (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sku_id           UUID NOT NULL REFERENCES brightworks_skus(id) ON DELETE CASCADE,
      forecast_date    DATE NOT NULL,
      period           TEXT NOT NULL DEFAULT 'weekly',
      forecasted_units INTEGER NOT NULL DEFAULT 0,
      trend_score      NUMERIC(5,2) NOT NULL DEFAULT 0,
      weather_index    NUMERIC(5,2) NOT NULL DEFAULT 0,
      confidence       NUMERIC(5,2) NOT NULL DEFAULT 0,
      notes            TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (sku_id, forecast_date, period)
    )
  `);

  const countRows = await db.query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM brightworks_skus`,
  );
  const count = parseInt(countRows[0]?.cnt ?? "0", 10);
  if (count === 0) {
    await seedSampleSkus(db);
  }
}

async function seedSampleSkus(db: Db): Promise<void> {
  const skus = [
    { code: "BW-LT-001", name: "LED String Lights 25ft",     cat: "lighting",   cost: 12.50, ws: 24.99, rt: 49.99, base: 45, inv: 380, rp: 90,  lt: 21 },
    { code: "BW-LT-002", name: "Solar Path Lights 6-pack",   cat: "lighting",   cost: 18.00, ws: 35.99, rt: 69.99, base: 30, inv: 240, rp: 60,  lt: 14 },
    { code: "BW-LT-003", name: "Outdoor Spotlights 2-pack",  cat: "lighting",   cost: 22.00, ws: 44.99, rt: 89.99, base: 20, inv: 180, rp: 40,  lt: 14 },
    { code: "BW-LT-004", name: "Icicle Lights 9ft",          cat: "lighting",   cost: 10.00, ws: 19.99, rt: 39.99, base: 60, inv: 210, rp: 120, lt: 14 },
    { code: "BW-DC-001", name: "Holiday Wreath 24in",        cat: "decorative", cost: 15.00, ws: 29.99, rt: 59.99, base: 55, inv: 420, rp: 110, lt: 28 },
    { code: "BW-DC-002", name: "Seasonal Door Mat",          cat: "decorative", cost:  8.50, ws: 17.99, rt: 34.99, base: 35, inv: 290, rp: 70,  lt: 14 },
    { code: "BW-OS-001", name: "Weather Seal Kit",           cat: "outdoor",    cost:  9.00, ws: 18.99, rt: 37.99, base: 25, inv:  95, rp: 50,  lt: 10 },
    { code: "BW-OS-002", name: "Gutter Guard 10ft",          cat: "outdoor",    cost: 14.00, ws: 27.99, rt: 54.99, base: 18, inv: 140, rp: 36,  lt: 14 },
    { code: "BW-SN-001", name: "Snow Blower Attachment",     cat: "seasonal",   cost: 45.00, ws: 89.99, rt: 179.99, base: 12, inv: 65, rp: 24,  lt: 21 },
    { code: "BW-SN-002", name: "Ice Melt 20lb Bag",          cat: "seasonal",   cost:  6.00, ws: 12.99, rt: 24.99, base: 40, inv: 320, rp: 80,  lt:  7 },
  ] as const;

  for (const sku of skus) {
    await db.execute(
      `INSERT INTO brightworks_skus
         (sku_code, name, category, unit_cost, wholesale_price, retail_price,
          base_weekly_sales, current_inventory, reorder_point, lead_time_days)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (sku_code) DO NOTHING`,
      sku.code, sku.name, sku.cat, sku.cost, sku.ws, sku.rt,
      sku.base, sku.inv, sku.rp, sku.lt,
    );
  }
}

/** Return all SKUs ordered by category then code. */
export async function listSkus(db: Db): Promise<Sku[]> {
  try {
    return await db.query<Sku>(
      `SELECT id, sku_code, name, category, unit_cost, wholesale_price, retail_price,
              base_weekly_sales, current_inventory, reorder_point, lead_time_days,
              created_at, updated_at
         FROM brightworks_skus
        ORDER BY category, sku_code`,
    );
  } catch {
    return [];
  }
}

/**
 * Generate a weekly demand forecast for one SKU on a given date and upsert it
 * into brightworks_demand_forecasts.  Returns the persisted row or null on error.
 */
export async function generateAndStoreForecast(
  db: Db,
  sku: Sku,
  forecastDate: Date,
): Promise<DemandForecast | null> {
  try {
    const trendsScore = simulateGoogleTrendsScore(sku.category, forecastDate);
    const weatherIndex = computeWeatherIndex(forecastDate);

    const dailyDemand = calculateDailyDemand(
      sku.base_weekly_sales / 7,
      trendsScore,
      weatherIndex,
    );
    const weeklyForecast = dailyDemand * 7;

    // Confidence rises when both trend and weather signals are strong.
    const confidence = Math.min(
      0.95,
      0.45 + 0.28 * (trendsScore / 100) + 0.27 * weatherIndex,
    );

    const notes = `Trends score: ${trendsScore}/100; Weather index: ${weatherIndex.toFixed(2)}`;
    const dateStr = forecastDate.toISOString().split("T")[0];

    const rows = await db.query<DemandForecast>(
      `INSERT INTO brightworks_demand_forecasts
         (sku_id, forecast_date, period, forecasted_units, trend_score, weather_index, confidence, notes)
       VALUES ($1, $2, 'weekly', $3, $4, $5, $6, $7)
       ON CONFLICT (sku_id, forecast_date, period) DO UPDATE SET
         forecasted_units = EXCLUDED.forecasted_units,
         trend_score      = EXCLUDED.trend_score,
         weather_index    = EXCLUDED.weather_index,
         confidence       = EXCLUDED.confidence,
         notes            = EXCLUDED.notes
       RETURNING id, sku_id, forecast_date::text, period, forecasted_units,
                 trend_score, weather_index, confidence, notes, created_at::text`,
      sku.id, dateStr, weeklyForecast, trendsScore, weatherIndex, confidence, notes,
    );

    return rows[0] ?? null;
  } catch (err) {
    console.error(JSON.stringify({ event: "demand_forecast_store_error", sku_id: sku.id, error: String(err) }));
    return null;
  }
}

/**
 * Load the most-recent weekly forecast for every SKU, enriched with stockout
 * risk classification and replenishment quantity.
 */
export async function loadForecastsWithRisk(db: Db): Promise<ForecastWithSku[]> {
  try {
    type Row = {
      id: string; sku_id: string; forecast_date: string; period: string;
      forecasted_units: number; trend_score: number; weather_index: number;
      confidence: number; notes: string | null; created_at: string;
      sku_code: string; sku_name: string; category: string;
      current_inventory: number; reorder_point: number; lead_time_days: number;
    };

    const rows = await db.query<Row>(
      `SELECT DISTINCT ON (df.sku_id)
              df.id, df.sku_id, df.forecast_date::text, df.period,
              df.forecasted_units, df.trend_score, df.weather_index,
              df.confidence, df.notes, df.created_at::text,
              s.sku_code, s.name AS sku_name, s.category,
              s.current_inventory, s.reorder_point, s.lead_time_days
         FROM brightworks_demand_forecasts df
         JOIN brightworks_skus s ON s.id = df.sku_id
        WHERE df.period = 'weekly'
        ORDER BY df.sku_id, df.forecast_date DESC`,
    );

    return rows.map((row) => {
      const dailyDemand = row.forecasted_units > 0 ? row.forecasted_units / 7 : 0;
      const daysOfStockRemaining =
        dailyDemand > 0 ? Math.round(row.current_inventory / dailyDemand) : 999;

      const stockoutRisk = calculateStockoutRisk(
        row.current_inventory,
        dailyDemand,
        row.lead_time_days,
      );

      const unitsToOrder = calculateUnitsToOrder(
        row.current_inventory,
        row.forecasted_units,
        row.lead_time_days,
      );

      return {
        ...row,
        stockout_risk: stockoutRisk,
        days_of_stock_remaining: daysOfStockRemaining,
        units_to_order: unitsToOrder,
      };
    });
  } catch {
    return [];
  }
}

/** Return aggregate counts needed for the dashboard summary cards. */
export async function getForecastSummary(db: Db): Promise<ForecastSummary> {
  try {
    const [countRow] = await db.query<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM brightworks_skus`,
    );
    const [lastRunRow] = await db.query<{ last_run: string | null }>(
      `SELECT MAX(created_at)::text AS last_run FROM brightworks_demand_forecasts`,
    );

    const forecasts = await loadForecastsWithRisk(db);
    const criticalSkus = forecasts.filter((f) => f.stockout_risk === "critical").length;
    const highRiskSkus = forecasts.filter((f) => f.stockout_risk === "high").length;
    const mediumRiskSkus = forecasts.filter((f) => f.stockout_risk === "medium").length;

    return {
      total_skus: parseInt(countRow?.cnt ?? "0", 10),
      critical_skus: criticalSkus,
      high_risk_skus: highRiskSkus,
      medium_risk_skus: mediumRiskSkus,
      last_run_at: lastRunRow?.last_run ?? null,
    };
  } catch {
    return { total_skus: 0, critical_skus: 0, high_risk_skus: 0, medium_risk_skus: 0, last_run_at: null };
  }
}
