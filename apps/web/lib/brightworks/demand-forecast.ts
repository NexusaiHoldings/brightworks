/**
 * Brightworks seasonal demand forecasting core library.
 *
 * Ingests Google Trends holiday search volume and regional weather-onset data
 * to produce per-SKU inventory replenishment recommendations. All DB access
 * uses raw SQL via pg (no ORM).
 */

import crypto from "crypto";
import {
  computeSeasonalMultiplier,
  computeReplenishmentUnits,
  computeRecommendedPrice,
  buildPricingReason,
  classifyUrgency,
  computeOrderByDate,
  daysUntilDeadline,
  type PricingRecommendation,
  type ReplenishmentOrder,
} from "./pricing";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SkuRecord {
  id: string;
  sku_code: string;
  name: string;
  category: string;
  current_inventory: number;
  reorder_point: number;
  lead_time_days: number;
  unit_price: number;
}

export interface DemandForecast {
  sku_id: string;
  sku_code: string;
  name: string;
  category: string;
  current_inventory: number;
  unit_price: number;
  forecast_demand_units: number;
  confidence_score: number;
  stockout_risk: "high" | "medium" | "low";
  recommended_reorder_qty: number;
  days_to_stockout: number;
  trends_score: number;
  weather_multiplier: number;
  seasonal_multiplier: number;
}

export interface ForecastSnapshot {
  id: string;
  run_at: string;
  trends_score: number;
  weather_multiplier: number;
  sku_count: number;
  at_risk_count: number;
}

// ---------------------------------------------------------------------------
// DB pool (singleton, same pattern as apps/web/lib/db.ts)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pool: any = null;

function getPool(): {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
} {
  if (_pool) return _pool;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Pool: PgPool } = require("pg") as {
    Pool: new (config: Record<string, unknown>) => {
      query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
    };
  };
  _pool = new PgPool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30_000,
  });
  return _pool;
}

async function dbQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const pool = getPool();
  const res = await pool.query(sql, params);
  return res.rows as T[];
}

// ---------------------------------------------------------------------------
// Table bootstrap — idempotent CREATE TABLE IF NOT EXISTS
// ---------------------------------------------------------------------------

