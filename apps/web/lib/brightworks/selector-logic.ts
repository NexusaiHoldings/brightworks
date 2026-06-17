export type HomeFootprint = 'small' | 'medium' | 'large';
export type InstallLocation = 'roofline' | 'shrub' | 'tree';
export type FailureMode = 'timer' | 'connector';

export interface SelectorInputs {
  homeFootprint: HomeFootprint;
  installLocation: InstallLocation;
  failureMode: FailureMode;
}

export interface ProductSku {
  sku: string;
  name: string;
  description: string;
  priceCents: number;
  features: string[];
  addToCartPath: string;
}

export interface SelectorResult {
  product: ProductSku;
  reason: string;
  upsell: ProductSku | null;
}

const CATALOG: Record<string, ProductSku> = {
  'BW-R-S': {
    sku: 'BW-R-S',
    name: 'Roofline Starter Kit (25 ft)',
    description: 'C9 LED roofline string with 25 clips — covers up to 1,200 sq ft home.',
    priceCents: 3499,
    features: ['25 ft, 25 C9 LED bulbs', 'All-weather shatterproof housing', 'Includes gutter clips', '3-year warranty'],
    addToCartPath: '/cart?sku=BW-R-S',
  },
  'BW-R-M': {
    sku: 'BW-R-M',
    name: 'Roofline Standard Bundle (50 ft)',
    description: 'C9 LED roofline string with 50 clips — covers up to 2,000 sq ft home.',
    priceCents: 5999,
    features: ['50 ft, 50 C9 LED bulbs', 'All-weather shatterproof housing', 'Includes gutter clips', '3-year warranty'],
    addToCartPath: '/cart?sku=BW-R-M',
  },
  'BW-R-L': {
    sku: 'BW-R-L',
    name: 'Roofline Pro Bundle (100 ft)',
    description: 'C9 LED roofline string with 100 clips — covers large homes over 2,000 sq ft.',
    priceCents: 9999,
    features: ['100 ft, 100 C9 LED bulbs', 'All-weather shatterproof housing', 'Includes gutter clips', '5-year warranty'],
    addToCartPath: '/cart?sku=BW-R-L',
  },
  'BW-SH-S': {
    sku: 'BW-SH-S',
    name: 'Shrub Net Light Starter (3-pack)',
    description: '4 ft × 6 ft LED net lights — covers up to 3 medium shrubs or a compact hedge.',
    priceCents: 2999,
    features: ['Three 4×6 ft net panels', '180 LED nodes per panel', 'Snap-together connectors', '3-year warranty'],
    addToCartPath: '/cart?sku=BW-SH-S',
  },
  'BW-SH-M': {
    sku: 'BW-SH-M',
    name: 'Shrub Net Light Bundle (6-pack)',
    description: '4 ft × 6 ft LED net lights — covers up to 6 shrubs or a full foundation hedge row.',
    priceCents: 5499,
    features: ['Six 4×6 ft net panels', '180 LED nodes per panel', 'Snap-together connectors', '3-year warranty'],
    addToCartPath: '/cart?sku=BW-SH-M',
  },
  'BW-SH-L': {
    sku: 'BW-SH-L',
    name: 'Shrub Net Light Pro (12-pack)',
    description: '4 ft × 6 ft LED net lights — covers large landscaped beds or full foundation plantings.',
    priceCents: 9999,
    features: ['Twelve 4×6 ft net panels', '180 LED nodes per panel', 'Heavy-duty snap connectors', '5-year warranty'],
    addToCartPath: '/cart?sku=BW-SH-L',
  },
  'BW-TR-S': {
    sku: 'BW-TR-S',
    name: 'Tree Wrap Starter (100 ft)',
    description: 'Warm-white micro LED string — wraps one accent tree up to 6 in diameter.',
    priceCents: 2499,
    features: ['100 ft, 300 micro LEDs', 'Flexible PVC wire', 'IP67 weatherproof', '3-year warranty'],
    addToCartPath: '/cart?sku=BW-TR-S',
  },
  'BW-TR-M': {
    sku: 'BW-TR-M',
    name: 'Tree Wrap Bundle (200 ft)',
    description: 'Warm-white micro LED string — wraps 1–2 accent trees up to 10 in diameter.',
    priceCents: 4499,
    features: ['200 ft, 600 micro LEDs', 'Flexible PVC wire', 'IP67 weatherproof', '3-year warranty'],
    addToCartPath: '/cart?sku=BW-TR-M',
  },
  'BW-TR-L': {
    sku: 'BW-TR-L',
    name: 'Tree Wrap Pro (400 ft)',
    description: 'Warm-white micro LED string — wraps 2–4 mature trees or one large specimen tree.',
    priceCents: 7999,
    features: ['400 ft, 1,200 micro LEDs', 'Heavy-duty flexible PVC wire', 'IP67 weatherproof', '5-year warranty'],
    addToCartPath: '/cart?sku=BW-TR-L',
  },
  'BW-ADD-T': {
    sku: 'BW-ADD-T',
    name: 'IntelliTimer Digital Controller',
    description: 'Programmable 7-day digital timer — eliminates manual on/off and prevents overrun burnout.',
    priceCents: 1499,
    features: ['7-day programmable schedule', 'Dusk-to-dawn photocell sensor', 'Surge-protected outlet', 'Weatherproof housing'],
    addToCartPath: '/cart?sku=BW-ADD-T',
  },
  'BW-ADD-C': {
    sku: 'BW-ADD-C',
    name: 'WeatherSeal HD Connector Kit',
    description: 'Heavy-gauge connectors with silicone seals — solves the #1 cause of connector burnout.',
    priceCents: 1299,
    features: ['6 male + 6 female connectors', 'Silicone weather gaskets', '16-gauge wire rating', 'Grip-lock security tabs'],
    addToCartPath: '/cart?sku=BW-ADD-C',
  },
};

