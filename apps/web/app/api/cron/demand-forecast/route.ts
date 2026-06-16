/**
 * GET /api/cron/demand-forecast — Vercel cron: seasonal demand forecasting.
 *
 * Ingests Google Trends holiday search volume and regional weather-onset data
 * to produce per-SKU inventory replenishment recommendations. Results are
 * stored in bw_demand_forecast_runs and surfaced on /admin/forecasting.
 *
 * Schedule: daily at 06:00 UTC (configured in vercel.json).
 * Auth: CRON_SECRET bearer token (same pattern as /api/cron/approved-actions).
 */

import { NextResponse } from "next/server";
import {
  ensureSchema,
  generateForecast,
  saveForecastRun,
} from "@/lib/brightworks/demand-forecast";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // unguarded in dev; prod sets CRON_SECRET
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!isCronAuthorized(request)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  try {
    await ensureSchema();
  } catch (err) {
    return NextResponse.json(
      { error: "schema_init_failed", detail: String((err as Error).message) },
      { status: 500 },
    );
  }

  let run;
  try {
    run = await generateForecast();
  } catch (err) {
    return NextResponse.json(
      { error: "forecast_failed", detail: String((err as Error).message) },
      { status: 500 },
    );
  }

  try {
    await saveForecastRun(run);
  } catch (err) {
    return NextResponse.json(
      { error: "save_failed", detail: String((err as Error).message) },
      { status: 500 },
    );
  }

  return NextResponse.json({
    run_id: run.run_id,
    ran_at: run.ran_at,
    trend_data_date: run.trend_data_date,
    total_skus: run.total_skus,
    skus_at_risk: run.skus_at_risk,
    high_risk: run.entries
      .filter((e) => e.stockout_risk === "high" || e.october_sellout_risk)
      .map((e) => ({
        sku_id: e.sku_id,
        sku_name: e.sku_name,
        current_inventory: e.current_inventory,
        forecasted_demand: e.forecasted_demand,
        replenishment_qty: e.replenishment_qty,
        stockout_risk: e.stockout_risk,
        days_until_stockout: e.days_until_stockout,
      })),
  });
}
