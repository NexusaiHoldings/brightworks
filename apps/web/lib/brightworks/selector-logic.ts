export type HomeFootprint = 'small' | 'medium' | 'large';
export type InstallLocation = 'roofline' | 'shrub' | 'tree';
export type FailureMode = 'timer' | 'connector';

export interface SelectorInputs {
  homeFootprint: HomeFootprint;
  installLocation: InstallLocation;
  priorFailureMode: FailureMode;
}

export interface Product {
  sku: string;
  name: string;
  tagline: string;
  description: string;
  priceUsd: number;
  strandLengthFt: number;
  lightCount: number;
  features: string[];
  cartUrl: string;
}

export interface SelectorResult {
  primary: Product;
  addOns: Product[];
  rationale: string;
  quantityRecommended: number;
  totalEstimatedUsd: number;
}

const CATALOG: Record<string, Product> = {
  'BW-RL-S-TC': {
    sku: 'BW-RL-S-TC',
    name: 'Brightworks Roofline Starter Kit',
    tagline: 'Drop-in timer replacement for small homes',
    description:
      'C6 LED roofline strand with built-in 24-hour mechanical timer and all-weather connectors. Engineered to replace failed plug-in timers — the timer module is embedded directly in the male plug housing.',
    priceUsd: 49.99,
    strandLengthFt: 25,
    lightCount: 50,
    features: [
      'Built-in 24-hour mechanical timer (no external timer needed)',
      'Polarized weatherproof connectors rated for 10 seasons',
      'C6 faceted LED bulbs, 5000K daylight or 2700K warm white',
      'End-to-end connectable up to 5 strands',
      'UL Listed, 3-year warranty',
    ],
    cartUrl: '/cart/add?sku=BW-RL-S-TC',
  },
  'BW-RL-M-TC': {
    sku: 'BW-RL-M-TC',
    name: 'Brightworks Roofline Pro (Medium)',
    tagline: 'Smart timer + heavy-gauge wire for medium homes',
    description:
      'C9 LED roofline strand with Wi-Fi smart timer and reinforced connector system. Replaces both timer failures and connector burnout in a single upgrade for medium-footprint homes.',
    priceUsd: 79.99,
    strandLengthFt: 50,
    lightCount: 50,
    features: [
      'Wi-Fi smart timer with app scheduling and sunrise/sunset sync',
      'Nickel-plated locking connectors rated 15A continuous',
      'C9 commercial-grade LED bulbs replaceable individually',
      'End-to-end connectable up to 4 strands',
      'UL Listed, 5-year warranty',
    ],
    cartUrl: '/cart/add?sku=BW-RL-M-TC',
  },
  'BW-RL-L-TC': {
    sku: 'BW-RL-L-TC',
    name: 'Brightworks Roofline Commercial (Large)',
    tagline: 'Heavy-duty run for large homes with timer-safe design',
    description:
      'C9 commercial-duty roofline strand engineered for runs exceeding 150 ft. Includes a dedicated 15A timer outlet and copper-core wire to prevent the voltage-drop failures common on long runs.',
    priceUsd: 129.99,
    strandLengthFt: 100,
    lightCount: 100,
    features: [
      'Dedicated 15A timer outlet module — no inline timer burnout',
      'Copper-core 18-gauge SPT-2 wire for long runs',
      'C9 shatterproof LED bulbs, 15,000-hour rated',
      'Waterproof push-lock connectors (tool-free)',
      'UL Listed for commercial use, 5-year warranty',
    ],
    cartUrl: '/cart/add?sku=BW-RL-L-TC',
  },
  'BW-RL-S-CB': {
    sku: 'BW-RL-S-CB',
    name: 'Brightworks Roofline Connector-Safe Starter',
    tagline: 'Solves connector burnout on small rooflines',
    description:
      'C6 LED roofline strand with patented heat-sink connector housings that dissipate load heat and prevent the plastic charring common on entry-level strands.',
    priceUsd: 54.99,
    strandLengthFt: 25,
    lightCount: 50,
    features: [
      'Heat-sink aluminum connector housing (runs cool at full load)',
      'Gold-plated contact pins, rated 5A per strand',
      'Locking twist-lock male-to-female connection',
      'C6 faceted LED, 75% lower wattage than incandescent',
      'UL Listed, 3-year warranty',
    ],
    cartUrl: '/cart/add?sku=BW-RL-S-CB',
  },
  'BW-RL-M-CB': {
    sku: 'BW-RL-M-CB',
    name: 'Brightworks Roofline Connector-Safe Pro',
    tagline: 'High-load connector system for medium rooflines',
    description:
      'C9 LED strand with industrial-grade connector rated for continuous 10A draw. Purpose-built for homeowners who burned out connectors on runs of 50–100 ft.',
    priceUsd: 89.99,
    strandLengthFt: 50,
    lightCount: 50,
    features: [
      '10A industrial connector with stainless locking collar',
      'Thermoplastic elastomer (TPE) jacket — stays flexible to -40°F',
      'C9 individually replaceable LED bulbs',
      'In-line GFCI protection on male plug',
      'UL Listed, 5-year warranty',
    ],
    cartUrl: '/cart/add?sku=BW-RL-M-CB',
  },
  'BW-RL-L-CB': {
    sku: 'BW-RL-L-CB',
    name: 'Brightworks Roofline Connector-Safe Commercial',
    tagline: 'Zero-burnout connectors for large-home rooflines',
    description:
      'Commercial C9 strand with weatherproof twist-lock connectors and a load-balancing power block that splits a large run across two circuits — eliminating single-point connector failures.',
    priceUsd: 149.99,
    strandLengthFt: 100,
    lightCount: 100,
    features: [
      'Dual-circuit load balancer (no single connector exceeds 7A)',
      'Twist-lock NEMA-style weatherproof connectors',
      'C9 replaceable LED bulbs, 5-year lamp warranty',
      'In-line GFCI on each circuit',
      'UL Listed commercial, 5-year full warranty',
    ],
    cartUrl: '/cart/add?sku=BW-RL-L-CB',
  },
  'BW-SH-S-TC': {
    sku: 'BW-SH-S-TC',
    name: 'Brightworks Shrub Wrap Starter',
    tagline: 'Timer-integrated net lights for small shrubs',
    description:
      'LED net lights pre-sized for small accent shrubs (up to 3 ft diameter). The integrated 6-hour auto-off timer eliminates the external plug-in timer that commonly fails in wet conditions.',
    priceUsd: 29.99,
    strandLengthFt: 0,
    lightCount: 100,
    features: [
      '4 × 6 ft net, covers shrubs up to 3 ft diameter',
      'Embedded 6-hour auto-off timer in male plug',
      'M5 micro LED, warm white or multicolor',
      'IP44 outdoor rated for rain and light frost',
      'UL Listed, 2-year warranty',
    ],
    cartUrl: '/cart/add?sku=BW-SH-S-TC',
  },
  'BW-SH-M-TC': {
    sku: 'BW-SH-M-TC',
    name: 'Brightworks Shrub Wrap Pro',
    tagline: 'Smart timer net lights for medium shrub beds',
    description:
      'LED net lights for medium foundation shrubs with a Wi-Fi smart timer. Replaces the single biggest shrub-light failure point — the external timer — by moving scheduling into the cloud.',
    priceUsd: 44.99,
    strandLengthFt: 0,
    lightCount: 150,
    features: [
      '6 × 4 ft net, connects up to 3 nets end-to-end',
      'Wi-Fi smart timer with Alexa/Google Home support',
      'M5 micro LED, 5 color options',
      'IP44 outdoor rated',
      'UL Listed, 3-year warranty',
    ],
    cartUrl: '/cart/add?sku=BW-SH-M-TC',
  },
  'BW-SH-L-TC': {
    sku: 'BW-SH-L-TC',
    name: 'Brightworks Shrub Wrap Estate',
    tagline: 'Estate-scale shrub coverage with smart scheduling',
    description:
      'Heavy-duty LED net lights for large foundation beds. The integrated smart timer hub controls up to 8 net zones independently — no more single-timer failure taking down the whole display.',
    priceUsd: 79.99,
    strandLengthFt: 0,
    lightCount: 200,
    features: [
      '6 × 4 ft net, connects up to 8 nets from one hub',
      'Smart hub with per-zone scheduling and dim control',
      'M5 micro LED, warm white or warm multicolor',
      'IP65 weather-sealed hub',
      'UL Listed, 5-year warranty',
    ],
    cartUrl: '/cart/add?sku=BW-SH-L-TC',
  },
  'BW-SH-S-CB': {
    sku: 'BW-SH-S-CB',
    name: 'Brightworks Shrub Wrap Connector-Fix',
    tagline: 'Connector-burnout proof net lights for small shrubs',
    description:
      'LED net lights with reinforced connector housings sized for small shrubs. Eliminates the hairline-crack connector failure common in wet soil environments.',
    priceUsd: 34.99,
    strandLengthFt: 0,
    lightCount: 100,
    features: [
      '4 × 6 ft net with sealed connector ports',
      'Silicone-gasketed connectors rated for ground-level moisture',
      'M5 micro LED warm white',
      'IP65 submersion-tested connectors',
      'UL Listed, 3-year warranty',
    ],
    cartUrl: '/cart/add?sku=BW-SH-S-CB',
  },
  'BW-SH-M-CB': {
    sku: 'BW-SH-M-CB',
    name: 'Brightworks Shrub Wrap Connector-Fix Pro',
    tagline: 'Ground-safe connectors for medium shrub beds',
    description:
      'LED net lights engineered for wet-environment connector reliability in medium beds. Dual-seal connector prevents moisture ingress even when connectors rest on mulch.',
    priceUsd: 54.99,
    strandLengthFt: 0,
    lightCount: 150,
    features: [
      '6 × 4 ft net, triple-seal dual-lock connector',
      'Overmolded connector housing — soil and mulch contact safe',
      'M5 micro LED, 3 color temperatures',
      'IP67 connector rating',
      'UL Listed, 4-year warranty',
    ],
    cartUrl: '/cart/add?sku=BW-SH-M-CB',
  },
  'BW-SH-L-CB': {
    sku: 'BW-SH-L-CB',
    name: 'Brightworks Shrub Wrap Connector-Fix Estate',
    tagline: 'Estate-scale connector-safe shrub net system',
    description:
      'Large-format LED net lights with a central weatherproof junction box that keeps all connectors elevated and sealed — purpose-built for estates where previous connector burnout took down multiple zones.',
    priceUsd: 99.99,
    strandLengthFt: 0,
    lightCount: 200,
    features: [
      'Central junction box (IP68, UV-stabilized polycarbonate)',
      'All connectors elevated off ground — no mulch contact',
      'Up to 8 nets from one junction box',
      'M5 micro LED, warm white',
      'UL Listed, 5-year warranty',
    ],
    cartUrl: '/cart/add?sku=BW-SH-L-CB',
  },
  'BW-TR-S-TC': {
    sku: 'BW-TR-S-TC',
    name: 'Brightworks Tree Wrap Starter',
    tagline: 'Timer-integrated micro lights for small trees',
    description:
      'Micro LED string lights pre-spooled for small ornamental trees (up to 10 ft). Integrated twilight-to-dawn sensor replaces the external timer most commonly cited in small-tree installation failures.',
    priceUsd: 39.99,
    strandLengthFt: 100,
    lightCount: 200,
    features: [
      '100 ft strand, covers trees up to 10 ft',
      'Built-in dusk-to-dawn photocell (no timer programming)',
      'M5 micro LED, warm white or cool white',
      'IP44 rated, 24V low-voltage driver',
      'UL Listed, 3-year warranty',
    ],
    cartUrl: '/cart/add?sku=BW-TR-S-TC',
  },
  'BW-TR-M-TC': {
    sku: 'BW-TR-M-TC',
    name: 'Brightworks Tree Wrap Pro',
    tagline: 'Smart-timer string lights for medium trees',
    description:
      'LED string lights for medium shade trees (10–25 ft) with a smart timer hub that eliminates external plug-in timers. App scheduling lets homeowners set independent on/off times for each tree zone.',
    priceUsd: 69.99,
    strandLengthFt: 200,
    lightCount: 400,
    features: [
      '200 ft strand in 2 × 100 ft sections',
      'Smart timer hub, controls up to 4 strand zones',
      'M5 micro LED, tunable white 2700K–5000K',
      'IP44 connector system',
      'UL Listed, 4-year warranty',
    ],
    cartUrl: '/cart/add?sku=BW-TR-M-TC',
  },
  'BW-TR-L-TC': {
    sku: 'BW-TR-L-TC',
    name: 'Brightworks Tree Wrap Estate',
    tagline: 'Estate tree coverage with smart zone control',
    description:
      'High-output LED string lights for large specimen trees (25+ ft). The smart zone controller manages up to 8 independent strand circuits, each with its own schedule — eliminating the cascading timer failure that disabled previous whole-tree displays.',
    priceUsd: 119.99,
    strandLengthFt: 400,
    lightCount: 800,
    features: [
      '400 ft in 4 × 100 ft sections',
      '8-zone smart controller with per-zone dimming',
      'C7 LED bulbs for long-throw canopy glow',
      'Copper-core SPT-1 wire, rated 10 seasons',
      'UL Listed, 5-year warranty',
    ],
    cartUrl: '/cart/add?sku=BW-TR-L-TC',
  },
  'BW-TR-S-CB': {
    sku: 'BW-TR-S-CB',
    name: 'Brightworks Tree Wrap Connector-Fix',
    tagline: 'Burnout-resistant connectors for small trees',
    description:
      'Micro LED string lights with locking connector system designed for small ornamental trees. Eliminates the snap-fit connector failure caused by branch flexing and wind movement.',
    priceUsd: 44.99,
    strandLengthFt: 100,
    lightCount: 200,
    features: [
      '100 ft with quarter-turn locking connectors',
      'Flexible PVC jacket rated for continuous flex',
      'M5 micro LED warm white',
      'IP44, wind-tested to 60 mph at connector joints',
      'UL Listed, 3-year warranty',
    ],
    cartUrl: '/cart/add?sku=BW-TR-S-CB',
  },
  'BW-TR-M-CB': {
    sku: 'BW-TR-M-CB',
    name: 'Brightworks Tree Wrap Connector-Fix Pro',
    tagline: 'Flex-rated connectors for medium trees',
    description:
      'LED string lights for medium trees with strain-relief connectors that absorb the flex-and-tug stress of wind in branchy canopies — the root cause of mid-season connector burnout.',
    priceUsd: 84.99,
    strandLengthFt: 200,
    lightCount: 400,
    features: [
      '200 ft with coiled strain-relief at each connector',
      'Nickel-plated locking connectors, 15A rated',
      'M5 micro LED, warm white or multicolor',
      'IP44, flex-tested 50,000 cycles',
      'UL Listed, 4-year warranty',
    ],
    cartUrl: '/cart/add?sku=BW-TR-M-CB',
  },
  'BW-TR-L-CB': {
    sku: 'BW-TR-L-CB',
    name: 'Brightworks Tree Wrap Connector-Fix Estate',
    tagline: 'Wind-proof connectors for large specimen trees',
    description:
      'Commercial-grade LED string lights for large trees with a patented flex-hub connector system. Central hub keeps all connections under cover and strain-relieved — eliminating the connector burnout typical of unsupported long runs in high-canopy trees.',
    priceUsd: 159.99,
    strandLengthFt: 400,
    lightCount: 800,
    features: [
      '400 ft with central flex-hub (no exposed mid-run connectors)',
      'C7 LED for canopy penetration',
      'Hub-to-strand strain relief rated 80 lbs pull',
      'IP65 hub with UV-stabilized housing',
      'UL Listed, 5-year warranty',
    ],
    cartUrl: '/cart/add?sku=BW-TR-L-CB',
  },
};

