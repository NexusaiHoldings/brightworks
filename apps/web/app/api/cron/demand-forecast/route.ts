/**
 * GET /api/cron/demand-forecast
 *
 * Vercel cron handler that ingests Google Trends holiday search volume and
 * regional weather-onset data, then generates per-SKU inventory replenishment
 * recommendations for Brightworks seasonal lighting products.
 *
 * Schedule: daily at 06:00 UTC (configure in vercel.json).
 * Auth: Vercel sends `Authorization: Bearer <CRON_SECRET>` when set.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  ensureTablesExist,
  seedDemoSkus,
  getSkuInventory,
  fetchGoogleTrendsScore,
  fetchWeatherOnsetMultiplier,
  computeForecasts,
  saveForecastSnapshot,
  buildPricingRecommendations,
  buildReplenishmentOrders,
} from "@/lib/brightworks/demand-forecast";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // pg + raw SQL — not edge-compatible
export const maxDuration = 60;

function isCronAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // unguarded in local/dev
  const authHeader = request.headers.get("authorization") ?? "";
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    // Bootstrap tables and seed demo data on first run
    await ensureTablesExist();
    await seedDemoSkus();

    // Ingest external signals in parallel
    const [trendsScore, weatherMultiplier] = await Promise.all([
      fetchGoogleTrendsScore(),
      fetchWeatherOnsetMultiplier(),
    ]);

    // Load current inventory and compute forecasts
    const skus = await getSkuInventory();
    if (skus.length === 0) {
      return NextResponse.json(
        { ok: true, message: "No SKUs found — skipping forecast run" },
        { status: 200 }
      );
    }

    const forecasts = computeForecasts(skus, trendsScore, weatherMultiplier);
    const snapshotId = await saveForecastSnapshot(
      forecasts,
      trendsScore,
      weatherMultiplier
    );

    // Derive pricing and replenishment summaries for the response payload
    const pricing = buildPricingRecommendations(forecasts);
    const replenishment = buildReplenishmentOrders(forecasts);

    const atRiskCount = forecasts.filter((f) => f.stockout_risk === "high").length;
    const criticalOrders = replenishment.filter((r) => r.urgency === "critical");

    const durationMs = Date.now() - startedAt;

    console.log(JSON.stringify({
      event: "demand_forecast_cron_complete",
      snapshot_id: snapshotId,
      sku_count: skus.length,
      at_risk_count: atRiskCount,
      trends_score: trendsScore,
      weather_multiplier: weatherMultiplier,
      duration_ms: durationMs,
    }));

    return NextResponse.json({
      ok: true,
      snapshot_id: snapshotId,
      run_at: new Date().toISOString(),
      duration_ms: durationMs,
      signals: {
        trends_score: trendsScore,
        weather_multiplier: weatherMultiplier,
      },
      summary: {
        sku_count: skus.length,
        at_risk_count: atRiskCount,
        critical_reorder_count: criticalOrders.length,
        total_units_to_order: replenishment.reduce(
          (sum, r) => sum + r.units_to_order,
          0
        ),
      },
      at_risk_skus: forecasts
        .filter((f) => f.stockout_risk === "high")
        .map((f) => ({
          sku_code: f.sku_code,
          name: f.name,
          current_inventory: f.current_inventory,
          forecast_demand: f.forecast_demand_units,
          days_to_stockout: f.days_to_stockout,
          recommended_reorder_qty: f.recommended_reorder_qty,
        })),
      pricing_recommendations: pricing.slice(0, 5),
      replenishment_orders: replenishment.slice(0, 10),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({
      event: "demand_forecast_cron_error",
      error: message,
      duration_ms: Date.now() - startedAt,
    }));
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
