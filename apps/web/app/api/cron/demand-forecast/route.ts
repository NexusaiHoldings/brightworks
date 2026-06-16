import { NextRequest, NextResponse } from 'next/server';
import {
  initializeTables,
  generateReplenishmentRecommendations,
  storeRecommendations,
} from '@/lib/brightworks/demand-forecast';
import { initializePricingTables } from '@/lib/brightworks/pricing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized — valid CRON_SECRET required' },
      { status: 401 }
    );
  }

  const startedAt = Date.now();

  try {
    // Ensure schema exists before running the pipeline
    await initializeTables();
    await initializePricingTables();

    const recommendations = await generateReplenishmentRecommendations();
    await storeRecommendations(recommendations);

    const highRisk = recommendations.filter((r) => r.stockout_risk === 'high');
    const mediumRisk = recommendations.filter((r) => r.stockout_risk === 'medium');
    const totalReplenishmentUnits = recommendations.reduce(
      (sum, r) => sum + r.replenishment_qty,
      0
    );

    const durationMs = Date.now() - startedAt;

    return NextResponse.json(
      {
        ok: true,
        ran_at: new Date().toISOString(),
        duration_ms: durationMs,
        skus_processed: recommendations.length,
        high_risk_count: highRisk.length,
        medium_risk_count: mediumRisk.length,
        total_replenishment_units: totalReplenishmentUnits,
        high_risk_skus: highRisk.map((r) => ({
          sku_code: r.sku_code,
          sku_name: r.sku_name,
          current_inventory: r.current_inventory,
          forecasted_demand: r.forecasted_demand,
          replenishment_qty: r.replenishment_qty,
        })),
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[cron/demand-forecast] pipeline error:', { message, duration_ms: Date.now() - startedAt });
    return NextResponse.json(
      { ok: false, error: message, ran_at: new Date().toISOString() },
      { status: 500 }
    );
  }
}
