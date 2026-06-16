import { NextRequest, NextResponse } from "next/server";
import { generateDemandForecast, storeForecastResults } from "@/lib/brightworks/demand-forecast";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Vercel cron requests carry a shared secret in the Authorization header.
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startMs = Date.now();

  try {
    console.log(
      JSON.stringify({
        level: "info",
        event: "cron.demand-forecast.start",
        timestamp: new Date().toISOString(),
      })
    );

    const forecast = await generateDemandForecast();
    await storeForecastResults(forecast.skuForecasts);

    const durationMs = Date.now() - startMs;

    console.log(
      JSON.stringify({
        level: "info",
        event: "cron.demand-forecast.complete",
        timestamp: new Date().toISOString(),
        duration_ms: durationMs,
        total_skus: forecast.totalSkus,
        high_risk_count: forecast.highRiskCount,
      })
    );

    return NextResponse.json({
      success: true,
      generatedAt: forecast.generatedAt,
      totalSkus: forecast.totalSkus,
      highRiskCount: forecast.highRiskCount,
      durationMs,
    });
  } catch (err) {
    const durationMs = Date.now() - startMs;

    console.error(
      JSON.stringify({
        level: "error",
        event: "cron.demand-forecast.error",
        timestamp: new Date().toISOString(),
        duration_ms: durationMs,
        error: err instanceof Error ? err.message : String(err),
      })
    );

    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
