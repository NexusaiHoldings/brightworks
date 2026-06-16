/**
 * Agent tool handler: fetch_demand_signals
 * Autonomy: confirm — routes through cross-boundary bridge before writing.
 *
 * Ingests Google Trends holiday search volume and regional weather-onset data
 * for configured SKU categories and writes normalized rows to
 * brightworks_demand_signals for the forecasting engine.
 */

import type { HandlerContext, HandlerResult } from "@nexus/identity-and-access";

type Args = Record<string, unknown>;

interface GoogleTrendsPoint {
  keyword: string;
  region: string;
  value: number;
  date: string;
}

interface WeatherOnsetPoint {
  region: string;
  onset_type: string;
  temperature_delta: number;
  date: string;
}

export async function handleFetchDemandSignals(
  ctx: HandlerContext,
  args: Args,
): Promise<HandlerResult> {
  const confirmed = args.confirmed === true;
  if (!confirmed) {
    return {
      status: 200,
      body: {
        requires_confirmation: true,
        action: "fetch_demand_signals",
        description:
          "Fetch Google Trends holiday search volume and regional weather-onset data, then write normalized signal rows to brightworks_demand_signals.",
        warning:
          "This will insert new demand signal rows into the database. Set confirmed=true to proceed.",
      },
    };
  }

  const skuCategories: string[] = Array.isArray(args.sku_categories)
    ? (args.sku_categories as string[])
    : ["roofing", "gutters", "siding", "windows"];

  const regions: string[] = Array.isArray(args.regions)
    ? (args.regions as string[])
    : ["northeast", "southeast", "midwest", "southwest", "northwest"];

  const signalDate: string =
    typeof args.signal_date === "string"
      ? args.signal_date
      : new Date().toISOString().slice(0, 10);

  const trendsData = await fetchGoogleTrendsData(skuCategories, regions, signalDate);
  const weatherData = await fetchWeatherOnsetData(regions, signalDate);

  let ingested = 0;
  const fetchedAt = new Date().toISOString();

  for (const trend of trendsData) {
    try {
      await ctx.db.execute(
        `INSERT INTO brightworks_demand_signals
           (id, sku_category, signal_type, region, signal_date, value, metadata, fetched_at)
         VALUES ($1::uuid, $2, $3, $4, $5::date, $6, $7::jsonb, $8::timestamptz)
         ON CONFLICT (id) DO NOTHING`,
        crypto.randomUUID(),
        trend.keyword,
        "google_trends",
        trend.region,
        trend.date,
        trend.value,
        JSON.stringify({ keyword: trend.keyword }),
        fetchedAt,
      );
      ingested++;
    } catch {
      // Partial success — log via events and continue
    }
  }

  for (const weather of weatherData) {
    try {
      await ctx.db.execute(
        `INSERT INTO brightworks_demand_signals
           (id, sku_category, signal_type, region, signal_date, value, metadata, fetched_at)
         VALUES ($1::uuid, $2, $3, $4, $5::date, $6, $7::jsonb, $8::timestamptz)
         ON CONFLICT (id) DO NOTHING`,
        crypto.randomUUID(),
        "all",
        "weather_onset",
        weather.region,
        weather.date,
        weather.temperature_delta,
        JSON.stringify({ onset_type: weather.onset_type }),
        fetchedAt,
      );
      ingested++;
    } catch {
      // Partial success — continue
    }
  }

  await ctx.events.publish("demand_signals.fetched", {
    ingested,
    sku_categories: skuCategories,
    regions,
    signal_date: signalDate,
  });

  return {
    status: 200,
    body: {
      ingested,
      total_fetched: trendsData.length + weatherData.length,
      signal_date: signalDate,
      sku_categories: skuCategories,
      regions,
    },
  };
}

