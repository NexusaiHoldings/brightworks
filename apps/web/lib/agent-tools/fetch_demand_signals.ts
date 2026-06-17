/**
 * fetch_demand_signals — confirm-gated mutation tool handler.
 *
 * Ingests Google Trends holiday search volume + regional weather-onset data
 * for configured SKU categories and writes normalized rows to
 * brightworks_demand_signals for the forecasting engine.
 *
 * Autonomy = confirm: this is a mutation; it writes to DB.
 */

import type { HandlerContext, HandlerResult } from "@nexus/identity-and-access";

export type Args = Record<string, unknown>;

interface TrendsDataPoint {
  date: string;
  value: number;
  keyword: string;
}

interface WeatherDataPoint {
  date: string;
  temp_max_c: number;
  temp_min_c: number;
  precipitation_mm: number;
  region: string;
}

interface NormalizedSignal {
  id: string;
  category: string;
  signal_type: "trends" | "weather";
  region: string;
  signal_date: string;
  raw_value: number;
  normalized_value: number;
  metadata: Record<string, unknown>;
  fetched_at: string;
}

// SKU category → representative search keywords
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  outdoor_lighting: ["outdoor string lights", "patio lights", "holiday lights"],
  seasonal_decor: ["christmas decorations", "holiday wreath", "seasonal decor"],
  garden_tools: ["garden tools", "lawn mower", "gardening supplies"],
  heating_cooling: ["space heater", "air conditioner", "portable fan"],
  holiday_hardware: ["holiday hardware", "decorative hardware", "seasonal fixtures"],
};

// US region codes → approximate lat/lon centroids for weather API
const REGION_COORDS: Record<string, { lat: number; lon: number }> = {
  US: { lat: 39.5, lon: -98.35 },
  US_NE: { lat: 42.36, lon: -71.06 },
  US_SE: { lat: 33.75, lon: -84.39 },
  US_MW: { lat: 41.88, lon: -87.63 },
  US_SW: { lat: 33.45, lon: -112.07 },
  US_W: { lat: 34.05, lon: -118.24 },
};

async function fetchGoogleTrends(
  keywords: string[],
  startDate: string,
  endDate: string,
  region: string,
): Promise<TrendsDataPoint[]> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return [];

  const points: TrendsDataPoint[] = [];
  const geoCode = region.slice(0, 2).toUpperCase();

  for (const keyword of keywords) {
    const url = new URL("https://serpapi.com/search");
    url.searchParams.set("engine", "google_trends");
    url.searchParams.set("q", keyword);
    url.searchParams.set("date", `${startDate} ${endDate}`);
    url.searchParams.set("geo", geoCode);
    url.searchParams.set("api_key", apiKey);

    try {
      const response = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) continue;

      const data = (await response.json()) as {
        interest_over_time?: {
          timeline_data?: Array<{
            date: string;
            values: Array<{ extracted_value: number }>;
          }>;
        };
      };

      for (const point of data.interest_over_time?.timeline_data ?? []) {
        points.push({
          date: point.date.split(" ")[0] ?? point.date,
          value: point.values[0]?.extracted_value ?? 0,
          keyword,
        });
      }
    } catch {
      // Network error — skip this keyword; partial ingestion is acceptable
    }
  }

  return points;
}

async function fetchWeatherOnset(
  region: string,
  startDate: string,
  endDate: string,
): Promise<WeatherDataPoint[]> {
  const coords = REGION_COORDS[region] ?? REGION_COORDS["US"]!;
  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.searchParams.set("latitude", String(coords.lat));
  url.searchParams.set("longitude", String(coords.lon));
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,precipitation_sum",
  );
  url.searchParams.set("timezone", "America/New_York");

  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return [];

    const data = (await response.json()) as {
      daily?: {
        time?: string[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        precipitation_sum?: number[];
      };
    };

    const daily = data.daily;
    if (!daily?.time) return [];

    return daily.time.map((date, idx) => ({
      date,
      temp_max_c: daily.temperature_2m_max?.[idx] ?? 0,
      temp_min_c: daily.temperature_2m_min?.[idx] ?? 0,
      precipitation_mm: daily.precipitation_sum?.[idx] ?? 0,
      region,
    }));
  } catch {
    return [];
  }
}

