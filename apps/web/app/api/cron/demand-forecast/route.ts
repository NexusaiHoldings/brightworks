import { NextRequest, NextResponse } from 'next/server';
import { runDemandForecast } from '@/lib/brightworks/demand-forecast';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runDemandForecast();

    console.info(JSON.stringify({
      level: 'info',
      event: 'demand_forecast_cron_completed',
      runId: result.runId,
      skusAnalyzed: result.skusAnalyzed,
      highRiskCount: result.highRiskCount,
      timestamp: new Date().toISOString(),
    }));

    return NextResponse.json({
      success: true,
      runId: result.runId,
      skusAnalyzed: result.skusAnalyzed,
      highRiskCount: result.highRiskCount,
      summary: {
        highRisk: result.forecasts
          .filter((f) => f.stockout_risk === 'high')
          .map((f) => ({ sku: f.sku_name, daysToStockout: f.days_until_stockout })),
        mediumRisk: result.forecasts
          .filter((f) => f.stockout_risk === 'medium')
          .map((f) => f.sku_name),
        octoberDeadlineFlags: result.forecasts
          .filter((f) => f.october_deadline)
          .map((f) => f.sku_name),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'demand_forecast_cron_failed',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }));
    return NextResponse.json(
      { success: false, error: 'Forecast run failed', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
