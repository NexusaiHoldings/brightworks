/**
 * Agent tool handler: fetch_demand_signals
 * Confirm-gated mutation. Ingests Google Trends holiday search volume and
 * regional weather-onset data for configured SKU categories, then writes
 * normalized signal rows to brightworks_demand_signals for the forecasting engine.
 */

import type { HandlerContext, HandlerResult } from "@nexus/identity-and-access";

type Args = Record<string, unknown>;

interface TrendTimelineItem {
  formattedAxisLabel?: string;
  formattedTime?: string;
  value?: number[];
}

interface WeatherDailyResponse {
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
  };
}

interface DemandSignalRow {
  sku_category: string;
  signal_type: "trends" | "weather";
  region: string;
  signal_date: string;
  value: number;
  metadata: Record<string, unknown>;
}

// Region → approximate lat/lon for Open-Meteo weather API
const REGION_GEO: Record<string, { lat: number; lon: number }> = {
  "US-NE": { lat: 42.36, lon: -71.06 },
  "US-SE": { lat: 33.75, lon: -84.39 },
  "US-MW": { lat: 41.85, lon: -87.65 },
  "US-SW": { lat: 33.45, lon: -112.07 },
  "US-NW": { lat: 47.61, lon: -122.33 },
  "US":    { lat: 38.89, lon: -77.03 },
  "CA":    { lat: 43.65, lon: -79.38 },
  "UK":    { lat: 51.51, lon: -0.13 },
};

function defaultGeo(region: string): { lat: number; lon: number } {
  return REGION_GEO[region] ?? REGION_GEO["US"];
}

async function fetchGoogleTrendsTimeline(
  keyword: string,
  geo: string,
  startDate: string,
  endDate: string,
): Promise<Array<{ date: string; value: number }>> {
  const timeRange = `${startDate} ${endDate}`;
  const req = JSON.stringify({
    comparisonItem: [{ keyword, geo, time: timeRange }],
    category: 0,
    property: "",
  });

  const exploreUrl =
    `https://trends.google.com/trends/api/explore` +
    `?hl=en-US&tz=-300&req=${encodeURIComponent(req)}`;

  const exploreResp = await fetch(exploreUrl, {
    headers: { "User-Agent": "BrightworksDemandAgent/1.0" },
    signal: AbortSignal.timeout(20_000),
  });

  if (!exploreResp.ok) {
    throw new Error(`Google Trends explore ${exploreResp.status}`);
  }

  const exploreText = await exploreResp.text();
  // Google Trends XSS guard prefix
  const exploreJson = JSON.parse(exploreText.replace(/^\)\]\}',?\n/, "")) as {
    widgets?: Array<{ id: string; token?: string }>;
  };

  const widget = exploreJson.widgets?.find((w) => w.id === "TIMESERIES");
  if (!widget?.token) {
    return [];
  }

  const timelineReq = JSON.stringify({
    time: timeRange,
    resolution: "WEEK",
    locale: "en-US",
    comparisonItem: [
      {
        geo: { country: geo },
        complexKeywordsRestriction: {
          keyword: [{ type: "BROAD", value: keyword }],
        },
      },
    ],
    requestOptions: { property: "", backend: "IZG", category: 0 },
  });

  const timelineUrl =
    `https://trends.google.com/trends/api/widgetdata/multiline` +
    `?hl=en-US&tz=-300&req=${encodeURIComponent(timelineReq)}` +
    `&token=${encodeURIComponent(widget.token)}&user=0`;

  const timelineResp = await fetch(timelineUrl, {
    headers: { "User-Agent": "BrightworksDemandAgent/1.0" },
    signal: AbortSignal.timeout(20_000),
  });

  if (!timelineResp.ok) {
    return [];
  }

  const timelineText = await timelineResp.text();
  const timelineJson = JSON.parse(timelineText.replace(/^\)\]\}',?\n/, "")) as {
    default?: { timelineData?: TrendTimelineItem[] };
  };

  const items = timelineJson.default?.timelineData ?? [];
  return items
    .filter((item) => Array.isArray(item.value) && item.value.length > 0)
    .map((item) => ({
      date: (item.formattedAxisLabel ?? item.formattedTime ?? "").replace(
        /\s+/g,
        "-",
      ),
      value: Math.round(Math.max(0, Math.min(100, item.value![0] ?? 0))),
    }));
}

