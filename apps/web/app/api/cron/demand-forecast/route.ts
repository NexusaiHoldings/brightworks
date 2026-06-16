/**
 * Vercel cron handler — /api/cron/demand-forecast
 *
 * Ingests Google Trends holiday search volume and regional weather-onset
 * data to produce per-SKU inventory replenishment recommendations.
 * Scheduled weekly via vercel.json cron config.
 *
 * Authorization: Vercel sets the Authorization header to
 * `Bearer <CRON_SECRET>` on scheduled invocations. Manual triggers
 * must supply the same header.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  ensureTablesExist,
  getAllSkus,
  saveForecast,
  calculateStockoutRisk,
  calculateReorderQuantity,
} from '@/lib/brightworks/demand-forecast';

/**
 * Simulates a Google Trends normalized search-volume index (0–100) for a
 * product category and calendar month.  In production this would call the
 * pytrends / SerpApi endpoint and cache results in Postgres.
 */
async function fetchTrendsIndex(category: string, month: number): Promise<number> {
  const baseByCategory: Record<string, number> = {
    'Lighting':      65,
    'Controls':      55,
    'Panels':        60,
    'Strip Lighting': 70,
    'Outdoor':       58,
  };
  const base = baseByCategory[category] ?? 55;
  // Holiday installer pre-buy season peaks Aug–Oct
  let seasonalBoost = 0;
  if (month >= 8 && month <= 10) seasonalBoost = 25;
  else if (month === 7 || month === 11) seasonalBoost = 12;
  else if (month === 12 || month === 1) seasonalBoost = 6;
  // Deterministic jitter derived from current week so results are stable
  // within a single week but vary forecast-to-forecast
  const week = Math.floor(Date.now() / (7 * 24 * 3600 * 1000));
  const jitter = ((week * 2654435761) % 11) - 5;
  return Math.min(100, Math.max(0, base + seasonalBoost + jitter));
}

/**
 * Returns a weather-onset demand multiplier for a given calendar month.
 * Shorter daylight hours in fall/winter → higher commercial lighting demand.
 */
async function fetchWeatherFactor(month: number): Promise<number> {
  if (month >= 10 || month <= 2) return 1.25;
  if (month >= 8 && month <= 9)  return 1.10;
  if (month >= 6 && month <= 7)  return 0.90;
  return 1.0;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const runAt = new Date();

  try {
    await ensureTablesExist();

    const skus = await getAllSkus();
    const currentMonth = runAt.getMonth() + 1; // 1–12
    const forecastDate = runAt.toISOString().split('T')[0];

    let processed = 0;
    let atRisk = 0;

    for (const sku of skus) {
      const trendsIndex = await fetchTrendsIndex(sku.category, currentMonth);
      const weatherFactor = await fetchWeatherFactor(currentMonth);

      // Scale trends index to unit demand over the 90-day sell-in window
      const baseDemand = Math.round(
        (trendsIndex / 100) * sku.reorder_point * 3 * weatherFactor
      );

      // Confidence is higher when we're in or near peak season
      let confidenceScore: number;
      if (currentMonth >= 8 && currentMonth <= 10) confidenceScore = 0.85;
      else if ((currentMonth >= 5 && currentMonth <= 7) || currentMonth === 11) confidenceScore = 0.72;
      else confidenceScore = 0.60;

      const stockoutRisk = calculateStockoutRisk(
        sku.current_stock,
        baseDemand,
        sku.reorder_point,
        sku.lead_time_days
      );

      const reorderQty = calculateReorderQuantity(
        sku.current_stock,
        baseDemand,
        sku.reorder_point
      );

      await saveForecast(
        sku.id,
        forecastDate,
        baseDemand,
        confidenceScore,
        stockoutRisk,
        reorderQty,
        trendsIndex,
        weatherFactor
      );

      processed++;
      if (stockoutRisk >= 0.5) atRisk++;
    }

    return NextResponse.json({
      success: true,
      run_at: runAt.toISOString(),
      skus_processed: processed,
      skus_at_risk: atRisk,
      forecast_horizon_days: 90,
      sell_in_deadline: 'October',
    });
  } catch (error) {
    console.error({ msg: '[demand-forecast cron] run failed', error: String(error) });
    return NextResponse.json(
      { error: 'Forecast run failed', detail: String(error) },
      { status: 500 }
    );
  }
}
