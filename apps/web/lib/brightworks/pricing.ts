export type PricingTier = 'retail' | 'wholesale' | 'installer';

export interface SkuPricing {
  skuId: string;
  skuName: string;
  baseRetailPrice: number;
  wholesalePrice: number;
  installerPrice: number;
  seasonalMultiplier: number;
  effectiveRetailPrice: number;
  effectiveWholesalePrice: number;
}

interface SeasonalPeak {
  startMonth: number;
  endMonth: number;
  peakMultiplier: number;
}

const SEASONAL_PEAKS: Record<string, SeasonalPeak> = {
  'holiday-lights': { startMonth: 10, endMonth: 12, peakMultiplier: 2.8 },
  'outdoor-decor': { startMonth: 10, endMonth: 12, peakMultiplier: 2.2 },
  'led-strands': { startMonth: 10, endMonth: 12, peakMultiplier: 2.5 },
  'installation-supplies': { startMonth: 9, endMonth: 12, peakMultiplier: 1.8 },
  'timers-controllers': { startMonth: 9, endMonth: 12, peakMultiplier: 2.0 },
  'timers-&-controllers': { startMonth: 9, endMonth: 12, peakMultiplier: 2.0 },
};

const TIER_DISCOUNTS: Record<PricingTier, number> = {
  retail: 1.0,
  wholesale: 0.65,
  installer: 0.55,
};

export function computeSeasonalMultiplier(
  category: string,
  forDate: Date = new Date()
): number {
  const month = forDate.getMonth() + 1;
  const key = category.toLowerCase().replace(/\s+/g, '-').replace(/[&]/g, '&');
  const peak = SEASONAL_PEAKS[key] ?? SEASONAL_PEAKS[category.toLowerCase().replace(/\s+/g, '-')];

  if (!peak) {
    if (month >= 10 && month <= 12) return 2.0;
    if (month === 9) return 1.4;
    if (month === 1) return 0.5;
    return 1.0;
  }

  if (month >= peak.startMonth && month <= peak.endMonth) {
    const span = peak.endMonth - peak.startMonth + 1;
    const progress = (month - peak.startMonth) / span;
    return 1.0 + (peak.peakMultiplier - 1.0) * Math.sin(progress * Math.PI);
  }

  const monthsBefore = peak.startMonth - month;
  if (monthsBefore > 0 && monthsBefore <= 2) {
    return 1.0 + 0.2 * (2 - monthsBefore);
  }

  return 1.0;
}

export function computeTierPrice(
  baseRetailPrice: number,
  tier: PricingTier
): number {
  return Math.round(baseRetailPrice * TIER_DISCOUNTS[tier] * 100) / 100;
}

export function computeEffectivePrice(
  baseRetailPrice: number,
  tier: PricingTier,
  seasonalMultiplier: number
): number {
  if (tier === 'retail') {
    return Math.round(baseRetailPrice * seasonalMultiplier * 100) / 100;
  }
  return computeTierPrice(baseRetailPrice, tier);
}

export function buildSkuPricing(
  skuId: string,
  skuName: string,
  baseRetailPrice: number,
  category: string,
  forDate: Date = new Date()
): SkuPricing {
  const seasonalMultiplier = computeSeasonalMultiplier(category, forDate);
  return {
    skuId,
    skuName,
    baseRetailPrice,
    wholesalePrice: computeTierPrice(baseRetailPrice, 'wholesale'),
    installerPrice: computeTierPrice(baseRetailPrice, 'installer'),
    seasonalMultiplier,
    effectiveRetailPrice: computeEffectivePrice(baseRetailPrice, 'retail', seasonalMultiplier),
    effectiveWholesalePrice: computeTierPrice(baseRetailPrice, 'wholesale'),
  };
}

export function estimateRevenue(
  units: number,
  baseRetailPrice: number,
  tier: PricingTier,
  seasonalMultiplier: number
): number {
  const effectivePrice = computeEffectivePrice(baseRetailPrice, tier, seasonalMultiplier);
  return Math.round(units * effectivePrice * 100) / 100;
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}
