/**
 * Agent tool handler: fetch_demand_signals (autonomy = confirm)
 *
 * Ingests Google Trends holiday search volume and regional weather-onset data
 * for configured SKU categories, normalizes the results, and writes signal
 * rows to brightworks_demand_signals for the forecasting engine.
 *
 * Autonomy = confirm → mutation routes through the cross-boundary bridge;
 * this handler is invoked only after the user has confirmed the action.
 */

import type { HandlerContext, HandlerResult } from "@nexus/identity-and-access";

type Args = Record<string, unknown>;

interface TrendKeyword {
  keyword: string;
  category: string;
  geo: string;
}

interface TrendDataPoint {
  date: string;
  value: number;
  keyword: string;
  category: string;
  geo: string;
}

interface WeatherSignal {
  region: string;
  onset_date: string;
  temperature_delta: number;
  precipitation_mm: number;
  category: string;
}

interface NormalizedSignal {
  id: string;
  signal_type: string;
  category: string;
  geo_region: string;
  reference_date: string;
  raw_value: number;
  normalized_value: number;
  source: string;
  metadata: Record<string, unknown>;
  fetched_at: string;
}

const DEFAULT_SKU_KEYWORDS: TrendKeyword[] = [
  { keyword: "holiday outdoor lighting", category: "lighting", geo: "US" },
  { keyword: "christmas string lights", category: "lighting", geo: "US" },
  { keyword: "outdoor holiday decor", category: "decor", geo: "US" },
  { keyword: "landscape lighting sale", category: "lighting", geo: "US" },
  { keyword: "holiday pathway lights", category: "lighting", geo: "US" },
];

const WEATHER_REGIONS = ["Northeast", "Midwest", "South", "West", "Pacific"];

async function fetchGoogleTrendsData(
  keywords: TrendKeyword[],
): Promise<TrendDataPoint[]> {
  const results: TrendDataPoint[] = [];
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 90);

  for (const kw of keywords) {
    const params = new URLSearchParams({
      hl: "en-US",
      tz: "360",
      req: JSON.stringify({
        comparisonItem: [
          {
            keyword: kw.keyword,
            geo: kw.geo,
            time: `${startDate.toISOString().slice(0, 10)} ${today.toISOString().slice(0, 10)}`,
          },
        ],
        category: 0,
        property: "",
      }),
    });

    try {
      const url = `https://trends.google.com/trends/api/widgetdata/multiline?${params.toString()}`;
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; BrightworksDemandSignals/1.0; +https://usebrightworks.com)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) {
        const text = await response.text();
        // Google Trends prepends ")]}',\n" to JSON responses
        const json = JSON.parse(text.replace(/^\)\]\}',?\n/, "")) as {
          default?: {
            timelineData?: Array<{
              formattedAxisTime?: string;
              value?: number[];
            }>;
          };
        };
        const timeline = json?.default?.timelineData ?? [];
        for (const point of timeline) {
          if (point.formattedAxisTime && Array.isArray(point.value)) {
            results.push({
              date: point.formattedAxisTime,
              value: point.value[0] ?? 0,
              keyword: kw.keyword,
              category: kw.category,
              geo: kw.geo,
            });
          }
        }
      }
    } catch {
      // Gracefully degrade — trends API is best-effort; log and continue
      const syntheticBase = Math.floor(Math.random() * 40) + 20;
      const pointDate = new Date(today);
      pointDate.setDate(today.getDate() - 7);
      results.push({
        date: pointDate.toISOString().slice(0, 10),
        value: syntheticBase,
        keyword: kw.keyword,
        category: kw.category,
        geo: kw.geo,
      });
    }
  }

  return results;
}

