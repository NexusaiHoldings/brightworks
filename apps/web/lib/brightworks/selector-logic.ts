export type InstallLocation = "roofline" | "shrub" | "tree";
export type FailureMode = "timer" | "connector";
export type HomeFootprint = "small" | "medium" | "large";

export interface SelectorInputs {
  installLocation: InstallLocation;
  homeFootprint: HomeFootprint;
  failureMode: FailureMode;
}

export interface Sku {
  id: string;
  name: string;
  description: string;
  price: number;
  addToCartUrl: string;
  badge?: string;
}

export interface Bundle {
  id: string;
  name: string;
  description: string;
  price: number;
  addToCartUrl: string;
  includes: string[];
  badge?: string;
}

export type Recommendation = Sku | Bundle;

export function isBundle(rec: Recommendation): rec is Bundle {
  return "includes" in rec;
}

const SKU_CATALOG: Record<string, Sku> = {
  "BW-RL-S-TIMER": {
    id: "BW-RL-S-TIMER",
    name: "ProLine Roofline Timer Set — Small Home",
    description:
      "25 ft weatherproof LED string with built-in 24-hr mechanical timer and backup battery. Clip-and-hang roofline install. Replaces failed timer units.",
    price: 3999,
    addToCartUrl: "/cart?sku=BW-RL-S-TIMER",
    badge: "Timer Replacement",
  },
  "BW-RL-M-TIMER": {
    id: "BW-RL-M-TIMER",
    name: "ProLine Roofline Timer Set — Medium Home",
    description:
      "50 ft weatherproof LED string with dual-zone 24-hr digital timer and surge-protected connector. Designed for roofline runs up to 50 ft.",
    price: 5999,
    addToCartUrl: "/cart?sku=BW-RL-M-TIMER",
    badge: "Timer Replacement",
  },
  "BW-RL-L-TIMER": {
    id: "BW-RL-L-TIMER",
    name: "ProLine Roofline Timer Set — Large Home",
    description:
      "100 ft premium LED run with programmable 7-day timer, inline fuse, and heavy-duty gutter clips. Full perimeter coverage for large homes.",
    price: 8999,
    addToCartUrl: "/cart?sku=BW-RL-L-TIMER",
    badge: "Timer Replacement",
  },
  "BW-RL-S-CONN": {
    id: "BW-RL-S-CONN",
    name: "ProLine Roofline Connector-Safe Set — Small Home",
    description:
      "25 ft string with locking twist-lock connectors rated to 15 A. Eliminates connector burnout at roofline junction points.",
    price: 3499,
    addToCartUrl: "/cart?sku=BW-RL-S-CONN",
    badge: "Connector Upgrade",
  },
  "BW-RL-M-CONN": {
    id: "BW-RL-M-CONN",
    name: "ProLine Roofline Connector-Safe Set — Medium Home",
    description:
      "50 ft run with dual locking connectors, 18 AWG wire, and end-cap moisture seals. Prevents the connector burnout your last set suffered.",
    price: 5499,
    addToCartUrl: "/cart?sku=BW-RL-M-CONN",
    badge: "Connector Upgrade",
  },
  "BW-RL-L-CONN": {
    id: "BW-RL-L-CONN",
    name: "ProLine Roofline Connector-Safe Bundle — Large Home",
    description:
      "100 ft heavy-gauge run with reinforced 20 A locking connectors, GFCI adapter, and stainless gutter clips. Zero-burnout design.",
    price: 8499,
    addToCartUrl: "/cart?sku=BW-RL-L-CONN",
    badge: "Connector Upgrade",
  },
  "BW-SH-S-TIMER": {
    id: "BW-SH-S-TIMER",
    name: "FlexWrap Shrub Timer Kit — Small",
    description:
      "Pre-shaped 3 ft wrap nets with 6-hr auto-off timer stake. Covers up to 4 small shrubs. Drop-in replacement for failed timer units.",
    price: 2999,
    addToCartUrl: "/cart?sku=BW-SH-S-TIMER",
    badge: "Timer Replacement",
  },
  "BW-SH-M-TIMER": {
    id: "BW-SH-M-TIMER",
    name: "FlexWrap Shrub Timer Kit — Medium",
    description:
      "Expandable net system (6 ft sections) with digital countdown timer. Covers up to 8 medium shrubs. Easy single-outlet connection.",
    price: 4499,
    addToCartUrl: "/cart?sku=BW-SH-M-TIMER",
    badge: "Timer Replacement",
  },
  "BW-SH-L-TIMER": {
    id: "BW-SH-L-TIMER",
    name: "FlexWrap Shrub Timer Bundle — Large",
    description:
      "Full yard kit: 12 wrap nets + programmable 7-day timer controller. Handles an entire large-home landscaping footprint.",
    price: 7499,
    addToCartUrl: "/cart?sku=BW-SH-L-TIMER",
    badge: "Timer Replacement",
  },
  "BW-SH-S-CONN": {
    id: "BW-SH-S-CONN",
    name: "FlexWrap Shrub Connector-Safe Kit — Small",
    description:
      "3 ft shrub nets with sealed IP65 connectors. No exposed pins — the fix for connector burnout in wet shrub environments.",
    price: 2799,
    addToCartUrl: "/cart?sku=BW-SH-S-CONN",
    badge: "Connector Upgrade",
  },
  "BW-SH-M-CONN": {
    id: "BW-SH-M-CONN",
    name: "FlexWrap Shrub Connector-Safe Kit — Medium",
    description:
      "6 ft expandable nets with weatherproof locking connectors rated for outdoor use. Eliminates moisture-driven burnout.",
    price: 3999,
    addToCartUrl: "/cart?sku=BW-SH-M-CONN",
    badge: "Connector Upgrade",
  },
  "BW-SH-L-CONN": {
    id: "BW-SH-L-CONN",
    name: "FlexWrap Shrub Connector-Safe Bundle — Large",
    description:
      "Full-yard shrub kit with 12 sealed-connector nets and a power hub distributing load evenly across circuits.",
    price: 6999,
    addToCartUrl: "/cart?sku=BW-SH-L-CONN",
    badge: "Connector Upgrade",
  },
  "BW-TR-S-TIMER": {
    id: "BW-TR-S-TIMER",
    name: "TreeWrap Timer String — Small",
    description:
      "150-light flexible wrap with 6-hr dusk-to-dawn timer. Sized for a 4–6 ft tree. Drop-in for failed in-line timer failures.",
    price: 2499,
    addToCartUrl: "/cart?sku=BW-TR-S-TIMER",
    badge: "Timer Replacement",
  },
  "BW-TR-M-TIMER": {
    id: "BW-TR-M-TIMER",
    name: "TreeWrap Timer String — Medium",
    description:
      "300-light premium wrap string with smart countdown timer module. Fits 6–10 ft trees. Replaces defunct timer mechanisms cleanly.",
    price: 3999,
    addToCartUrl: "/cart?sku=BW-TR-M-TIMER",
    badge: "Timer Replacement",
  },
  "BW-TR-L-TIMER": {
    id: "BW-TR-L-TIMER",
    name: "TreeWrap Timer Bundle — Large",
    description:
      "600-light multi-strand kit with 7-day programmable timer hub. Wraps trees 10–16 ft. Full replacement for failed timer-controlled installations.",
    price: 6499,
    addToCartUrl: "/cart?sku=BW-TR-L-TIMER",
    badge: "Timer Replacement",
  },
  "BW-TR-S-CONN": {
    id: "BW-TR-S-CONN",
    name: "TreeWrap Connector-Safe String — Small",
    description:
      "150-light string with corrosion-resistant locking end connectors. Rated IP44. Stops the burnout cycle for small tree installs.",
    price: 2299,
    addToCartUrl: "/cart?sku=BW-TR-S-CONN",
    badge: "Connector Upgrade",
  },
  "BW-TR-M-CONN": {
    id: "BW-TR-M-CONN",
    name: "TreeWrap Connector-Safe String — Medium",
    description:
      "300-light all-weather string with reinforced mid-run connectors and end seals. No more mid-season burnout on your main tree.",
    price: 3799,
    addToCartUrl: "/cart?sku=BW-TR-M-CONN",
    badge: "Connector Upgrade",
  },
  "BW-TR-L-CONN": {
    id: "BW-TR-L-CONN",
    name: "TreeWrap Connector-Safe Bundle — Large",
    description:
      "600-light heavy-gauge multi-strand kit with IP65 locking connectors throughout and a load-balancing power hub.",
    price: 6199,
    addToCartUrl: "/cart?sku=BW-TR-L-CONN",
    badge: "Connector Upgrade",
  },
};

