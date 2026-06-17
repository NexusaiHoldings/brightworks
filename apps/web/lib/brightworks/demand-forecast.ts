/**
 * Seasonal demand forecasting logic for Brightworks.
 * Ingests Google Trends holiday search volume + regional weather-onset data
 * to produce per-SKU inventory replenishment recommendations.
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

export interface SkuForecast {
  skuId: string;
  skuName: string;
  currentInventory: number;
  forecastedDemand: number;
  recommendedReplenishment: number;
  stockoutRisk: "high" | "medium" | "low";
  trendsScore: number;
  weatherScore: number;
  sellInDeadline: string;
}

export interface ForecastReport {
  generatedAt: string;
  skuForecasts: SkuForecast[];
  highRiskCount: number;
  totalSkus: number;
}

interface SkuRow {
  id: string;
  name: string;
  current_inventory: number;
  keywords: string;
  region: string;
}

async function ensureSkuTable(): Promise<void> {
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS brightworks_skus (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      current_inventory INTEGER NOT NULL DEFAULT 0,
      keywords TEXT NOT NULL DEFAULT '',
      region TEXT NOT NULL DEFAULT 'national',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function ensureForecastTable(): Promise<void> {
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS brightworks_forecast_results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sku_id UUID NOT NULL,
      sku_name TEXT NOT NULL,
      current_inventory INTEGER NOT NULL,
      forecasted_demand INTEGER NOT NULL,
      recommended_replenishment INTEGER NOT NULL,
      stockout_risk TEXT NOT NULL,
      trends_score NUMERIC(5,2) NOT NULL,
      weather_score NUMERIC(5,2) NOT NULL,
      sell_in_deadline DATE NOT NULL,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function seedSkusIfEmpty(): Promise<void> {
  const db = getPool();
  const countResult = await db.query("SELECT COUNT(*) as cnt FROM brightworks_skus");
  if (parseInt(String((countResult.rows[0] as { cnt: string }).cnt)) > 0) return;

  await db.query(
    `INSERT INTO brightworks_skus (name, current_inventory, keywords, region) VALUES
     ($1, $2, $3, $4), ($5, $6, $7, $8), ($9, $10, $11, $12),
     ($13, $14, $15, $16), ($17, $18, $19, $20)`,
    [
      "SnowBlaster Pro 2000", 150, "snowblower snow blower winter outdoor", "northeast",
      "IceGuard Traction Mat", 420, "ice traction winter safety mat", "midwest",
      "Arctic Grip Boot Covers", 280, "winter boot ice grip traction", "national",
      "FrostShield Heated Gloves", 95, "winter gloves heated outdoor", "national",
      "WinterPath Deicer Pro", 340, "deicer salt winter ice removal", "northeast",
    ]
  );
}

// Simulates Google Trends holiday search volume for a set of SKU keywords.
// In production, replace with a real Trends API integration.
async function fetchTrendsScore(keywords: string): Promise<number> {
  const winterKeywords = ["snow", "ice", "winter", "frost", "deicer", "blower", "arctic"];
  const kw = keywords.toLowerCase();
  const matched = winterKeywords.filter((w) => kw.includes(w)).length;

  const currentMonth = new Date().getMonth(); // 0–11
  // Peak months: Sep–Dec (8–11)
  const seasonMultiplier =
    currentMonth >= 8 && currentMonth <= 11 ? 1.5 :
    currentMonth >= 6 && currentMonth <= 7  ? 1.1 : 0.8;

  const base = 30 + matched * 10;
  return Math.min(100, base * seasonMultiplier);
}

// Simulates regional weather-onset data that drives seasonal demand.
// In production, replace with a weather API integration.
async function fetchWeatherScore(region: string): Promise<number> {
  const currentMonth = new Date().getMonth();
  // Northeastern states experience winter onset earliest
  const regionalBonus = region === "northeast" ? 10 : region === "midwest" ? 5 : 0;

  let base: number;
  if (currentMonth >= 9 && currentMonth <= 11) {
    base = 80; // Oct–Dec: full winter onset
  } else if (currentMonth === 8) {
    base = 60; // September: building
  } else if (currentMonth <= 1) {
    base = 70; // Jan–Feb: still winter
  } else {
    base = 20; // off-season
  }

  return Math.min(100, base + regionalBonus);
}

function computeStockoutRisk(
  currentInventory: number,
  forecastedDemand: number,
  daysUntilDeadline: number
): "high" | "medium" | "low" {
  const coverage = currentInventory / Math.max(forecastedDemand, 1);
  if (coverage < 0.5 || (coverage < 0.8 && daysUntilDeadline < 30)) return "high";
  if (coverage < 0.8 || (coverage < 1.0 && daysUntilDeadline < 60)) return "medium";
  return "low";
}

export async function getSkuInventory(): Promise<SkuRow[]> {
  const db = getPool();
  await ensureSkuTable();
  await seedSkusIfEmpty();
  const result = await db.query(
    "SELECT id, name, current_inventory, keywords, region FROM brightworks_skus ORDER BY name"
  );
  return result.rows.map((row) => {
    const r = row as {
      id: string;
      name: string;
      current_inventory: string | number;
      keywords: string;
      region: string;
    };
    return {
      id: r.id,
      name: r.name,
      current_inventory: parseInt(String(r.current_inventory)),
      keywords: r.keywords,
      region: r.region,
    };
  });
}

export async function storeForecastResults(forecasts: SkuForecast[]): Promise<void> {
  const db = getPool();
  await ensureForecastTable();

  // Retain only last 30 days of history
  await db.query(
    `DELETE FROM brightworks_forecast_results WHERE generated_at < NOW() - INTERVAL '30 days'`
  );

  for (const forecast of forecasts) {
    await db.query(
      `INSERT INTO brightworks_forecast_results
         (sku_id, sku_name, current_inventory, forecasted_demand,
          recommended_replenishment, stockout_risk, trends_score, weather_score, sell_in_deadline)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        forecast.skuId,
        forecast.skuName,
        forecast.currentInventory,
        forecast.forecastedDemand,
        forecast.recommendedReplenishment,
        forecast.stockoutRisk,
        forecast.trendsScore,
        forecast.weatherScore,
        forecast.sellInDeadline,
      ]
    );
  }
}

export async function generateDemandForecast(): Promise<ForecastReport> {
  const skus = await getSkuInventory();
  const now = new Date();
  const year = now.getFullYear();
  // October sell-in deadline — if past October 1, use next year's
  const sellIn = new Date(year, 9, 1);
  if (now > sellIn) sellIn.setFullYear(year + 1);
  const daysUntilDeadline = Math.max(
    0,
    Math.floor((sellIn.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );
  const sellInDeadline = sellIn.toISOString().split("T")[0];

  const skuForecasts: SkuForecast[] = [];

  for (const sku of skus) {
    const trendsScore = await fetchTrendsScore(sku.keywords);
    const weatherScore = await fetchWeatherScore(sku.region);

    // Blend trends (60%) + weather (40%) to compute demand multiplier
    const demandMultiplier = (trendsScore / 100) * 0.6 + (weatherScore / 100) * 0.4;
    // Forecasted demand = 30% baseline growth * blended signal
    const forecastedDemand = Math.round(sku.current_inventory * 1.3 * (0.7 + demandMultiplier * 0.6));
    const recommendedReplenishment = Math.max(0, forecastedDemand - sku.current_inventory);
    const stockoutRisk = computeStockoutRisk(sku.current_inventory, forecastedDemand, daysUntilDeadline);

    skuForecasts.push({
      skuId: sku.id,
      skuName: sku.name,
      currentInventory: sku.current_inventory,
      forecastedDemand,
      recommendedReplenishment,
      stockoutRisk,
      trendsScore: Math.round(trendsScore * 100) / 100,
      weatherScore: Math.round(weatherScore * 100) / 100,
      sellInDeadline,
    });
  }

  const highRiskCount = skuForecasts.filter((f) => f.stockoutRisk === "high").length;

  return {
    generatedAt: now.toISOString(),
    skuForecasts,
    highRiskCount,
    totalSkus: skuForecasts.length,
  };
}

export async function getLatestForecast(): Promise<ForecastReport | null> {
  const db = getPool();

  try {
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'brightworks_forecast_results'
      ) AS exists
    `);
    if (!(tableCheck.rows[0] as { exists: boolean }).exists) return null;

    const latestRow = await db.query(
      "SELECT generated_at FROM brightworks_forecast_results ORDER BY generated_at DESC LIMIT 1"
    );
    if (latestRow.rows.length === 0) return null;

    const latestTimestamp = (latestRow.rows[0] as { generated_at: Date | string }).generated_at;

    const result = await db.query(
      `SELECT sku_id, sku_name, current_inventory, forecasted_demand,
              recommended_replenishment, stockout_risk, trends_score,
              weather_score, sell_in_deadline, generated_at
       FROM brightworks_forecast_results
       WHERE generated_at = $1
       ORDER BY
         CASE stockout_risk WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
         sku_name`,
      [latestTimestamp]
    );

    if (result.rows.length === 0) return null;

    const skuForecasts: SkuForecast[] = result.rows.map((row) => {
      const r = row as {
        sku_id: string;
        sku_name: string;
        current_inventory: string | number;
        forecasted_demand: string | number;
        recommended_replenishment: string | number;
        stockout_risk: string;
        trends_score: string | number;
        weather_score: string | number;
        sell_in_deadline: Date | string;
      };
      return {
        skuId: r.sku_id,
        skuName: r.sku_name,
        currentInventory: parseInt(String(r.current_inventory)),
        forecastedDemand: parseInt(String(r.forecasted_demand)),
        recommendedReplenishment: parseInt(String(r.recommended_replenishment)),
        stockoutRisk: r.stockout_risk as "high" | "medium" | "low",
        trendsScore: parseFloat(String(r.trends_score)),
        weatherScore: parseFloat(String(r.weather_score)),
        sellInDeadline:
          r.sell_in_deadline instanceof Date
            ? r.sell_in_deadline.toISOString().split("T")[0]
            : String(r.sell_in_deadline).split("T")[0],
      };
    });

    const highRiskCount = skuForecasts.filter((f) => f.stockoutRisk === "high").length;
    const generatedAt =
      latestTimestamp instanceof Date
        ? latestTimestamp.toISOString()
        : String(latestTimestamp);

    return { generatedAt, skuForecasts, highRiskCount, totalSkus: skuForecasts.length };
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "demand-forecast.getLatestForecast.error",
        error: err instanceof Error ? err.message : String(err),
      })
    );
    return null;
  }
}
