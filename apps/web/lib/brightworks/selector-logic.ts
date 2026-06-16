export type HomeFootprint = "small" | "medium" | "large";
export type InstallLocation = "roofline" | "shrub" | "tree";
export type FailureMode = "timer" | "connector";

export interface SelectorInputs {
  homeFootprint: HomeFootprint;
  installLocation: InstallLocation;
  failureMode: FailureMode;
}

export interface SkuProduct {
  sku: string;
  name: string;
  description: string;
  price: number;
  cartUrl: string;
}

export interface SelectorRecommendation {
  primary: SkuProduct;
  addOns: SkuProduct[];
  reasoning: string;
}

const BASE_PRODUCTS: Record<string, SkuProduct> = {
  "BW-ROF-S-STD": {
    sku: "BW-ROF-S-STD",
    name: "Brightworks Roofline Starter Kit",
    description:
      "25 ft of commercial-grade C9 roofline lights with pre-spaced sockets and UV-resistant wire. Covers up to 1,500 sq ft single-story homes.",
    price: 89.99,
    cartUrl: "/cart?sku=BW-ROF-S-STD",
  },
  "BW-ROF-M-STD": {
    sku: "BW-ROF-M-STD",
    name: "Brightworks Roofline Standard Kit",
    description:
      "50 ft of commercial-grade C9 roofline lights with pre-spaced sockets and UV-resistant wire. Covers up to 2,500 sq ft two-story homes.",
    price: 149.99,
    cartUrl: "/cart?sku=BW-ROF-M-STD",
  },
  "BW-ROF-L-PRO": {
    sku: "BW-ROF-L-PRO",
    name: "Brightworks Roofline Pro Kit",
    description:
      "100 ft of commercial-grade C9 roofline lights, heavy-duty sockets, and contractor-grade UV-resistant wire. Covers large homes and estates up to 5,000 sq ft.",
    price: 269.99,
    cartUrl: "/cart?sku=BW-ROF-L-PRO",
  },
  "BW-SHR-S-STD": {
    sku: "BW-SHR-S-STD",
    name: "Brightworks Shrub Wrap Starter",
    description:
      "150 LED mini-lights on flexible mesh for wrapping shrubs and hedges up to 4 ft tall. Includes 3 extension cords.",
    price: 49.99,
    cartUrl: "/cart?sku=BW-SHR-S-STD",
  },
  "BW-SHR-M-STD": {
    sku: "BW-SHR-M-STD",
    name: "Brightworks Shrub Wrap Standard",
    description:
      "300 LED mini-lights on flexible mesh with 6 extension cords. Covers 2–4 medium shrubs or a hedge up to 30 ft long.",
    price: 89.99,
    cartUrl: "/cart?sku=BW-SHR-M-STD",
  },
  "BW-SHR-L-PRO": {
    sku: "BW-SHR-L-PRO",
    name: "Brightworks Shrub Wrap Pro Bundle",
    description:
      "600 LED mini-lights, 12 extension cords, and a ground-stake power hub. Covers extensive foundation plantings on large properties.",
    price: 159.99,
    cartUrl: "/cart?sku=BW-SHR-L-PRO",
  },
  "BW-TRE-S-STD": {
    sku: "BW-TRE-S-STD",
    name: "Brightworks Tree Wrap Starter",
    description:
      "200 warm-white LED string lights pre-wound on a dispensing reel. Wraps a single tree up to 12 ft tall with a 6-inch trunk.",
    price: 59.99,
    cartUrl: "/cart?sku=BW-TRE-S-STD",
  },
  "BW-TRE-M-STD": {
    sku: "BW-TRE-M-STD",
    name: "Brightworks Tree Wrap Standard",
    description:
      "400 warm-white LED string lights on two dispensing reels. Covers 2–3 ornamental trees or one large tree up to 20 ft tall.",
    price: 109.99,
    cartUrl: "/cart?sku=BW-TRE-M-STD",
  },
  "BW-TRE-L-PRO": {
    sku: "BW-TRE-L-PRO",
    name: "Brightworks Tree Wrap Pro Bundle",
    description:
      "800 warm-white LED string lights, 4 dispensing reels, and a 6-outlet ground hub. Illuminates multiple mature trees on large lots.",
    price: 219.99,
    cartUrl: "/cart?sku=BW-TRE-L-PRO",
  },
};

const TIMER_UPGRADE: SkuProduct = {
  sku: "BW-CTRL-SMART",
  name: "Brightworks SmartTimer Controller",
  description:
    "Wi-Fi enabled smart plug with built-in timer, sunrise/sunset scheduling, and overload protection. Replaces mechanical timers that fail from power surges.",
  price: 34.99,
  cartUrl: "/cart?sku=BW-CTRL-SMART",
};

const CONNECTOR_UPGRADE: SkuProduct = {
  sku: "BW-CONN-WP25",
  name: "Brightworks Weatherproof Connector Kit",
  description:
    "25-pack of IP65-rated push-lock connectors with dielectric grease. Eliminates the corrosion and arcing that causes connector burnout year after year.",
  price: 24.99,
  cartUrl: "/cart?sku=BW-CONN-WP25",
};

const LOCATION_SIZE_TO_SKU: Record<InstallLocation, Record<HomeFootprint, string>> = {
  roofline: {
    small: "BW-ROF-S-STD",
    medium: "BW-ROF-M-STD",
    large: "BW-ROF-L-PRO",
  },
  shrub: {
    small: "BW-SHR-S-STD",
    medium: "BW-SHR-M-STD",
    large: "BW-SHR-L-PRO",
  },
  tree: {
    small: "BW-TRE-S-STD",
    medium: "BW-TRE-M-STD",
    large: "BW-TRE-L-PRO",
  },
};

const LOCATION_LABELS: Record<InstallLocation, string> = {
  roofline: "roofline",
  shrub: "shrubs",
  tree: "trees",
};

const FOOTPRINT_LABELS: Record<HomeFootprint, string> = {
  small: "smaller home",
  medium: "mid-size home",
  large: "large home",
};

export function getRecommendation(inputs: SelectorInputs): SelectorRecommendation {
  const { homeFootprint, installLocation, failureMode } = inputs;
  const skuKey = LOCATION_SIZE_TO_SKU[installLocation][homeFootprint];
  const primary = BASE_PRODUCTS[skuKey];

  const addOn = failureMode === "timer" ? TIMER_UPGRADE : CONNECTOR_UPGRADE;
  const addOns: SkuProduct[] = [addOn];

  const locationLabel = LOCATION_LABELS[installLocation];
  const footprintLabel = FOOTPRINT_LABELS[homeFootprint];
  const failureLabel =
    failureMode === "timer"
      ? "timer failure"
      : "connector burnout";

  const reasoning =
    `Based on your ${footprintLabel} with ${locationLabel} installation and history of ${failureLabel}, ` +
    `we recommend the ${primary.name}. We've also added the ${addOn.name} to prevent ` +
    `the same ${failureLabel} from happening again this season.`;

  return { primary, addOns, reasoning };
}