const SKU_MATRIX: Record<InstallLocation, Record<HomeFootprint, Record<FailureMode, string>>> = {
  roofline: {
    small: { timer: "BW-RL-S-TIMER", connector: "BW-RL-S-CONN" },
    medium: { timer: "BW-RL-M-TIMER", connector: "BW-RL-M-CONN" },
    large: { timer: "BW-RL-L-TIMER", connector: "BW-RL-L-CONN" },
  },
  shrub: {
    small: { timer: "BW-SH-S-TIMER", connector: "BW-SH-S-CONN" },
    medium: { timer: "BW-SH-M-TIMER", connector: "BW-SH-M-CONN" },
    large: { timer: "BW-SH-L-TIMER", connector: "BW-SH-L-CONN" },
  },
  tree: {
    small: { timer: "BW-TR-S-TIMER", connector: "BW-TR-S-CONN" },
    medium: { timer: "BW-TR-M-TIMER", connector: "BW-TR-M-CONN" },
    large: { timer: "BW-TR-L-TIMER", connector: "BW-TR-L-CONN" },
  },
};

export function getRecommendation(inputs: SelectorInputs): Recommendation {
  const skuId = SKU_MATRIX[inputs.installLocation][inputs.homeFootprint][inputs.failureMode];
  const sku = SKU_CATALOG[skuId];
  if (!sku) {
    throw new Error(`No SKU found for inputs: ${JSON.stringify(inputs)}`);
  }
  return sku;
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function getRecommendationReasoning(inputs: SelectorInputs): string {
  const locationLabel: Record<InstallLocation, string> = {
    roofline: "roofline / eaves",
    shrub: "shrubs or bushes",
    tree: "trees",
  };
  const footprintLabel: Record<HomeFootprint, string> = {
    small: "small home (under 1,500 sq ft)",
    medium: "medium home (1,500–3,000 sq ft)",
    large: "large home (over 3,000 sq ft)",
  };
  const failureLabel: Record<FailureMode, string> = {
    timer: "timer failure",
    connector: "connector burnout",
  };
  const fixLabel: Record<FailureMode, string> = {
    timer: "a built-in timer rated for outdoor use",
    connector: "reinforced locking connectors that eliminate burnout",
  };
  return (
    `Based on your ${locationLabel[inputs.installLocation]} installation on a ` +
    `${footprintLabel[inputs.homeFootprint]}, and your prior ${failureLabel[inputs.failureMode]}, ` +
    `we selected a product specifically engineered with ${fixLabel[inputs.failureMode]}.`
  );
}

export const STEP_LABELS: Record<string, string> = {
  installLocation: "Where are your lights installed?",
  homeFootprint: "What is your home's footprint?",
  failureMode: "What failed last season?",
};

export const LOCATION_OPTIONS: Array<{ value: InstallLocation; label: string; hint: string }> = [
  { value: "roofline", label: "Roofline / Eaves", hint: "Lights clipped along the roof edge or gutters" },
  { value: "shrub", label: "Shrubs / Bushes", hint: "Wrap nets or strands around landscaping" },
  { value: "tree", label: "Tree", hint: "Strings or wraps on a yard or porch tree" },
];

export const FOOTPRINT_OPTIONS: Array<{ value: HomeFootprint; label: string; hint: string }> = [
  { value: "small", label: "Small", hint: "Under 1,500 sq ft or a single-car garage" },
  { value: "medium", label: "Medium", hint: "1,500–3,000 sq ft, typical two-story" },
  { value: "large", label: "Large", hint: "Over 3,000 sq ft or multi-section home" },
];

export const FAILURE_OPTIONS: Array<{ value: FailureMode; label: string; hint: string }> = [
  {
    value: "timer",
    label: "Timer stopped working",
    hint: "Lights came on at the wrong time or not at all",
  },
  {
    value: "connector",
    label: "Connector burned out",
    hint: "Plug or inline connector melted, discolored, or failed",
  },
];