const BASE_PRODUCT_MATRIX: Record<string, string> = {
  'roofline-small': 'BW-R-S',
  'roofline-medium': 'BW-R-M',
  'roofline-large': 'BW-R-L',
  'shrub-small': 'BW-SH-S',
  'shrub-medium': 'BW-SH-M',
  'shrub-large': 'BW-SH-L',
  'tree-small': 'BW-TR-S',
  'tree-medium': 'BW-TR-M',
  'tree-large': 'BW-TR-L',
};

const FAILURE_REASON: Record<FailureMode, string> = {
  timer: 'Add the IntelliTimer controller below to run on a precise 7-day schedule and prevent the overrun burnout that failed your previous setup.',
  connector: 'Add the WeatherSeal HD Connector Kit below to seal every joint against moisture — the leading cause of connector burnout.',
};

const LOCATION_LABELS: Record<InstallLocation, string> = {
  roofline: 'roofline',
  shrub: 'shrubs',
  tree: 'trees',
};

const FOOTPRINT_LABELS: Record<HomeFootprint, string> = {
  small: 'smaller home',
  medium: 'mid-size home',
  large: 'larger home',
};

export function getRecommendation(inputs: SelectorInputs): SelectorResult {
  const { homeFootprint, installLocation, failureMode } = inputs;
  const baseKey = `${installLocation}-${homeFootprint}`;
  const baseSku = BASE_PRODUCT_MATRIX[baseKey];

  if (!baseSku) {
    throw new Error(`No product matched for: ${baseKey}`);
  }

  const product = CATALOG[baseSku];
  if (!product) {
    throw new Error(`SKU not found in catalog: ${baseSku}`);
  }

  const upsellSku = failureMode === 'timer' ? 'BW-ADD-T' : 'BW-ADD-C';
  const upsell = CATALOG[upsellSku] ?? null;

  const locationLabel = LOCATION_LABELS[installLocation];
  const footprintLabel = FOOTPRINT_LABELS[homeFootprint];
  const failureNote = FAILURE_REASON[failureMode];

  const reason = `Right-sized for a ${footprintLabel} with ${locationLabel} installation. ${failureNote}`;

  return { product, reason, upsell };
}

export function formatPrice(priceCents: number): string {
  return `$${(priceCents / 100).toFixed(2)}`;
}
