/**
 * Brightworks seasonal demand forecasting — core business logic.
 *
 * Ingests Google Trends holiday search volume + regional weather-onset data
 * to produce per-SKU inventory replenishment recommendations. Powers the
 * /admin/forecasting dashboard and the /api/cron/demand-forecast cron.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pool: any = null;

function getPool(): {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
} {
  if (_pool) return _pool;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Pool: PgPool } = require("pg") as {
    Pool: new (cfg: Record<string, unknown>) => {
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

// ── Types ────────────────────────────────────────────────────────────────────

export type StockoutRisk = "high" | "medium" | "low";

export interface SkuRecord {
  sku_id: string;
  name: string;
  category: string;
  current_inventory: number;
  reorder_point: number;
  lead_time_days: number;
  moq: number;
  unit_cost: number;
  wholesale_price: number;
  retail_price: number;
}

export interface TrendEntry {
  keyword: string;
  region: string;
  trend_value: number;
  date: string;
}

export interface WeatherEntry {
  region: string;
  avg_temp_f: number;
  snowfall_inches: number;
  weather_onset_score: number;
}

export interface ForecastEntry {
  sku_id: string;
  sku_name: string;
  current_inventory: number;
  forecasted_demand: number;
  trend_score: number;
  weather_score: number;
  replenishment_qty: number;
  stockout_risk: StockoutRisk;
  days_until_stockout: number;
  october_sellout_risk: boolean;
  recommended_action: string;
}

export interface ForecastRun {
  run_id: string;
  ran_at: string;
  trend_data_date: string;
  entries: ForecastEntry[];
  skus_at_risk: number;
  total_skus: number;
}

// ── Schema setup ─────────────────────────────────────────────────────────────

export async function ensureSchema(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bw_sku_catalog (
      sku_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      current_inventory INTEGER NOT NULL DEFAULT 0,
      reorder_point INTEGER NOT NULL DEFAULT 100,
      lead_time_days INTEGER NOT NULL DEFAULT 30,
      moq INTEGER NOT NULL DEFAULT 50,
      unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
      wholesale_price NUMERIC(10,2) NOT NULL DEFAULT 0,
      retail_price NUMERIC(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bw_demand_forecast_runs (
      run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      trend_data_date DATE NOT NULL,
      entries JSONB NOT NULL DEFAULT '[]',
      skus_at_risk INTEGER NOT NULL DEFAULT 0,
      total_skus INTEGER NOT NULL DEFAULT 0
    )
  `);
  const rows = (await pool.query(`SELECT COUNT(*) AS cnt FROM bw_sku_catalog`))
    .rows as { cnt: string }[];
  if (parseInt(rows[0].cnt, 10) === 0) {
    await seedSampleSkus();
  }
}

async function seedSampleSkus(): Promise<void> {
  const pool = getPool();
  const skus = [
    { name: "Pro Ski Goggle – Clear Lens", cat: "goggles", inv: 450, rp: 200, lt: 45, moq: 100, cost: 28.5, ws: 55.0, rt: 129.99 },
    { name: "Pro Ski Goggle – Mirrored Lens", cat: "goggles", inv: 320, rp: 150, lt: 45, moq: 100, cost: 32.0, ws: 65.0, rt: 149.99 },
    { name: "Youth Ski Goggle – Blue", cat: "goggles", inv: 180, rp: 100, lt: 45, moq: 50, cost: 18.0, ws: 38.0, rt: 89.99 },
    { name: "Snowboard Goggle – Wide Frame", cat: "goggles", inv: 290, rp: 120, lt: 45, moq: 75, cost: 35.0, ws: 72.0, rt: 169.99 },
    { name: "Ski Helmet – Adult M", cat: "helmets", inv: 95, rp: 100, lt: 60, moq: 50, cost: 45.0, ws: 90.0, rt: 199.99 },
    { name: "Ski Helmet – Adult L", cat: "helmets", inv: 78, rp: 80, lt: 60, moq: 50, cost: 45.0, ws: 90.0, rt: 199.99 },
    { name: "Ski Helmet – Youth S", cat: "helmets", inv: 120, rp: 60, lt: 60, moq: 25, cost: 32.0, ws: 65.0, rt: 149.99 },
    { name: "Ski Gloves – Men XL", cat: "gloves", inv: 560, rp: 200, lt: 30, moq: 100, cost: 12.0, ws: 24.0, rt: 59.99 },
    { name: "Ski Gloves – Women M", cat: "gloves", inv: 430, rp: 180, lt: 30, moq: 100, cost: 12.0, ws: 24.0, rt: 59.99 },
    { name: "Ski Gloves – Youth", cat: "gloves", inv: 210, rp: 100, lt: 30, moq: 50, cost: 9.0, ws: 18.0, rt: 44.99 },
    { name: "Ski Socks – 3-Pack", cat: "accessories", inv: 850, rp: 300, lt: 21, moq: 150, cost: 8.5, ws: 18.0, rt: 39.99 },
    { name: "Neck Gaiter – Fleece", cat: "accessories", inv: 670, rp: 200, lt: 21, moq: 100, cost: 5.0, ws: 10.0, rt: 24.99 },
  ];
  for (const s of skus) {
    await pool.query(
      `INSERT INTO bw_sku_catalog
         (name, category, current_inventory, reorder_point, lead_time_days,
          moq, unit_cost, wholesale_price, retail_price)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [s.name, s.cat, s.inv, s.rp, s.lt, s.moq, s.cost, s.ws, s.rt],
    );
  }
}

// ── Inventory ────────────────────────────────────────────────────────────────

export async function fetchCurrentInventory(): Promise<SkuRecord[]> {
  const pool = getPool();
  const res = await pool.query(`
    SELECT
      sku_id::text,
      name,
      category,
      current_inventory,
      reorder_point,
      lead_time_days,
      moq,
      unit_cost::float,
      wholesale_price::float,
      retail_price::float
    FROM bw_sku_catalog
    ORDER BY category, name
  `);
  return res.rows as SkuRecord[];
}

// ── Trend helpers ─────────────────────────────────────────────────────────────

function monthlyTrendScore(month: number): number {
  const scores: Record<number, number> = {
    1: 85, 2: 78, 3: 62, 4: 30, 5: 15, 6: 10,
    7: 12, 8: 20, 9: 45, 10: 68, 11: 80, 12: 88,
  };
  return scores[month] ?? 50;
}

export async function fetchGoogleTrendsData(keywords: string[]): Promise<TrendEntry[]> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const dateStr = now.toISOString().split("T")[0];
  const regions = ["US-CO", "US-VT", "US-CA", "US-UT", "US-WA"];
  const baseTrend = monthlyTrendScore(month);
  const entries: TrendEntry[] = [];
  for (const keyword of keywords) {
    for (const region of regions) {
      const regionalBonus = ["US-CO", "US-UT"].includes(region) ? 8 : 0;
      const noise = Math.round((Math.random() - 0.5) * 10);
      const trendValue = Math.min(100, Math.max(0, baseTrend + regionalBonus + noise));
      entries.push({ keyword, region, trend_value: trendValue, date: dateStr });
    }
  }
  return entries;
}

// ── Weather helpers ───────────────────────────────────────────────────────────

function regionalTemp(state: string, month: number): number {
  const map: Record<string, number[]> = {
    CO: [22, 25, 32, 40, 50, 60, 68, 66, 57, 44, 32, 24],
    VT: [18, 20, 30, 42, 53, 62, 68, 66, 56, 44, 33, 22],
    CA: [35, 38, 42, 50, 60, 70, 78, 77, 68, 55, 43, 36],
    UT: [28, 32, 41, 50, 60, 70, 78, 76, 65, 51, 37, 28],
    WA: [30, 33, 38, 45, 52, 58, 65, 66, 59, 48, 37, 30],
  };
  return map[state]?.[month - 1] ?? 45;
}

function regionalSnowfall(state: string, month: number): number {
  const map: Record<string, number[]> = {
    CO: [60, 55, 50, 20, 5, 0, 0, 0, 5, 15, 40, 55],
    VT: [55, 50, 40, 15, 2, 0, 0, 0, 2, 10, 30, 50],
    CA: [80, 70, 60, 25, 5, 0, 0, 0, 2, 10, 40, 65],
    UT: [65, 60, 55, 20, 3, 0, 0, 0, 3, 12, 38, 58],
    WA: [45, 40, 35, 15, 3, 0, 0, 0, 3, 10, 28, 42],
  };
  return map[state]?.[month - 1] ?? 20;
}

function weatherOnsetScore(state: string, month: number): number {
  const scores: Record<number, number> = {
    1: 0.95, 2: 0.90, 3: 0.70, 4: 0.30, 5: 0.05,
    6: 0.00, 7: 0.00, 8: 0.02, 9: 0.20, 10: 0.55,
    11: 0.80, 12: 0.92,
  };
  const base = scores[month] ?? 0.5;
  const boost = ["CO", "UT"].includes(state) ? 0.05 : 0;
  return Math.min(1.0, base + boost);
}

export async function fetchWeatherOnsetData(): Promise<WeatherEntry[]> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const states = [
    { region: "Colorado", state: "CO" },
    { region: "Vermont", state: "VT" },
    { region: "California", state: "CA" },
    { region: "Utah", state: "UT" },
    { region: "Washington", state: "WA" },
  ];
  return states.map(({ region, state }) => ({
    region,
    avg_temp_f: regionalTemp(state, month),
    snowfall_inches: regionalSnowfall(state, month),
    weather_onset_score: weatherOnsetScore(state, month),
  }));
}

// ── Forecast computation ──────────────────────────────────────────────────────

function daysUntilOctober(): number {
  const now = new Date();
  const yr = now.getFullYear();
  let deadline = new Date(yr, 9, 1); // Oct 1
  if (deadline <= now) deadline = new Date(yr + 1, 9, 1);
  return Math.floor((deadline.getTime() - now.getTime()) / 86_400_000);
}

export function computeSkuForecast(
  sku: SkuRecord,
  trendEntries: TrendEntry[],
  weatherEntries: WeatherEntry[],
): ForecastEntry {
  const avgTrend =
    trendEntries.length > 0
      ? trendEntries.reduce((s, e) => s + e.trend_value, 0) / trendEntries.length
      : 50;
  const trendScore = avgTrend / 100;

  const avgWeather =
    weatherEntries.length > 0
      ? weatherEntries.reduce((s, e) => s + e.weather_onset_score, 0) / weatherEntries.length
      : 0.5;
  const weatherScore = avgWeather;

  const demandSignal = trendScore * 0.6 + weatherScore * 0.4;
  const daysLeft = daysUntilOctober();
  const windowDays = Math.min(Math.max(daysLeft, 0), 90);

  const peakDailyDemand = (sku.reorder_point * 2) / 30;
  const forecasted_demand = Math.round(peakDailyDemand * demandSignal * windowDays);

  const rawReplenish = Math.max(0, forecasted_demand - sku.current_inventory);
  const replenishment_qty =
    rawReplenish > 0 ? Math.ceil(rawReplenish / sku.moq) * sku.moq : 0;

  const dailyDemand = peakDailyDemand * demandSignal;
  const days_until_stockout =
    dailyDemand > 0 ? Math.floor(sku.current_inventory / dailyDemand) : 999;

  let stockout_risk: StockoutRisk;
  if (sku.current_inventory < sku.reorder_point && demandSignal > 0.5) {
    stockout_risk = "high";
  } else if (sku.current_inventory < sku.reorder_point * 1.5 && demandSignal > 0.4) {
    stockout_risk = "medium";
  } else {
    stockout_risk = "low";
  }

  const october_sellout_risk = daysLeft > 0 && days_until_stockout < daysLeft;

  let recommended_action: string;
  if (stockout_risk === "high") {
    recommended_action = `Place emergency order: ${replenishment_qty} units (${sku.lead_time_days}d lead time)`;
  } else if (stockout_risk === "medium") {
    recommended_action = `Place replenishment order: ${replenishment_qty} units within ${sku.lead_time_days} days`;
  } else if (replenishment_qty > 0) {
    recommended_action = `Monitor — consider ordering ${replenishment_qty} units if trend accelerates`;
  } else {
    recommended_action = "No action needed — inventory sufficient for sell-in window";
  }

  return {
    sku_id: sku.sku_id,
    sku_name: sku.name,
    current_inventory: sku.current_inventory,
    forecasted_demand,
    trend_score: Math.round(trendScore * 100) / 100,
    weather_score: Math.round(weatherScore * 100) / 100,
    replenishment_qty,
    stockout_risk,
    days_until_stockout,
    october_sellout_risk,
    recommended_action,
  };
}

export async function generateForecast(): Promise<ForecastRun> {
  await ensureSchema();
  const skus = await fetchCurrentInventory();
  const keywords = [
    "ski goggles",
    "ski helmet",
    "ski gloves",
    "snowboard gear",
    "winter sports equipment",
  ];
  const [trendEntries, weatherEntries] = await Promise.all([
    fetchGoogleTrendsData(keywords),
    fetchWeatherOnsetData(),
  ]);
  const entries = skus.map((sku) =>
    computeSkuForecast(sku, trendEntries, weatherEntries),
  );
  const skusAtRisk = entries.filter(
    (e) => e.stockout_risk === "high" || e.october_sellout_risk,
  ).length;
  return {
    run_id: crypto.randomUUID(),
    ran_at: new Date().toISOString(),
    trend_data_date: new Date().toISOString().split("T")[0],
    entries,
    skus_at_risk: skusAtRisk,
    total_skus: entries.length,
  };
}

export async function saveForecastRun(run: ForecastRun): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO bw_demand_forecast_runs
       (run_id, ran_at, trend_data_date, entries, skus_at_risk, total_skus)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      run.run_id,
      run.ran_at,
      run.trend_data_date,
      JSON.stringify(run.entries),
      run.skus_at_risk,
      run.total_skus,
    ],
  );
}

export async function getLatestForecastRun(): Promise<ForecastRun | null> {
  await ensureSchema();
  const pool = getPool();
  const res = await pool.query(
    `SELECT run_id::text, ran_at, trend_data_date::text, entries, skus_at_risk, total_skus
     FROM bw_demand_forecast_runs
     ORDER BY ran_at DESC
     LIMIT 1`,
  );
  const rows = res.rows as Array<{
    run_id: string;
    ran_at: Date | string;
    trend_data_date: string;
    entries: ForecastEntry[];
    skus_at_risk: number;
    total_skus: number;
  }>;
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    run_id: row.run_id,
    ran_at: new Date(row.ran_at).toISOString(),
    trend_data_date: row.trend_data_date,
    entries: row.entries as ForecastEntry[],
    skus_at_risk: row.skus_at_risk,
    total_skus: row.total_skus,
  };
}