const ADD_ON_TIMER_UPGRADE: Product = {
  sku: 'BW-ACC-TIMER-WIFI',
  name: 'Brightworks Wi-Fi Smart Timer Adapter',
  tagline: 'Retrofit any strand with app scheduling',
  description:
    'Plug-in smart timer adapter that works with any Brightworks strand. Adds app scheduling, sunrise/sunset sync, and Alexa/Google Home control without replacing your lights.',
  priceUsd: 19.99,
  strandLengthFt: 0,
  lightCount: 0,
  features: [
    'Works with all Brightworks 120V products',
    'App scheduling (iOS + Android)',
    'Sunrise/sunset auto-adjust',
    'Alexa and Google Home compatible',
  ],
  cartUrl: '/cart/add?sku=BW-ACC-TIMER-WIFI',
};

const ADD_ON_CONNECTOR_PROTECTOR: Product = {
  sku: 'BW-ACC-CONN-SHIELD',
  name: 'Brightworks Connector Shield Kit',
  tagline: 'Weatherproof covers for exposed connector joins',
  description:
    'Pack of 10 silicone connector shield covers that slip over any standard SPT-1/SPT-2 connector pair. Adds IP65 protection to connections that would otherwise be exposed to rain and condensation.',
  priceUsd: 12.99,
  strandLengthFt: 0,
  lightCount: 0,
  features: [
    'Fits all standard SPT-1 and SPT-2 connectors',
    'Silicone, rated -40°F to 200°F',
    'UV-stabilized, 5-season life',
    'Pack of 10 covers',
  ],
  cartUrl: '/cart/add?sku=BW-ACC-CONN-SHIELD',
};

