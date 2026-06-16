import { NextRequest, NextResponse } from 'next/server';
import {
  ensureForecastSchema,
  computeStockoutRisk,
  upsertSkuForecast,
  type TrendData,
  type WeatherData,
} from '@/lib/brightworks/demand-forecast';
import { computeSeasonalMultiplier } from '@/lib/brightworks/pricing';

interface ProductEntry {
  skuId: string;
  skuName: string;
  category: string;
  baseInventory: number;
  baseDemand: number;
}

const PRODUCT_CATALOG: ProductEntry[] = [
  { skuId: 'BW-LED-C9-100', skuName: 'C9 LED String 100ct Warm White', category: 'LED Strands', baseInventory: 850, baseDemand: 1200 },
  { skuId: 'BW-LED-C9-200', skuName: 'C9 LED String 200ct Warm White', category: 'LED Strands', baseInventory: 420, baseDemand: 900 },
  { skuId: 'BW-LED-M5-50', skuName: 'M5 LED Mini Lights 50ct Multi', category: 'LED Strands', baseInventory: 1200, baseDemand: 1500 },
  { skuId: 'BW-OUT-WREATH-24', skuName: 'Pre-lit Wreath 24in LED', category: 'Outdoor Decor', baseInventory: 310, baseDemand: 600 },
  { skuId: 'BW-OUT-WREATH-36', skuName: 'Pre-lit Wreath 36in LED', category: 'Outdoor Decor', baseInventory: 145, baseDemand: 400 },
  { skuId: 'BW-OUT-GARLAND-9', skuName: 'Pre-lit Garland 9ft LED', category: 'Outdoor Decor', baseInventory: 520, baseDemand: 750 },
  { skuId: 'BW-HL-ICICLE-20', skuName: 'Icicle Lights 20ft Clear', category: 'Holiday Lights', baseInventory: 670, baseDemand: 1100 },
  { skuId: 'BW-HL-NET-4X6', skuName: 'Net Lights 4x6ft White', category: 'Holiday Lights', baseInventory: 380, baseDemand: 700 },
  { skuId: 'BW-SUP-CLIP-100', skuName: 'All-in-One Light Clips 100ct', category: 'Installation Supplies', baseInventory: 2200, baseDemand: 2800 },
  { skuId: 'BW-TC-TIMER-7', skuName: '7-Day Programmable Timer', category: 'Timers & Controllers', baseInventory: 290, baseDemand: 450 },
];

function fetchHolidayTrends(): TrendData[] {
  const base = 45 + Math.floor(Math.random() * 20);
  return [
    { keyword: 'christmas lights outdoor', score: base + 20, region: 'US' },
    { keyword: 'led holiday lights', score: base + 15, region: 'US' },
    { keyword: 'holiday light installation', score: base + 5, region: 'US' },
    { keyword: 'christmas light installer near me', score: base, region: 'US' },
    { keyword: 'holiday outdoor lighting', score: base + 10, region: 'US' },
  ];
}

function fetchWeatherOnsetData(): WeatherData[] {
  const base = new Date();
  base.setMonth(9);
  base.setDate(15 + Math.floor(Math.random() * 10));
  return [
    { region: 'Northeast', onsetDate: base, temperatureDelta: -8.5 },
    { region: 'Midwest', onsetDate: new Date(base.getTime() - 7 * 86400000), temperatureDelta: -10.2 },
    { region: 'South', onsetDate: new Date(base.getTime() + 21 * 86400000), temperatureDelta: -5.1 },
    { region: 'West', onsetDate: new Date(base.getTime() + 14 * 86400000), temperatureDelta: -6.3 },
  ];
}

function computeWeatherFactor(weatherData: WeatherData[], today: Date): number {
  const factors = weatherData.map(w => {
    const daysUntilOnset = (w.onsetDate.getTime() - today.getTime()) / 86400000;
    const onsetFactor = daysUntilOnset < 60 ? 1.15 : daysUntilOnset < 90 ? 1.05 : 1.0;
    const tempFactor = 1.0 + Math.abs(w.temperatureDelta) / 100;
    return onsetFactor * tempFactor;
  });
  return factors.reduce((sum, f) => sum + f, 0) / factors.length;
}

function computeTrendFactor(trends: TrendData[]): number {
  const avg = trends.reduce((sum, t) => sum + t.score, 0) / trends.length;
  return avg / 50;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date();
  const sellInDeadline = new Date(today.getFullYear(), 9, 1);
  const daysUntilDeadline = Math.max(
    Math.floor((sellInDeadline.getTime() - today.getTime()) / 86400000),
    1
  );

  try {
    await ensureForecastSchema();

    const trends = fetchHolidayTrends();
    const weatherData = fetchWeatherOnsetData();
    const trendFactor = computeTrendFactor(trends);
    const weatherFactor = computeWeatherFactor(weatherData, today);

    const processed: string[] = [];

    for (const product of PRODUCT_CATALOG) {
      const seasonalMultiplier = computeSeasonalMultiplier(product.category, today);
      const adjustedDemand = Math.round(
        product.baseDemand * trendFactor * weatherFactor * seasonalMultiplier
      );
      const gap = Math.max(adjustedDemand - product.baseInventory, 0);
      const recommendedReorder = Math.ceil(gap * 1.1);

      const { riskLevel, stockoutDate } = computeStockoutRisk(
        product.baseInventory,
        adjustedDemand,
        sellInDeadline,
        daysUntilDeadline
      );

      await upsertSkuForecast({
        skuId: product.skuId,
        skuName: product.skuName,
        category: product.category,
        currentInventory: product.baseInventory,
        forecastedDemand: adjustedDemand,
        recommendedReorder,
        trendScore: Number((trendFactor * 50).toFixed(2)),
        weatherFactor: Number(weatherFactor.toFixed(4)),
        stockoutRiskLevel: riskLevel,
        stockoutDate,
        sellInDeadline,
        lastUpdated: today,
      });

      processed.push(product.skuId);
    }

    const topTrend = [...trends].sort((a, b) => b.score - a.score)[0];

    console.info(
      JSON.stringify({
        event: 'demand_forecast_cron_complete',
        processedSkus: processed.length,
        trendFactor: Number(trendFactor.toFixed(4)),
        weatherFactor: Number(weatherFactor.toFixed(4)),
        runAt: today.toISOString(),
      })
    );

    return NextResponse.json({
      success: true,
      processedSkus: processed.length,
      trendFactor: Number(trendFactor.toFixed(4)),
      weatherFactor: Number(weatherFactor.toFixed(4)),
      topTrendKeyword: topTrend?.keyword ?? null,
      sellInDeadline: sellInDeadline.toISOString(),
      processedAt: today.toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(
      JSON.stringify({ event: 'demand_forecast_cron_error', error: message })
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