async function fetchWeatherOnset(
  region: string,
  startDate: string,
  endDate: string,
): Promise<Array<{ date: string; value: number; raw: Record<string, number> }>> {
  const { lat, lon } = defaultGeo(region);

  const url =
    `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${lat}&longitude=${lon}` +
    `&start_date=${startDate}&end_date=${endDate}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum` +
    `&timezone=America%2FNew_York&temperature_unit=fahrenheit`;

  const resp = await fetch(url, { signal: AbortSignal.timeout(20_000) });

  if (!resp.ok) {
    throw new Error(`Open-Meteo ${resp.status}`);
  }

  const data = (await resp.json()) as WeatherDailyResponse;
  const dates = data.daily?.time ?? [];
  const tempMax = data.daily?.temperature_2m_max ?? [];
  const tempMin = data.daily?.temperature_2m_min ?? [];
  const precip = data.daily?.precipitation_sum ?? [];

  return dates.map((date, idx) => {
    const maxF = tempMax[idx] ?? 0;
    const minF = tempMin[idx] ?? 0;
    const precipIn = precip[idx] ?? 0;
    const avgF = (maxF + minF) / 2;
    // Winter-onset score: lower temps + precipitation → higher value (0–100)
    const tempScore = Math.max(0, Math.min(100, ((80 - avgF) / 80) * 100));
    const precipScore = Math.min(100, (precipIn / 2) * 100);
    const onsetValue = Math.round(tempScore * 0.7 + precipScore * 0.3);
    return {
      date,
      value: onsetValue,
      raw: { temperature_max_f: maxF, temperature_min_f: minF, precipitation_in: precipIn },
    };
  });
}

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function handleFetchDemandSignals(
  ctx: HandlerContext,
  args: Args,
): Promise<HandlerResult> {
  const skuCategories = Array.isArray(args.sku_categories)
    ? (args.sku_categories as string[])
    : [];
  const regions = Array.isArray(args.regions)
    ? (args.regions as string[])
    : ["US"];
  const startDate = typeof args.start_date === "string" ? args.start_date : "";
  const endDate = typeof args.end_date === "string" ? args.end_date : "";
  const confirmed = args.confirmed === true;

  if (skuCategories.length === 0) {
    return { status: 400, body: "sku_categories must be a non-empty array" };
  }
  if (!startDate || !endDate) {
    return { status: 400, body: "start_date and end_date are required (YYYY-MM-DD)" };
  }
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
    return { status: 400, body: "dates must be in YYYY-MM-DD format" };
  }
  if (startDate > endDate) {
    return { status: 400, body: "start_date must be before end_date" };
  }

  const signals: DemandSignalRow[] = [];
  const fetchErrors: string[] = [];

  // Fetch Google Trends data per category × region
  for (const category of skuCategories) {
    for (const region of regions) {
      try {
        const geoCode = Object.keys(REGION_GEO).includes(region)
          ? region.split("-")[0]
          : "US";
        const trendsPoints = await fetchGoogleTrendsTimeline(
          category,
          geoCode,
          startDate,
          endDate,
        );
        for (const pt of trendsPoints) {
          if (!pt.date) continue;
          signals.push({
            sku_category: category,
            signal_type: "trends",
            region,
            signal_date: pt.date,
            value: pt.value,
            metadata: { source: "google_trends", keyword: category, geo: geoCode },
          });
        }
      } catch (err) {
        fetchErrors.push(`trends:${category}:${region} — ${String(err)}`);
      }
    }
  }

  // Fetch weather-onset data per region
  for (const region of regions) {
    try {
      const weatherPoints = await fetchWeatherOnset(region, startDate, endDate);
      for (const pt of weatherPoints) {
        signals.push({
          sku_category: "all",
          signal_type: "weather",
          region,
          signal_date: pt.date,
          value: pt.value,
          metadata: { source: "open_meteo", ...pt.raw },
        });
      }
    } catch (err) {
      fetchErrors.push(`weather:${region} — ${String(err)}`);
    }
  }

  if (!confirmed) {
    return {
      status: 200,
      body: {
        requires_confirmation: true,
        preview_count: signals.length,
        fetch_errors: fetchErrors,
        sample: signals.slice(0, 5),
        message:
          `Fetched ${signals.length} demand signal rows (${fetchErrors.length} errors). ` +
          `Re-call with confirmed=true to write to brightworks_demand_signals.`,
      },
    };
  }

  if (signals.length === 0) {
    return {
      status: 200,
      body: {
        inserted: 0,
        errors: fetchErrors,
        message: "No signals fetched — nothing written to brightworks_demand_signals.",
      },
    };
  }

  let inserted = 0;
  const writeErrors: string[] = [];

  for (const signal of signals) {
    try {
      await ctx.db.execute(
        `INSERT INTO brightworks_demand_signals
           (id, sku_category, signal_type, region, signal_date, value, metadata, created_at)
         VALUES ($1::uuid, $2, $3, $4, $5::date, $6, $7::jsonb, NOW())
         ON CONFLICT (sku_category, signal_type, region, signal_date)
           DO UPDATE SET value = EXCLUDED.value,
                         metadata = EXCLUDED.metadata,
                         created_at = NOW()`,
        crypto.randomUUID(),
        signal.sku_category,
        signal.signal_type,
        signal.region,
        signal.signal_date,
        signal.value,
        JSON.stringify(signal.metadata),
      );
      inserted++;
    } catch (dbErr) {
      writeErrors.push(
        `${signal.sku_category}/${signal.signal_type}/${signal.region}/${signal.signal_date} — ${String(dbErr)}`,
      );
    }
  }

  await ctx.events.publish("demand_signals.fetched", {
    sku_categories: skuCategories,
    regions,
    start_date: startDate,
    end_date: endDate,
    inserted,
    error_count: fetchErrors.length + writeErrors.length,
  });

  return {
    status: 200,
    body: {
      inserted,
      errors: [...fetchErrors, ...writeErrors],
      message: `Wrote ${inserted} demand signal rows to brightworks_demand_signals.`,
    },
  };
}
