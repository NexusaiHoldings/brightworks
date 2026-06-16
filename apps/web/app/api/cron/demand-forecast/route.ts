/**
 * GET /api/cron/demand-forecast
 *
 * Vercel scheduled function that ingests Google Trends holiday search-volume
 * signals and regional weather-onset data to produce per-SKU weekly demand
 * forecasts and inventory replenishment recommendations.
 *
 * Schedule: configure in vercel.json (e.g. "0 6 * * *" for daily at 06:00 UTC).
 * Auth: Vercel sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set.
 *       In development the route runs unguarded.
 *
 * Addresses the feasibility_analysis key technical risk:
 * "Seasonal demand volatility causing inventory mismatches"
 */

import { NextResponse } from "next/server";
import { buildDb } from "@/lib/db";
import {
  ensureTablesExist,
  listSkus,
  generateAndStoreForecast,
  getForecastSummary,
} from "@/lib/brightworks/demand-forecast";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // pg requires the Node.js runtime
export const maxDuration = 60;

function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // unguarded in dev; prod always sets CRON_SECRET
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!cronAuthorized(request)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const db = buildDb();
  const runAt = new Date();

  console.log(JSON.stringify({ event: "demand_forecast_cron_start", run_at: runAt.toISOString() }));

  // Ensure schema and seed data are in place.
  try {
    await ensureTablesExist(db);
  } catch (err) {
    const msg = String((err as Error).message);
    console.error(JSON.stringify({ event: "demand_forecast_schema_error", error: msg }));
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  // Load all SKUs.
  const skus = await listSkus(db);
  if (skus.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, skus_found: 0 });
  }

  // Generate and persist a weekly forecast for each SKU.
  let succeeded = 0;
  let failed = 0;
  const errors: Array<{ sku_code: string; error: string }> = [];

  for (const sku of skus) {
    const result = await generateAndStoreForecast(db, sku, runAt);
    if (result) {
      succeeded += 1;
    } else {
      failed += 1;
      errors.push({ sku_code: sku.sku_code, error: "forecast generation returned null" });
    }
  }

  // Collect summary stats for the response and structured log.
  const summary = await getForecastSummary(db);

  const payload = {
    ok: true,
    run_at: runAt.toISOString(),
    skus_found: skus.length,
    forecasts_generated: succeeded,
    forecasts_failed: failed,
    summary: {
      total_skus: summary.total_skus,
      critical_skus: summary.critical_skus,
      high_risk_skus: summary.high_risk_skus,
      medium_risk_skus: summary.medium_risk_skus,
      last_run_at: summary.last_run_at,
    },
    ...(errors.length > 0 ? { errors } : {}),
  };

  console.log(JSON.stringify({ event: "demand_forecast_cron_complete", ...payload }));

  return NextResponse.json(payload);
}