export async function ensureTablesExist(): Promise<void> {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS brightworks_skus (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sku_code        TEXT NOT NULL UNIQUE,
      name            TEXT NOT NULL,
      category        TEXT NOT NULL,
      current_inventory INTEGER NOT NULL DEFAULT 0,
      reorder_point   INTEGER NOT NULL DEFAULT 50,
      lead_time_days  INTEGER NOT NULL DEFAULT 21,
      unit_price      NUMERIC(10,2) NOT NULL DEFAULT 0,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS brightworks_forecast_snapshots (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      run_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      trends_score      NUMERIC(5,2) NOT NULL,
      weather_multiplier NUMERIC(5,4) NOT NULL,
      sku_count         INTEGER NOT NULL,
      at_risk_count     INTEGER NOT NULL
    )
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS brightworks_demand_forecasts (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      snapshot_id           UUID NOT NULL REFERENCES brightworks_forecast_snapshots(id) ON DELETE CASCADE,
      sku_id                UUID NOT NULL REFERENCES brightworks_skus(id) ON DELETE CASCADE,
      forecast_demand_units INTEGER NOT NULL,
      confidence_score      NUMERIC(5,2) NOT NULL,
      stockout_risk         TEXT NOT NULL,
      recommended_reorder_qty INTEGER NOT NULL,
      days_to_stockout      INTEGER NOT NULL,
      trends_score          NUMERIC(5,2) NOT NULL,
      weather_multiplier    NUMERIC(5,4) NOT NULL,
      seasonal_multiplier   NUMERIC(5,4) NOT NULL,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

// ---------------------------------------------------------------------------
// SKU operations
// ---------------------------------------------------------------------------

export async function getSkuInventory(): Promise<SkuRecord[]> {
  return dbQuery<SkuRecord>(`
    SELECT id, sku_code, name, category,
           current_inventory, reorder_point, lead_time_days,
           CAST(unit_price AS FLOAT) AS unit_price
    FROM brightworks_skus
    ORDER BY name
  `);
}

/** Seed demo SKUs for brightworks seasonal lighting products if table is empty. */
export async function seedDemoSkus(): Promise<void> {
  const existing = await dbQuery<{ cnt: string }>(
    "SELECT COUNT(*) AS cnt FROM brightworks_skus"
  );
  const count = parseInt(existing[0]?.cnt ?? "0", 10);
  if (count > 0) return;

  const skus = [
    { code: "BW-STR-C7-25", name: "C7 String Lights 25ft", cat: "String Lights", inv: 420, rp: 80, lt: 21, price: 34.99 },
    { code: "BW-STR-C9-50", name: "C9 String Lights 50ft", cat: "String Lights", inv: 310, rp: 60, lt: 21, price: 52.99 },
    { code: "BW-NET-4X6",   name: "4x6ft Net Lights",       cat: "Net Lights",    inv: 185, rp: 50, lt: 28, price: 29.99 },
    { code: "BW-ICI-12",    name: "12ft Icicle Lights",      cat: "Icicle Lights", inv: 540, rp: 100,lt: 21, price: 24.99 },
    { code: "BW-ICI-24",    name: "24ft Icicle Lights",      cat: "Icicle Lights", inv: 290, rp: 80, lt: 21, price: 39.99 },
    { code: "BW-SPOT-RGB",  name: "RGB Spotlight Kit",        cat: "Spotlights",   inv: 95,  rp: 40, lt: 35, price: 79.99 },
    { code: "BW-SPOT-WW",   name: "Warm White Spotlight",    cat: "Spotlights",   inv: 130, rp: 40, lt: 35, price: 59.99 },
    { code: "BW-CLIP-100",  name: "Gutter Clips 100pk",       cat: "Accessories",  inv: 850, rp: 150,lt: 14, price: 12.99 },
    { code: "BW-CTRL-WIFI", name: "Wi-Fi Smart Controller",  cat: "Controllers",  inv: 70,  rp: 30, lt: 42, price: 49.99 },
    { code: "BW-EXT-25",    name: "Outdoor Extension 25ft",  cat: "Accessories",  inv: 620, rp: 100,lt: 14, price: 19.99 },
  ];

  for (const sku of skus) {
    await dbQuery(
      `INSERT INTO brightworks_skus
         (id, sku_code, name, category, current_inventory, reorder_point, lead_time_days, unit_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (sku_code) DO NOTHING`,
      [
        crypto.randomUUID(),
        sku.code, sku.name, sku.cat,
        sku.inv, sku.rp, sku.lt, sku.price,
      ]
    );
  }
}

// ---------------------------------------------------------------------------
// External data ingestion (Google Trends + weather-onset)
// ---------------------------------------------------------------------------

/**
 * Fetch a normalized holiday search-volume score (0–100) from Google Trends
 * via SerpAPI. Falls back to a seasonality-based estimate when the API key is
 * absent or the request fails, so the cron always produces output.
 */
export async function fetchGoogleTrendsScore(): Promise<number> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return estimateSeasonalTrendsScore();
  }

  try {
    const keywords = encodeURIComponent("christmas lights,holiday lights,outdoor lights");
    const url =
      `https://serpapi.com/search.json?engine=google_trends` +
      `&q=${keywords}&date=today+3-m&geo=US&api_key=${apiKey}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return estimateSeasonalTrendsScore();

    const data = (await res.json()) as {
      interest_over_time?: { timeline_data?: Array<{ values?: Array<{ extracted_value?: number }> }> };
    };

    const timeline = data.interest_over_time?.timeline_data ?? [];
    if (timeline.length === 0) return estimateSeasonalTrendsScore();

    // Average the last 4 weeks' interest values for the first keyword
    const recent = timeline.slice(-4);
    const values = recent
      .map((pt) => pt.values?.[0]?.extracted_value ?? 0)
      .filter((v) => v > 0);
    if (values.length === 0) return estimateSeasonalTrendsScore();

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.min(100, Math.round(avg));
  } catch {
    return estimateSeasonalTrendsScore();
  }
}

/**
 * Estimate a trends score based purely on calendar position.
 * Peaks in November–December (score ~85), ramps from Sep, low in off-season.
 */
function estimateSeasonalTrendsScore(): number {
  const month = new Date().getMonth(); // 0=Jan
  const scores: Record<number, number> = {
    0: 15, 1: 10, 2: 8, 3: 8, 4: 10, 5: 12,
    6: 14, 7: 16, 8: 30, 9: 55, 10: 80, 11: 90,
  };
  return scores[month] ?? 20;
}

/**
 * Fetch a regional weather-onset multiplier (1.0–1.5).
 * Uses the Open-Meteo free API (no key required) to check if cold weather
 * has arrived in top US holiday-light markets (Chicago, Minneapolis, Denver).
 * A colder average temp → higher multiplier (people buy lights earlier when
 * winter arrives).
 */
export async function fetchWeatherOnsetMultiplier(): Promise<number> {
  const markets = [
    { lat: 41.85, lon: -87.65 },  // Chicago
    { lat: 44.98, lon: -93.27 },  // Minneapolis
    { lat: 39.74, lon: -104.98 }, // Denver
  ];

  try {
    const temps: number[] = [];
    for (const { lat, lon } of markets) {
      const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${lat}&longitude=${lon}` +
        `&daily=temperature_2m_max,temperature_2m_min` +
        `&forecast_days=3&temperature_unit=fahrenheit&timezone=America%2FChicago`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6_000) });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[] };
      };
      const maxArr = data.daily?.temperature_2m_max ?? [];
      const minArr = data.daily?.temperature_2m_min ?? [];
      if (maxArr.length > 0 && minArr.length > 0) {
        const avgHigh = maxArr.reduce((a, b) => a + b, 0) / maxArr.length;
        const avgLow = minArr.reduce((a, b) => a + b, 0) / minArr.length;
        temps.push((avgHigh + avgLow) / 2);
      }
    }

    if (temps.length === 0) return 1.0;
    const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
    // Below 32°F → 1.5, 32–50°F → 1.25, 50–65°F → 1.1, above 65°F → 1.0
    if (avgTemp < 32) return 1.5;
    if (avgTemp < 50) return 1.25;
    if (avgTemp < 65) return 1.1;
    return 1.0;
  } catch {
    return 1.0;
  }
}

