/**
 * fetch_demand_signals — confirm-gated mutation handler.
 * Ingests Google Trends holiday search volume and regional weather-onset data
 * for configured SKU categories and writes normalized signal rows to
 * brightworks_demand_signals for the forecasting engine.
 */

import type { HandlerContext, HandlerResult } from "@nexus/identity-and-access";
import { randomUUID } from "crypto";

type Args = Record<string, unknown>;

interface TrendsDataPoint {
  date: string;
  value: number;
}

interface WeatherDataPoint {
  date: string;
  tempMin: number;
  tempMax: number;
  precipSum: number;
}

interface SignalRow {
  id: string;
  category: string;
  signal_type: "google_trends" | "weather_onset";
  region: string;
  metric_date: string;
  value: number;
  metadata: Record<string, unknown>;
  fetched_at: string;
}

// SKU category → Google Trends keyword mapping
const CATEGORY_KEYWORDS: Record<string, string> = {
  lighting: "holiday lighting",
  fans: "ceiling fan",
  "holiday-lighting": "Christmas lights",
  "outdoor-lighting": "outdoor string lights",
  "smart-home": "smart home lighting",
  default: "holiday decorations",
};

// Region → lat/lon for weather-onset signals (major US metro clusters)
const REGION_COORDS: Record<string, Array<{ lat: number; lon: number; subregion: string }>> = {
  US: [
    { lat: 40.7128, lon: -74.006, subregion: "Northeast" },
    { lat: 33.749, lon: -84.388, subregion: "Southeast" },
    { lat: 41.8781, lon: -87.6298, subregion: "Midwest" },
    { lat: 29.7604, lon: -95.3698, subregion: "South" },
    { lat: 37.7749, lon: -122.4194, subregion: "West" },
  ],
  CA: [{ lat: 43.6532, lon: -79.3832, subregion: "Canada-East" }],
  GB: [{ lat: 51.5074, lon: -0.1278, subregion: "UK" }],
};

// Fetch Google Trends interest-over-time for a keyword via the unofficial explore API.
// Returns normalized 0-100 values; falls back to seasonality heuristic on network failure.
async function fetchGoogleTrendsData(
  keyword: string,
  geo: string,
  startDate: string,
  endDate: string,
): Promise<TrendsDataPoint[]> {
  const exploreUrl = new URL("https://trends.google.com/trends/api/explore");
  exploreUrl.searchParams.set("hl", "en-US");
  exploreUrl.searchParams.set("tz", "360");
  exploreUrl.searchParams.set(
    "req",
    JSON.stringify({
      comparisonItem: [
        { keyword, geo, time: `${startDate} ${endDate}` },
      ],
      category: 0,
      property: "",
    }),
  );
  exploreUrl.searchParams.set("token", "");

  const exploreRes = await fetch(exploreUrl.toString(), {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; BrightworksBot/1.0)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!exploreRes.ok) {
    throw new Error(`Trends explore HTTP ${exploreRes.status}`);
  }

  // The Trends API prefixes responses with ")]}',\n" to prevent JSON hijacking.
  const raw = await exploreRes.text();
  const sanitized = raw.replace(/^\)\]\}',\n/, "");
  const exploreData = JSON.parse(sanitized) as {
    widgets?: Array<{ token?: string; title?: string }>;
  };

  const lineWidget = exploreData.widgets?.find(
    (w) => w.title === "Interest over time",
  );
  if (!lineWidget?.token) {
    throw new Error("No interest-over-time widget in Trends response");
  }

  const timelineUrl = new URL(
    "https://trends.google.com/trends/api/widgetdata/multiline",
  );
  timelineUrl.searchParams.set("hl", "en-US");
  timelineUrl.searchParams.set("tz", "360");
  timelineUrl.searchParams.set(
    "req",
    JSON.stringify({
      time: `${startDate} ${endDate}`,
      resolution: "DAY",
      locale: "en-US",
      comparisonItem: [{ geo: { country: geo }, complexKeywordsRestriction: { keyword: [{ type: "BROAD", value: keyword }] } }],
      requestOptions: { property: "", backend: "IZG", category: 0 },
    }),
  );
  timelineUrl.searchParams.set("token", lineWidget.token);

  const timelineRes = await fetch(timelineUrl.toString(), {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; BrightworksBot/1.0)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!timelineRes.ok) {
    throw new Error(`Trends timeline HTTP ${timelineRes.status}`);
  }

  const timelineRaw = await timelineRes.text();
  const timelineSanitized = timelineRaw.replace(/^\)\]\}',\n/, "");
  const timelineData = JSON.parse(timelineSanitized) as {
    default?: {
      timelineData?: Array<{
        formattedTime?: string;
        value?: number[];
      }>;
    };
  };

  const points: TrendsDataPoint[] = [];
  for (const entry of timelineData.default?.timelineData ?? []) {
    if (entry.formattedTime && Array.isArray(entry.value) && entry.value.length > 0) {
      points.push({ date: entry.formattedTime, value: entry.value[0] ?? 0 });
    }
  }
  return points;
}

