export type HomeFootprint = "small" | "medium" | "large";
export type InstallLocation = "roofline" | "shrub" | "tree";
export type FailureMode = "timer" | "connector" | "none";

export interface SelectorInputs {
  homeFootprint: HomeFootprint;
  installLocation: InstallLocation;
  failureMode: FailureMode;
}

export interface SkuItem {
  sku: string;
  name: string;
  description: string;
  price: number;
  cartUrl: string;
}

export interface SelectorRecommendation {
  primary: SkuItem;
  addOns: SkuItem[];
  rationale: string;
}

const SKU_CATALOG: Record<string, SkuItem> = {
  "BW-RL-S-TC": {
    sku: "BW-RL-S-TC",
    name: "Brightworks Roofline Starter Kit — 50 ft",
    description:
      "50 ft LED C9 roofline strand with integrated digital timer. Weatherproof connectors rated for 10 seasons. Ideal for small homes up to 1,200 sq ft.",
    price: 89.99,
    cartUrl: "/cart?sku=BW-RL-S-TC",
  },
  "BW-RL-M-TC": {
    sku: "BW-RL-M-TC",
    name: "Brightworks Roofline Pro Kit — 100 ft",
    description:
      "100 ft LED C9 roofline strand with built-in digital timer. Heavy-duty locking connectors eliminate burnout. Covers medium homes up to 2,400 sq ft.",
    price: 149.99,
    cartUrl: "/cart?sku=BW-RL-M-TC",
  },
  "BW-RL-L-TC": {
    sku: "BW-RL-L-TC",
    name: "Brightworks Roofline Estate Kit — 200 ft",
    description:
      "200 ft LED C9 roofline strand system with digital timer hub. Commercial-grade locking connectors. Designed for large homes over 2,400 sq ft.",
    price: 249.99,
    cartUrl: "/cart?sku=BW-RL-L-TC",
  },
  "BW-SH-S-CC": {
    sku: "BW-SH-S-CC",
    name: "Brightworks Shrub Wrap Set — Small",
    description:
      "3-pack pre-lit LED shrub wrap nets (18\" × 24\"). Push-lock connectors prevent burnout. Includes corrosion-resistant ground stakes.",
    price: 49.99,
    cartUrl: "/cart?sku=BW-SH-S-CC",
  },
  "BW-SH-M-CC": {
    sku: "BW-SH-M-CC",
    name: "Brightworks Shrub Wrap Set — Medium",
    description:
      "6-pack LED shrub wrap nets (24\" × 36\"). Push-lock connectors with weatherproof seals. Covers up to 6 medium shrubs.",
    price: 89.99,
    cartUrl: "/cart?sku=BW-SH-M-CC",
  },
  "BW-SH-L-CC": {
    sku: "BW-SH-L-CC",
    name: "Brightworks Shrub Wrap Set — Large",
    description:
      "12-pack LED shrub wrap nets (36\" × 48\"). Commercial push-lock connectors. Built-in timer adapter port for whole-yard automation.",
    price: 159.99,
    cartUrl: "/cart?sku=BW-SH-L-CC",
  },
  "BW-TR-S-TC": {
    sku: "BW-TR-S-TC",
    name: "Brightworks Tree Wrap Kit — Small",
    description:
      "150 ft LED micro-light tree wrap strand with digital timer. Self-sealing connectors. Covers 1–2 small trees up to 10 ft tall.",
    price: 69.99,
    cartUrl: "/cart?sku=BW-TR-S-TC",
  },
  "BW-TR-M-TC": {
    sku: "BW-TR-M-TC",
    name: "Brightworks Tree Wrap Kit — Medium",
    description:
      "300 ft LED micro-light tree wrap strand with digital timer. Heavy-duty locking connectors. Covers 1–2 trees up to 20 ft tall.",
    price: 119.99,
    cartUrl: "/cart?sku=BW-TR-M-TC",
  },
  "BW-TR-L-TC": {
    sku: "BW-TR-L-TC",
    name: "Brightworks Tree Wrap Kit — Large",
    description:
      "600 ft LED micro-light system with digital timer hub. Commercial locking connectors. Covers large trees over 20 ft or multiple trees.",
    price: 199.99,
    cartUrl: "/cart?sku=BW-TR-L-TC",
  },
  "BW-ADD-TIMER": {
    sku: "BW-ADD-TIMER",
    name: "Brightworks SmartTimer Module",
    description:
      "Outdoor-rated 7-day programmable digital timer. Replaces any failed mechanical timer. Fits all Brightworks strand connectors.",
    price: 24.99,
    cartUrl: "/cart?sku=BW-ADD-TIMER",
  },
  "BW-ADD-CONN": {
    sku: "BW-ADD-CONN",
    name: "Brightworks Lock-Seal Connector Pack (10-ct)",
    description:
      "10 replacement heavy-duty push-lock weatherproof connectors. Eliminates burnout at junction points. Rated for outdoor use in all climates.",
    price: 14.99,
    cartUrl: "/cart?sku=BW-ADD-CONN",
  },
  "BW-ADD-EXTCORD": {
    sku: "BW-ADD-EXTCORD",
    name: "Brightworks Outdoor Extension Cord — 25 ft",
    description:
      "25 ft heavy-duty outdoor-rated 3-prong extension cord with safety cover caps.",
    price: 19.99,
    cartUrl: "/cart?sku=BW-ADD-EXTCORD",
  },
};