// ---------------------------------------------------------------------------
// Forecast computation
// ---------------------------------------------------------------------------

/**
 * Compute per-SKU demand forecasts given current inventory, trends score,
 * and weather multiplier.
 *
 * Base seasonal demand is derived from reorder_point (= expected 30-day demand
 * at baseline). We project 90 days of the season, then apply the multipliers.
 */
export function computeForecasts(
  skus: SkuRecord[],
  trendsScore: number,
  weatherMultiplier: number
): DemandForecast[] {
  const deadline = daysUntilDeadline();
  const seasonalMult = computeSeasonalMultiplier(trendsScore, deadline);

  return skus.map((sku) => {
    // Baseline 90-day demand = 3× reorder_point (reorder_point = ~30-day usage)
    const baseDemand90 = sku.reorder_point * 3;
    const forecastDemand = Math.ceil(baseDemand90 * seasonalMult * weatherMultiplier);

    const dailyDemand = forecastDemand / 90;
    const daysToStockout =
      dailyDemand > 0
        ? Math.floor(sku.current_inventory / dailyDemand)
        : 999;

    const reorderQty = computeReplenishmentUnits(
      sku.current_inventory,
      forecastDemand,
      sku.lead_time_days
    );

    const stockoutRisk: "high" | "medium" | "low" =
      daysToStockout <= 21
        ? "high"
        : daysToStockout <= 45
        ? "medium"
        : "low";

    // Confidence: higher when trends and weather data agree with season
    const confidence = Math.min(
      95,
      50 + (trendsScore / 100) * 30 + (weatherMultiplier - 1) * 30
    );

    return {
      sku_id: sku.id,
      sku_code: sku.sku_code,
      name: sku.name,
      category: sku.category,
      current_inventory: sku.current_inventory,
      unit_price: sku.unit_price,
      forecast_demand_units: forecastDemand,
      confidence_score: Math.round(confidence * 10) / 10,
      stockout_risk: stockoutRisk,
      recommended_reorder_qty: reorderQty,
      days_to_stockout: Math.min(daysToStockout, 999),
      trends_score: trendsScore,
      weather_multiplier: weatherMultiplier,
      seasonal_multiplier: seasonalMult,
    };
  });
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/** Save a complete forecast run to the DB. Returns the snapshot UUID. */
export async function saveForecastSnapshot(
  forecasts: DemandForecast[],
  trendsScore: number,
  weatherMultiplier: number
): Promise<string> {
  const atRisk = forecasts.filter((f) => f.stockout_risk === "high").length;
  const snapshotId = crypto.randomUUID();

  await dbQuery(
    `INSERT INTO brightworks_forecast_snapshots
       (id, trends_score, weather_multiplier, sku_count, at_risk_count)
     VALUES ($1, $2, $3, $4, $5)`,
    [snapshotId, trendsScore, weatherMultiplier, forecasts.length, atRisk]
  );

  for (const fc of forecasts) {
    await dbQuery(
      `INSERT INTO brightworks_demand_forecasts
         (id, snapshot_id, sku_id, forecast_demand_units, confidence_score,
          stockout_risk, recommended_reorder_qty, days_to_stockout,
          trends_score, weather_multiplier, seasonal_multiplier)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        crypto.randomUUID(),
        snapshotId,
        fc.sku_id,
        fc.forecast_demand_units,
        fc.confidence_score,
        fc.stockout_risk,
        fc.recommended_reorder_qty,
        fc.days_to_stockout,
        fc.trends_score,
        fc.weather_multiplier,
        fc.seasonal_multiplier,
      ]
    );
  }

  return snapshotId;
}

// ---------------------------------------------------------------------------
// Read — latest forecast data for the admin dashboard
// ---------------------------------------------------------------------------

/** Fetch the most recent forecast for every SKU. */
export async function getLatestForecasts(): Promise<DemandForecast[]> {
  const rows = await dbQuery<{
    sku_id: string;
    sku_code: string;
    name: string;
    category: string;
    current_inventory: number;
    unit_price: number;
    forecast_demand_units: number;
    confidence_score: number;
    stockout_risk: string;
    recommended_reorder_qty: number;
    days_to_stockout: number;
    trends_score: number;
    weather_multiplier: number;
    seasonal_multiplier: number;
  }>(`
    SELECT DISTINCT ON (s.id)
      s.id               AS sku_id,
      s.sku_code,
      s.name,
      s.category,
      s.current_inventory,
      CAST(s.unit_price AS FLOAT) AS unit_price,
      df.forecast_demand_units,
      CAST(df.confidence_score AS FLOAT) AS confidence_score,
      df.stockout_risk,
      df.recommended_reorder_qty,
      df.days_to_stockout,
      CAST(df.trends_score AS FLOAT) AS trends_score,
      CAST(df.weather_multiplier AS FLOAT) AS weather_multiplier,
      CAST(df.seasonal_multiplier AS FLOAT) AS seasonal_multiplier
    FROM brightworks_skus s
    JOIN brightworks_demand_forecasts df ON df.sku_id = s.id
    ORDER BY s.id, df.created_at DESC
  `);

  return rows.map((r) => ({
    ...r,
    stockout_risk: r.stockout_risk as "high" | "medium" | "low",
  }));
}

/** Return only SKUs at high stockout risk (days_to_stockout ≤ 21). */
export async function getAtRiskSkus(): Promise<DemandForecast[]> {
  const all = await getLatestForecasts();
  return all.filter((f) => f.stockout_risk === "high");
}

/** Return the last few forecast snapshot summaries for the dashboard header. */
export async function getRecentSnapshots(limit = 5): Promise<ForecastSnapshot[]> {
  return dbQuery<ForecastSnapshot>(`
    SELECT id,
           run_at::TEXT AS run_at,
           CAST(trends_score AS FLOAT) AS trends_score,
           CAST(weather_multiplier AS FLOAT) AS weather_multiplier,
           sku_count,
           at_risk_count
    FROM brightworks_forecast_snapshots
    ORDER BY run_at DESC
    LIMIT $1
  `, [limit]);
}

// ---------------------------------------------------------------------------
// Derived pricing & replenishment helpers (re-exported for cron summary)
// ---------------------------------------------------------------------------

export function buildPricingRecommendations(
  forecasts: DemandForecast[]
): PricingRecommendation[] {
  const deadline = daysUntilDeadline();
  return forecasts.map((fc) => {
    const recommended = computeRecommendedPrice(fc.unit_price, fc.seasonal_multiplier);
    const adjustmentPct =
      fc.unit_price > 0
        ? Math.round(((recommended - fc.unit_price) / fc.unit_price) * 1000) / 10
        : 0;
    return {
      sku_id: fc.sku_id,
      sku_code: fc.sku_code,
      name: fc.name,
      current_price: fc.unit_price,
      recommended_price: recommended,
      adjustment_pct: adjustmentPct,
      reason: buildPricingReason(fc.trends_score, deadline, adjustmentPct),
    };
  });
}

export function buildReplenishmentOrders(
  forecasts: DemandForecast[]
): ReplenishmentOrder[] {
  return forecasts
    .filter((fc) => fc.recommended_reorder_qty > 0)
    .map((fc) => {
      // lead_time_days not stored on forecast; use category heuristic
      const leadTime = fc.category === "Controllers" ? 42 : fc.category === "Spotlights" ? 35 : 21;
      return {
        sku_id: fc.sku_id,
        sku_code: fc.sku_code,
        name: fc.name,
        current_inventory: fc.current_inventory,
        forecast_demand: fc.forecast_demand_units,
        units_to_order: fc.recommended_reorder_qty,
        urgency: classifyUrgency(fc.days_to_stockout, daysUntilDeadline()),
        order_by_date: computeOrderByDate(leadTime),
      };
    })
    .sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.urgency] - order[b.urgency];
    });
}