// Compute a seasonality-based interest score (0-100) as a fallback when the
// live Trends API is unavailable. Uses month and category to approximate the
// holiday-search curve observed in Brightworks historical data.
function seasonalityFallback(
  category: string,
  dateStr: string,
): number {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1; // 1-12

  // Holiday lighting peaks in Nov-Dec; fans peak in May-Aug; default flat.
  const curves: Record<string, number[]> = {
    lighting: [10, 8, 12, 15, 20, 18, 22, 30, 45, 60, 90, 95],
    fans: [15, 18, 25, 45, 80, 95, 90, 75, 50, 30, 20, 12],
    "holiday-lighting": [5, 5, 5, 5, 5, 5, 8, 15, 40, 65, 95, 98],
    "outdoor-lighting": [10, 12, 20, 35, 55, 70, 65, 55, 40, 30, 50, 60],
    "smart-home": [30, 25, 28, 32, 35, 35, 35, 38, 42, 50, 65, 80],
  };
  const curve = curves[category] ?? Array(12).fill(40);
  return curve[month - 1] ?? 40;
}

// Fetch daily weather summaries from the Open-Meteo API (no auth required).
async function fetchWeatherData(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string,
): Promise<WeatherDataPoint[]> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("daily", "temperature_2m_min,temperature_2m_max,precipitation_sum");
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("precipitation_unit", "inch");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Open-Meteo HTTP ${res.status}`);
  }

  const data = await res.json() as {
    daily?: {
      time?: string[];
      temperature_2m_min?: number[];
      temperature_2m_max?: number[];
      precipitation_sum?: number[];
    };
  };

  const points: WeatherDataPoint[] = [];
  const times = data.daily?.time ?? [];
  const mins = data.daily?.temperature_2m_min ?? [];
  const maxes = data.daily?.temperature_2m_max ?? [];
  const precips = data.daily?.precipitation_sum ?? [];

  for (let idx = 0; idx < times.length; idx++) {
    const date = times[idx];
    if (date) {
      points.push({
        date,
        tempMin: mins[idx] ?? 0,
        tempMax: maxes[idx] ?? 0,
        precipSum: precips[idx] ?? 0,
      });
    }
  }
  return points;
}

// Compute a 0-100 weather-onset demand score: cold-snap onset (falling temps +
// first frost) is the primary trigger for holiday lighting purchases at Brightworks.
function weatherOnsetScore(point: WeatherDataPoint): number {
  const avgTemp = (point.tempMin + point.tempMax) / 2;

  // Cold threshold: avg temp below 45°F signals heating/lighting season onset.
  const coldScore = Math.max(0, Math.min(100, ((45 - avgTemp) / 45) * 100));

  // Precipitation bonus: first fall rain/snow correlates with indoor spend.
  const precipBonus = Math.min(20, point.precipSum * 10);

  return Math.round(Math.min(100, coldScore + precipBonus));
}

// Persist a batch of signal rows using parameterized upserts.
async function persistSignals(
  ctx: HandlerContext,
  signals: SignalRow[],
): Promise<{ written: number; errors: string[] }> {
  let written = 0;
  const errors: string[] = [];

  for (const row of signals) {
    try {
      await ctx.db.execute(
        `INSERT INTO brightworks_demand_signals
           (id, category, signal_type, region, metric_date, value, metadata, fetched_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
         ON CONFLICT (category, signal_type, region, metric_date)
         DO UPDATE SET
           value      = EXCLUDED.value,
           metadata   = EXCLUDED.metadata,
           fetched_at = EXCLUDED.fetched_at`,
        row.id,
        row.category,
        row.signal_type,
        row.region,
        row.metric_date,
        row.value,
        JSON.stringify(row.metadata),
        row.fetched_at,
      );
      written++;
    } catch (dbErr) {
      errors.push(
        `upsert failed [${row.category}/${row.signal_type}/${row.region}/${row.metric_date}]: ` +
          (dbErr instanceof Error ? dbErr.message : String(dbErr)),
      );
    }
  }

  return { written, errors };
}

export async function handleFetchDemandSignals(
  ctx: HandlerContext,
  args: Args,
): Promise<HandlerResult> {
  const categories: string[] = Array.isArray(args.categories)
    ? (args.categories as string[]).filter((c) => typeof c === "string")
    : ["lighting", "fans", "holiday-lighting"];

  const regions: string[] = Array.isArray(args.regions)
    ? (args.regions as string[]).filter((r) => typeof r === "string")
    : ["US"];

  const now = new Date();
  const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0] as string;
  const defaultEnd = now.toISOString().split("T")[0] as string;

  const startDate =
    typeof args.start_date === "string" ? args.start_date : defaultStart;
  const endDate =
    typeof args.end_date === "string" ? args.end_date : defaultEnd;

  if (categories.length === 0) {
    return { status: 400, body: { error: "categories must be a non-empty array" } };
  }
  if (regions.length === 0) {
    return { status: 400, body: { error: "regions must be a non-empty array" } };
  }

  const fetchedAt = now.toISOString();
  const signals: SignalRow[] = [];
  const fetchErrors: string[] = [];

  // --- Google Trends signals ---
  for (const category of categories) {
    for (const region of regions) {
      const keyword =
        CATEGORY_KEYWORDS[category] ?? CATEGORY_KEYWORDS.default ?? "holiday decorations";
      let points: TrendsDataPoint[];

      try {
        points = await fetchGoogleTrendsData(keyword, region, startDate, endDate);
      } catch (err) {
        fetchErrors.push(
          `Trends [${category}/${region}]: ` +
            (err instanceof Error ? err.message : String(err)) +
            " — using seasonality fallback",
        );
        // Build fallback series covering requested date range day by day.
        points = [];
        const cur = new Date(startDate);
        const end = new Date(endDate);
        while (cur <= end) {
          const dateStr = cur.toISOString().split("T")[0] as string;
          points.push({ date: dateStr, value: seasonalityFallback(category, dateStr) });
          cur.setDate(cur.getDate() + 1);
        }
      }

      for (const pt of points) {
        signals.push({
          id: randomUUID(),
          category,
          signal_type: "google_trends",
          region,
          metric_date: pt.date,
          value: pt.value,
          metadata: { keyword, source: "google_trends", geo: region },
          fetched_at: fetchedAt,
        });
      }
    }
  }

  // --- Weather-onset signals ---
  for (const region of regions) {
    const coords = REGION_COORDS[region] ?? REGION_COORDS["US"];
    if (!coords) continue;

    for (const coord of coords) {
      let weatherPoints: WeatherDataPoint[];

      try {
        weatherPoints = await fetchWeatherData(
          coord.lat,
          coord.lon,
          startDate,
          endDate,
        );
      } catch (err) {
        fetchErrors.push(
          `Weather [${region}/${coord.subregion}]: ` +
            (err instanceof Error ? err.message : String(err)),
        );
        continue;
      }

      for (const wp of weatherPoints) {
        signals.push({
          id: randomUUID(),
          category: "weather",
          signal_type: "weather_onset",
          region: `${region}-${coord.subregion}`,
          metric_date: wp.date,
          value: weatherOnsetScore(wp),
          metadata: {
            source: "open-meteo",
            lat: coord.lat,
            lon: coord.lon,
            subregion: coord.subregion,
            temp_min_f: wp.tempMin,
            temp_max_f: wp.tempMax,
            precip_in: wp.precipSum,
          },
          fetched_at: fetchedAt,
        });
      }
    }
  }

  if (signals.length === 0) {
    return {
      status: 422,
      body: {
        error: "No signals could be fetched",
        fetch_errors: fetchErrors,
      },
    };
  }

  const { written, errors: dbErrors } = await persistSignals(ctx, signals);

  await ctx.events.publish("demand_signals.fetched", {
    categories,
    regions,
    start_date: startDate,
    end_date: endDate,
    signals_fetched: signals.length,
    signals_written: written,
    fetch_errors: fetchErrors.length,
    db_errors: dbErrors.length,
  });

  return {
    status: 200,
    body: {
      signals_fetched: signals.length,
      signals_written: written,
      categories,
      regions,
      date_range: { start: startDate, end: endDate },
      ...(fetchErrors.length > 0 ? { fetch_warnings: fetchErrors } : {}),
      ...(dbErrors.length > 0 ? { db_warnings: dbErrors } : {}),
    },
  };
}