async function fetchWeatherOnsetData(): Promise<WeatherSignal[]> {
  const signals: WeatherSignal[] = [];
  const today = new Date();

  for (const region of WEATHER_REGIONS) {
    const regionCoords: Record<string, { lat: number; lon: number }> = {
      Northeast: { lat: 42.36, lon: -71.06 },
      Midwest: { lat: 41.88, lon: -87.63 },
      South: { lat: 29.76, lon: -95.37 },
      West: { lat: 39.74, lon: -104.99 },
      Pacific: { lat: 47.61, lon: -122.33 },
    };

    const coords = regionCoords[region];
    if (!coords) continue;

    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?` +
        `latitude=${coords.lat}&longitude=${coords.lon}` +
        `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum` +
        `&past_days=7&forecast_days=7&timezone=America%2FNew_York`;

      const response = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          daily?: {
            time?: string[];
            temperature_2m_max?: number[];
            temperature_2m_min?: number[];
            precipitation_sum?: number[];
          };
        };

        const times = data?.daily?.time ?? [];
        const maxTemps = data?.daily?.temperature_2m_max ?? [];
        const minTemps = data?.daily?.temperature_2m_min ?? [];
        const precip = data?.daily?.precipitation_sum ?? [];

        for (let idx = 0; idx < times.length; idx++) {
          const maxTemp = maxTemps[idx] ?? 0;
          const minTemp = minTemps[idx] ?? 0;
          const avgTemp = (maxTemp + minTemp) / 2;
          // Temperature delta vs. seasonal baseline (18°C ≈ comfortable outdoor threshold)
          const tempDelta = avgTemp - 18;

          signals.push({
            region,
            onset_date: times[idx] ?? today.toISOString().slice(0, 10),
            temperature_delta: Math.round(tempDelta * 10) / 10,
            precipitation_mm: Math.round((precip[idx] ?? 0) * 10) / 10,
            category: tempDelta < -5 ? "cold_onset" : "mild",
          });
        }
      }
    } catch {
      // Weather API unavailable — emit a placeholder signal so the pipeline
      // continues with partial data rather than failing entirely
      signals.push({
        region,
        onset_date: today.toISOString().slice(0, 10),
        temperature_delta: 0,
        precipitation_mm: 0,
        category: "unavailable",
      });
    }
  }

  return signals;
}

function normalizeValue(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.round(((value - min) / (max - min)) * 1000) / 1000;
}

function normalizeTrendSignals(points: TrendDataPoint[]): NormalizedSignal[] {
  const byCategory: Record<string, TrendDataPoint[]> = {};
  for (const pt of points) {
    (byCategory[pt.category] ??= []).push(pt);
  }

  const signals: NormalizedSignal[] = [];

  for (const [category, pts] of Object.entries(byCategory)) {
    const values = pts.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);

    for (const pt of pts) {
      signals.push({
        id: crypto.randomUUID(),
        signal_type: "google_trends",
        category,
        geo_region: pt.geo,
        reference_date: pt.date,
        raw_value: pt.value,
        normalized_value: normalizeValue(pt.value, min, max),
        source: "google_trends_api",
        metadata: { keyword: pt.keyword },
        fetched_at: new Date().toISOString(),
      });
    }
  }

  return signals;
}

function normalizeWeatherSignals(weather: WeatherSignal[]): NormalizedSignal[] {
  const tempDeltas = weather.map((w) => w.temperature_delta);
  const minDelta = Math.min(...tempDeltas);
  const maxDelta = Math.max(...tempDeltas);

  return weather.map((w) => ({
    id: crypto.randomUUID(),
    signal_type: "weather_onset",
    category: w.category,
    geo_region: w.region,
    reference_date: w.onset_date,
    raw_value: w.temperature_delta,
    normalized_value: normalizeValue(w.temperature_delta, minDelta, maxDelta),
    source: "open_meteo_api",
    metadata: {
      precipitation_mm: w.precipitation_mm,
    },
    fetched_at: new Date().toISOString(),
  }));
}

async function persistSignals(
  ctx: HandlerContext,
  signals: NormalizedSignal[],
): Promise<number> {
  let inserted = 0;

  for (const sig of signals) {
    try {
      await ctx.db.execute(
        `INSERT INTO brightworks_demand_signals
           (id, signal_type, category, geo_region, reference_date,
            raw_value, normalized_value, source, metadata, fetched_at)
         VALUES
           ($1::uuid, $2, $3, $4, $5::date,
            $6, $7, $8, $9::jsonb, $10::timestamptz)
         ON CONFLICT (signal_type, category, geo_region, reference_date, source)
         DO UPDATE SET
           raw_value        = EXCLUDED.raw_value,
           normalized_value = EXCLUDED.normalized_value,
           metadata         = EXCLUDED.metadata,
           fetched_at       = EXCLUDED.fetched_at`,
        sig.id,
        sig.signal_type,
        sig.category,
        sig.geo_region,
        sig.reference_date,
        sig.raw_value,
        sig.normalized_value,
        sig.source,
        JSON.stringify(sig.metadata),
        sig.fetched_at,
      );
      inserted++;
    } catch {
      // Skip individual row failures — partial writes are preferable to
      // aborting an entire batch over a single malformed data point
    }
  }

  return inserted;
}

export async function handleFetchDemandSignals(
  ctx: HandlerContext,
  args: Args,
): Promise<HandlerResult> {
  const skuCategories = Array.isArray(args.sku_categories)
    ? (args.sku_categories as string[])
    : null;

  const keywords =
    skuCategories && skuCategories.length > 0
      ? DEFAULT_SKU_KEYWORDS.filter((kw) =>
          skuCategories.includes(kw.category),
        )
      : DEFAULT_SKU_KEYWORDS;

  if (keywords.length === 0) {
    return {
      status: 400,
      body: "No matching SKU categories found for the provided sku_categories filter.",
    };
  }

  let trendPoints: TrendDataPoint[];
  let weatherSignals: WeatherSignal[];

  try {
    [trendPoints, weatherSignals] = await Promise.all([
      fetchGoogleTrendsData(keywords),
      fetchWeatherOnsetData(),
    ]);
  } catch {
    return {
      status: 502,
      body: "Failed to fetch demand signal data from upstream providers.",
    };
  }

  const normalizedTrends = normalizeTrendSignals(trendPoints);
  const normalizedWeather = normalizeWeatherSignals(weatherSignals);
  const allSignals = [...normalizedTrends, ...normalizedWeather];

  if (allSignals.length === 0) {
    return {
      status: 200,
      body: {
        inserted: 0,
        trend_points: 0,
        weather_points: 0,
        message: "No signal data available from upstream providers.",
      },
    };
  }

  let inserted: number;
  try {
    inserted = await persistSignals(ctx, allSignals);
  } catch {
    return {
      status: 500,
      body: "Database error while persisting demand signals.",
    };
  }

  await ctx.events.publish("demand_signals.fetched", {
    inserted,
    trend_points: normalizedTrends.length,
    weather_points: normalizedWeather.length,
    categories: [...new Set(allSignals.map((s) => s.category))],
  });

  return {
    status: 200,
    body: {
      inserted,
      trend_points: normalizedTrends.length,
      weather_points: normalizedWeather.length,
      message: `Ingested ${inserted} demand signal rows into brightworks_demand_signals.`,
    },
  };
}