const FOOTPRINT_QUANTITY: Record<HomeFootprint, number> = {
  small: 1,
  medium: 2,
  large: 4,
};

function buildSkuKey(
  location: InstallLocation,
  footprint: HomeFootprint,
  failure: FailureMode,
): string {
  const locCode = location === 'roofline' ? 'RL' : location === 'shrub' ? 'SH' : 'TR';
  const sizeCode = footprint === 'small' ? 'S' : footprint === 'medium' ? 'M' : 'L';
  const failCode = failure === 'timer' ? 'TC' : 'CB';
  return `BW-${locCode}-${sizeCode}-${failCode}`;
}

function buildRationale(inputs: SelectorInputs, product: Product): string {
  const footprintLabel =
    inputs.homeFootprint === 'small'
      ? 'small home (under 1,500 sq ft)'
      : inputs.homeFootprint === 'medium'
        ? 'medium home (1,500–2,500 sq ft)'
        : 'large home (2,500+ sq ft)';
  const locationLabel =
    inputs.installLocation === 'roofline'
      ? 'roofline'
      : inputs.installLocation === 'shrub'
        ? 'shrub bed'
        : 'tree';
  const failureLabel =
    inputs.priorFailureMode === 'timer'
      ? 'external timer failure'
      : 'connector burnout';

  return (
    `Based on your ${footprintLabel} with a ${locationLabel} install and prior ${failureLabel}, ` +
    `we recommend the ${product.name}. ${product.description}`
  );
}

