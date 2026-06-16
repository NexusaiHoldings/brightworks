/**
 * GET /api/cron/demand-forecast — Vercel cron handler that ingests Google
 * Trends holiday search volume and regional weather-onset data to produce
 * per-SKU inventory replenishment recommendations.
 *
 * Schedule: daily at 02:00 UTC (configured in vercel.json).
 * Auth: Vercel sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is
 * set; unguarded in local dev.
 */

import { NextResponse } from "next/server";
import { runDemandForecast } from "@/lib/brightworks/demand-forecast";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!isCronAuthorized(request)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const startedAt = Date.now();

  try {
    const result = await runDemandForecast();
    const durationMs = Date.now() - startedAt;

    if (!result.success) {
      console.error(
        JSON.stringify({
          event: "demand_forecast_cron_error",
          error: result.error,
          durationMs,
        }),
      );
      return NextResponse.json(
        { ok: false, error: result.error, durationMs },
        { status: 500 },
      );
    }

    console.info(
      JSON.stringify({
        event: "demand_forecast_cron_success",
        forecastCount: result.forecastCount,
        durationMs,
      }),
    );

    return NextResponse.json({
      ok: true,
      forecastCount: result.forecastCount,
      durationMs,
    });
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        event: "demand_forecast_cron_exception",
        error: message,
        durationMs,
      }),
    );
    return NextResponse.json({ ok: false, error: message, durationMs }, { status: 500 });
  }
}