function getPrimarySkuKey(inputs: SelectorInputs): string {
  const { homeFootprint, installLocation } = inputs;
  const locationPrefix =
    installLocation === "roofline"
      ? "RL"
      : installLocation === "shrub"
        ? "SH"
        : "TR";
  const sizeCode = homeFootprint === "small" ? "S" : homeFootprint === "medium" ? "M" : "L";
  const featureSuffix =
    installLocation === "shrub" ? "CC" : "TC";
  return `BW-${locationPrefix}-${sizeCode}-${featureSuffix}`;
}

function buildRationale(inputs: SelectorInputs, primary: SkuItem): string {
  const locationLabel =
    inputs.installLocation === "roofline"
      ? "roofline"
      : inputs.installLocation === "shrub"
        ? "shrubs"
        : "trees";
  const footprintLabel = inputs.homeFootprint;
  const failureLabel =
    inputs.failureMode === "timer"
      ? "timer failure"
      : inputs.failureMode === "connector"
        ? "connector burnout"
        : "prior installation";

  return `Based on your ${footprintLabel} home, ${locationLabel} install location, and ${failureLabel}, we recommend the ${primary.name}. ${
    inputs.failureMode === "timer"
      ? "This kit includes a built-in digital timer that replaces your old mechanical unit so you never deal with timer failure again."
      : inputs.failureMode === "connector"
        ? "Every connector in this kit uses our push-lock weatherproof design — the same burnout point that failed before is now rated for 10+ seasons."
        : "This kit is engineered for long-lasting performance and easy installation."
  }`;
}

function getAddOns(inputs: SelectorInputs): SkuItem[] {
  const addOns: SkuItem[] = [];

  if (inputs.failureMode === "timer") {
    addOns.push(SKU_CATALOG["BW-ADD-TIMER"]);
  }
  if (inputs.failureMode === "connector") {
    addOns.push(SKU_CATALOG["BW-ADD-CONN"]);
  }
  if (inputs.homeFootprint === "large" || inputs.installLocation === "roofline") {
    addOns.push(SKU_CATALOG["BW-ADD-EXTCORD"]);
  }

  return addOns;
}

export function getRecommendation(inputs: SelectorInputs): SelectorRecommendation {
  const skuKey = getPrimarySkuKey(inputs);
  const primary = SKU_CATALOG[skuKey];

  if (!primary) {
    throw new Error(`No SKU found for inputs: ${JSON.stringify(inputs)}`);
  }

  const addOns = getAddOns(inputs);
  const rationale = buildRationale(inputs, primary);

  return { primary, addOns, rationale };
}

export function formatPrice(cents: number): string {
  return `$${cents.toFixed(2)}`;
}