export function getRecommendation(inputs: SelectorInputs): SelectorResult {
  const skuKey = buildSkuKey(inputs.installLocation, inputs.homeFootprint, inputs.priorFailureMode);
  const primary = CATALOG[skuKey];

  if (!primary) {
    throw new Error(`No product found for inputs: ${JSON.stringify(inputs)}`);
  }

  const quantity = FOOTPRINT_QUANTITY[inputs.homeFootprint];
  const addOns: Product[] =
    inputs.priorFailureMode === 'timer'
      ? [ADD_ON_TIMER_UPGRADE]
      : [ADD_ON_CONNECTOR_PROTECTOR];

  const totalEstimatedUsd = primary.priceUsd * quantity + addOns[0].priceUsd;

  return {
    primary,
    addOns,
    rationale: buildRationale(inputs, primary),
    quantityRecommended: quantity,
    totalEstimatedUsd: Math.round(totalEstimatedUsd * 100) / 100,
  };
}

export function getAllFootprintOptions(): Array<{ value: HomeFootprint; label: string }> {
  return [
    { value: 'small', label: 'Small (under 1,500 sq ft)' },
    { value: 'medium', label: 'Medium (1,500–2,500 sq ft)' },
    { value: 'large', label: 'Large (2,500+ sq ft)' },
  ];
}

export function getAllLocationOptions(): Array<{ value: InstallLocation; label: string }> {
  return [
    { value: 'roofline', label: 'Roofline' },
    { value: 'shrub', label: 'Shrubs / Foundation Plantings' },
    { value: 'tree', label: 'Trees' },
  ];
}

export function getAllFailureModeOptions(): Array<{ value: FailureMode; label: string }> {
  return [
    { value: 'timer', label: 'Timer failure (lights stopped turning on/off automatically)' },
    { value: 'connector', label: 'Connector burnout (melted or scorched connectors)' },
  ];
}