function normalizeToRange(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

function buildNormalizedSignals(
  category: string,
  trendsPoints: TrendsDataPoint[],
  weatherPoints: WeatherDataPoint[],
  region: string,
): NormalizedSignal[] {
  const signals: NormalizedSignal[] = [];
  const now = new Date().toISOString();

  // Trends: raw value is 0-100 Google index → normalize to 0-1
  for (const point of trendsPoints) {
    signals.push({
      id: crypto.randomUUID(),
      category,
      signal_type: "trends",
      region,
      signal_date: point.date,
      raw_value: point.value,
      normalized_value: normalizeToRange(point.value, 0, 100),
      metadata: { keyword: point.keyword },
      fetched_at: now,
    });
  }

  // Weather onset: use daily mean temp, normalized across the fetched window
  if (weatherPoints.length > 0) {
    const temps = weatherPoints.map((p) => (p.temp_max_c + p.temp_min_c) / 2);
    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);

    for (const point of weatherPoints) {
      const avgTemp = (point.temp_max_c + point.temp_min_c) / 2;
      signals.push({
        id: crypto.randomUUID(),
        category,
        signal_type: "weather",
        region,
        signal_date: point.date,
        raw_value: avgTemp,
        normalized_value: normalizeToRange(avgTemp, minTemp, maxTemp),
        metadata: {
          temp_max_c: point.temp_max_c,
          temp_min_c: point.temp_min_c,
          precipitation_mm: point.precipitation_mm,
        },
        fetched_at: now,
      });
    }
  }

  return signals;
}

async function upsertSignals(
  ctx: HandlerContext,
  signals: NormalizedSignal[],
): Promise<number> {
  let inserted = 0;
  for (const signal of signals) {
    try {
      await ctx.db.execute(
        `INSERT INTO brightworks_demand_signals
           (id, category, signal_type, region, signal_date, raw_value,
            normalized_value, metadata, fetched_at)
         VALUES ($1::uuid, $2, $3, $4, $5::date, $6, $7, $8::jsonb, $9::timestamptz)
         ON CONFLICT (category, signal_type, region, signal_date)
         DO UPDATE SET
           raw_value        = EXCLUDED.raw_value,
           normalized_value = EXCLUDED.normalized_value,
           metadata         = EXCLUDED.metadata,
           fetched_at       = EXCLUDED.fetched_at`,
        signal.id,
        signal.category,
        signal.signal_type,
        signal.region,
        signal.signal_date,
        signal.raw_value,
        signal.normalized_value,
        JSON.stringify(signal.metadata),
        signal.fetched_at,
      );
      inserted++;
    } catch {
      // Partial ingestion: log-safe to skip one row and continue
    }
  }
  return inserted;
}

export async function handleFetchDemandSignals(
  ctx: HandlerContext,
  args: Args,
): Promise<HandlerResult> {
  const categories: string[] = Array.isArray(args.categories)
    ? (args.categories as string[]).filter((c) => typeof c === "string")
    : Object.keys(CATEGORY_KEYWORDS);

  const region =
    typeof args.region === "string" ? args.region : "US";

  const defaultStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  })();
  const startDate =
    typeof args.start_date === "string" ? args.start_date : defaultStart;
  const endDate =
    typeof args.end_date === "string"
      ? args.end_date
      : new Date().toISOString().slice(0, 10);

  if (categories.length === 0) {
    return { status: 400, body: "at least one category is required" };
  }

  const allSignals: NormalizedSignal[] = [];

  for (const category of categories) {
    const keywords = CATEGORY_KEYWORDS[category] ?? [category];
    const [trendsPoints, weatherPoints] = await Promise.all([
      fetchGoogleTrends(keywords, startDate, endDate, region),
      fetchWeatherOnset(region, startDate, endDate),
    ]);
    allSignals.push(
      ...buildNormalizedSignals(category, trendsPoints, weatherPoints, region),
    );
  }

  const inserted = await upsertSignals(ctx, allSignals);

  await ctx.events.publish("demand_signals.fetched", {
    categories,
    region,
    start_date: startDate,
    end_date: endDate,
    signal_count: inserted,
  });

  return {
    status: 200,
    body: {
      inserted,
      total_fetched: allSignals.length,
      categories,
      region,
      start_date: startDate,
      end_date: endDate,
    },
  };
}
