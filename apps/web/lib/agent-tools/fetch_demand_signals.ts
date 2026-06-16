/**
 * fetch_demand_signals — confirm-gated mutation handler.
 *
 * Ingests Google Trends holiday search volume and regional weather-onset
 * data for configured SKU categories, then writes normalized signal rows
 * to brightworks_demand_signals for the forecasting engine.
 *
 * Autonomy: confirm — returns a pending confirmation when `confirmed` is
 * not true; proceeds with the mutation once confirmed.
 */

import type { HandlerContext, HandlerResult } from "@nexus/identity-and-access";

type Args = Record<string, unknown>;

interface TrendsDataPoint {
  date: string;
  value: number;
}

interface WeatherSignal {
  region: string;
  onset_date: string;
  temperature_delta: number;
  precipitation_index: number;
}

interface SignalRow {
  category: string;
  signal_type: "trends" | "weather";
  region: string;
  period_start: string;
  period_end: string;
  raw_value: number;
  normalized_value: number;
  source_metadata: Record<string, unknown>;
}

const SKU_CATEGORIES = (
  process.env.DEMAND_SIGNAL_CATEGORIES ?? "flooring,windows,doors,roofing,siding"
)
  .split(",")
  .map((s) => s.trim());

const REGIONS = (
  process.env.DEMAND_SIGNAL_REGIONS ?? "US-CA,US-TX,US-FL,US-NY,US-IL"
)
  .split(",")
  .map((s) => s.trim());