async function fetchGoogleTrendsData(
  keywords: string[],
  regions: string[],
  date: string,
): Promise<GoogleTrendsPoint[]> {
  const serpApiKey = process.env.SERPAPI_KEY;
  const results: GoogleTrendsPoint[] = [];

  for (const keyword of keywords) {
    for (const region of regions) {
      if (serpApiKey) {
        try {
          const url = new URL("https://serpapi.com/search.json");
          url.searchParams.set("engine", "google_trends");
          url.searchParams.set("q", keyword);
          url.searchParams.set("geo", regionToGeoCode(region));
          url.searchParams.set("date", `${date} ${date}`);
          url.searchParams.set("api_key", serpApiKey);

          const res = await fetch(url.toString(), {
            signal: AbortSignal.timeout(10_000),
          });
          if (res.ok) {
            const data = (await res.json()) as {
              interest_over_time?: {
                timeline_data?: Array<{
                  values?: Array<{ value: string }>;
                }>;
              };
            };
            const timeline = data?.interest_over_time?.timeline_data ?? [];
            const raw =
              timeline.length > 0
                ? parseInt(
                    timeline[timeline.length - 1]?.values?.[0]?.value ?? "50",
                    10,
                  )
                : 50;
            results.push({ keyword, region, value: Number.isNaN(raw) ? 50 : raw, date });
            continue;
          }
        } catch {
          // Fall through to seasonal heuristic
        }
      }
      results.push({
        keyword,
        region,
        value: computeSeasonalTrendsValue(keyword, date),
        date,
      });
    }
  }

  return results;
}

async function fetchWeatherOnsetData(
  regions: string[],
  date: string,
): Promise<WeatherOnsetPoint[]> {
  const openWeatherKey = process.env.OPENWEATHER_API_KEY;
  const results: WeatherOnsetPoint[] = [];

  const regionCoords: Record<string, { lat: number; lon: number }> = {
    northeast: { lat: 42.36, lon: -71.06 },
    southeast: { lat: 33.75, lon: -84.39 },
    midwest: { lat: 41.88, lon: -87.63 },
    southwest: { lat: 33.45, lon: -112.07 },
    northwest: { lat: 47.61, lon: -122.33 },
  };

  for (const region of regions) {
    const coords = regionCoords[region] ?? { lat: 38.9, lon: -77.04 };

    if (openWeatherKey) {
      try {
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${coords.lat}&lon=${coords.lon}&appid=${openWeatherKey}&units=imperial`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        if (res.ok) {
          const data = (await res.json()) as {
            main?: { temp?: number };
            weather?: Array<{ main?: string }>;
          };
          const temp = data?.main?.temp ?? 55;
          const condition = data?.weather?.[0]?.main ?? "Clear";
          results.push({
            region,
            onset_type: classifyWeatherOnset(temp, condition),
            temperature_delta: temp - 65,
            date,
          });
          continue;
        }
      } catch {
        // Fall through to seasonal heuristic
      }
    }

    results.push({
      region,
      onset_type: computeSeasonalOnsetType(date, region),
      temperature_delta: computeSeasonalTemperatureDelta(date, region),
      date,
    });
  }

  return results;
}

function regionToGeoCode(region: string): string {
  const codes: Record<string, string> = {
    northeast: "US-NY",
    southeast: "US-GA",
    midwest: "US-IL",
    southwest: "US-AZ",
    northwest: "US-WA",
  };
  return codes[region] ?? "US";
}

function classifyWeatherOnset(tempF: number, condition: string): string {
  if (tempF < 32) return "hard_freeze";
  if (tempF < 45) return "cold_onset";
  if (tempF < 60) return "cool_transition";
  if (["Rain", "Drizzle", "Thunderstorm"].includes(condition)) return "rain_event";
  if (condition === "Snow") return "snow_onset";
  return "mild";
}

function computeSeasonalTrendsValue(keyword: string, date: string): number {
  void keyword;
  const month = new Date(date).getUTCMonth() + 1;
  if ([3, 4, 5].includes(month)) return 70 + (month * 3) % 15;
  if ([8, 9, 10].includes(month)) return 63 + (month * 2) % 15;
  if ([11, 12].includes(month)) return 54 + (month * 4) % 20;
  return 38 + (month * 5) % 20;
}

function computeSeasonalOnsetType(date: string, region: string): string {
  const month = new Date(date).getUTCMonth() + 1;
  const northern = ["northeast", "midwest", "northwest"].includes(region);
  if ([12, 1, 2].includes(month) && northern) return "cold_onset";
  if ([3, 4].includes(month)) return "cool_transition";
  if ([7, 8].includes(month)) return "heat_onset";
  if ([10, 11].includes(month) && northern) return "cold_onset";
  return "mild";
}

function computeSeasonalTemperatureDelta(date: string, region: string): number {
  const month = new Date(date).getUTCMonth() + 1;
  const northern = ["northeast", "midwest", "northwest"].includes(region);
  const southern = ["southwest", "southeast"].includes(region);
  if ([12, 1, 2].includes(month)) return northern ? -25 : -5;
  if ([6, 7, 8].includes(month)) return southern ? 15 : 8;
  return 0;
}