async function fetchGoogleTrends(
  category: string,
  region: string
): Promise<TrendsDataPoint[]> {
  const apiKey = process.env.SERPAPI_KEY ?? "";
  if (!apiKey) return [];

  const params = new URLSearchParams({
    engine: "google_trends",
    q: category,
    geo: region.replace("-", "_"),
    date: "today 12-m",
    api_key: apiKey,
  });

  let response: Response;
  try {
    response = await fetch(`https://serpapi.com/search?${params.toString()}`, {
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return [];
  }

  if (!response.ok) return [];

  const data = (await response.json()) as {
    interest_over_time?: {
      timeline_data?: Array<{
        date: string;
        values?: Array<{ extracted_value?: number }>;
      }>;
    };
  };

  const timeline = data?.interest_over_time?.timeline_data ?? [];
  return timeline.map((point) => ({
    date: point.date,
    value: point.values?.[0]?.extracted_value ?? 0,
  }));
}

async function fetchWeatherOnset(
  region: string
): Promise<WeatherSignal | null> {
  const apiKey = process.env.OPENWEATHER_API_KEY ?? "";
  if (!apiKey) return null;

  const regionCoords: Record<string, [number, number]> = {
    "US-CA": [36.7783, -119.4179],
    "US-TX": [31.9686, -99.9018],
    "US-FL": [27.6648, -81.5158],
    "US-NY": [42.1657, -74.9481],
    "US-IL": [40.3495, -88.9861],
  };

  const coords = regionCoords[region];
  if (!coords) return null;

  const [lat, lon] = coords;
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    appid: apiKey,
    units: "imperial",
  });

  let response: Response;
  try {
    response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?${params.toString()}`,
      { signal: AbortSignal.timeout(10_000) }
    );
  } catch {
    return null;
  }

  if (!response.ok) return null;

  const data = (await response.json()) as {
    main?: { temp?: number };
    rain?: { "1h"?: number };
    snow?: { "1h"?: number };
  };

  const today = new Date().toISOString().slice(0, 10);
  const temp = data?.main?.temp ?? 0;
  const precipIndex = (data?.rain?.["1h"] ?? 0) + (data?.snow?.["1h"] ?? 0);

  return {
    region,
    onset_date: today,
    temperature_delta: temp - 65,
    precipitation_index: precipIndex,
  };
}

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

async function upsertSignalRows(
  ctx: HandlerContext,
  rows: SignalRow[]
): Promise<number> {
  let inserted = 0;
  for (const row of rows) {
    await ctx.db.execute(
      `INSERT INTO brightworks_demand_signals (
         id, category, signal_type, region, period_start, period_end,
         raw_value, normalized_value, source_metadata, ingested_at
       ) VALUES (
         gen_random_uuid(), $1, $2, $3, $4::date, $5::date,
         $6, $7, $8::jsonb, NOW()
       )
       ON CONFLICT (category, signal_type, region, period_start)
       DO UPDATE SET
         raw_value = EXCLUDED.raw_value,
         normalized_value = EXCLUDED.normalized_value,
         source_metadata = EXCLUDED.source_metadata,
         ingested_at = NOW()`,
      row.category,
      row.signal_type,
      row.region,
      row.period_start,
      row.period_end,
      row.raw_value,
      row.normalized_value,
      JSON.stringify(row.source_metadata)
    );
    inserted++;
  }
  return inserted;
}

export async function handleFetchDemandSignals(
  ctx: HandlerContext,
  args: Args
): Promise<HandlerResult> {
  const confirmed = args.confirmed === true;

  const categories = Array.isArray(args.categories)
    ? (args.categories as string[]).filter((c): c is string => typeof c === "string")
    : SKU_CATEGORIES;

  const regions = Array.isArray(args.regions)
    ? (args.regions as string[]).filter((r): r is string => typeof r === "string")
    : REGIONS;

  if (!confirmed) {
    return {
      status: 202,
      body: {
        pending_confirmation: true,
        action: "fetch_demand_signals",
        description:
          "Fetch Google Trends holiday search volume and regional weather-onset data, " +
          "then write normalized rows to brightworks_demand_signals.",
        scope: {
          categories,
          regions,
          estimated_rows: categories.length * regions.length * 2,
        },
        instructions: "Re-invoke with confirmed: true to proceed.",
      },
    };
  }

  const signalRows: SignalRow[] = [];
  const errors: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const yearAgo = new Date(Date.now() - 365 * 24 * 3_600_000)
    .toISOString()
    .slice(0, 10);

  for (const category of categories) {
    for (const region of regions) {
      try {
        const trendPoints = await fetchGoogleTrends(category, region);
        const values = trendPoints.map((p) => p.value);
        const min = values.length > 0 ? Math.min(...values) : 0;
        const max = values.length > 0 ? Math.max(...values) : 0;
        const latestPoint = trendPoints[trendPoints.length - 1];

        signalRows.push({
          category,
          signal_type: "trends",
          region,
          period_start: yearAgo,
          period_end: today,
          raw_value: latestPoint?.value ?? 0,
          normalized_value:
            latestPoint != null ? normalize(latestPoint.value, min, max) : 0,
          source_metadata:
            trendPoints.length > 0
              ? {
                  source: "google_trends",
                  data_points: trendPoints.length,
                  period: "12m",
                  latest_date: latestPoint?.date,
                }
              : { source: "google_trends", note: "no_data_available" },
        });
      } catch (fetchErr) {
        errors.push(`trends/${category}/${region}: ${String(fetchErr)}`);
      }
    }
  }

  const seenRegions = new Set<string>();
  for (const region of regions) {
    if (seenRegions.has(region)) continue;
    seenRegions.add(region);

    try {
      const weather = await fetchWeatherOnset(region);
      const rawValue = weather?.temperature_delta ?? 0;

      for (const category of categories) {
        signalRows.push({
          category,
          signal_type: "weather",
          region,
          period_start: today,
          period_end: today,
          raw_value: rawValue,
          normalized_value: normalize(rawValue, -40, 40),
          source_metadata: weather
            ? {
                source: "openweathermap",
                onset_date: weather.onset_date,
                temperature_delta: weather.temperature_delta,
                precipitation_index: weather.precipitation_index,
              }
            : { source: "openweathermap", note: "no_data_available" },
        });
      }
    } catch (weatherErr) {
      errors.push(`weather/${region}: ${String(weatherErr)}`);
    }
  }

  if (signalRows.length === 0) {
    return {
      status: 422,
      body: "No signal rows could be generated. Verify SERPAPI_KEY and OPENWEATHER_API_KEY env vars.",
    };
  }

  let insertedCount = 0;
  try {
    insertedCount = await upsertSignalRows(ctx, signalRows);
  } catch (dbErr) {
    await ctx.events.publish("demand_signals.ingest_failed", {
      error: String(dbErr),
      categories,
      regions,
    });
    return { status: 500, body: "Failed to write demand signals to database." };
  }

  await ctx.events.publish("demand_signals.ingested", {
    categories,
    regions,
    inserted: insertedCount,
    errors: errors.length,
  });

  return {
    status: 200,
    body: {
      success: true,
      inserted: insertedCount,
      categories,
      regions,
      ...(errors.length > 0 ? { errors } : {}),
    },
  };
}
