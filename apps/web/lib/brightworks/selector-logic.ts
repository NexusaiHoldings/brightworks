export type HomeFootprint = "small" | "medium" | "large";
export type InstallLocation = "roofline" | "shrub" | "tree";
export type FailureMode = "timer" | "connector";

export interface SelectorInputs {
  footprint: HomeFootprint;
  location: InstallLocation;
  failureMode: FailureMode;
}

export interface ProductSku {
  sku: string;
  name: string;
  tagline: string;
  description: string;
  price: string;
  cartUrl: string;
  highlights: string[];
  isBestValue: boolean;
}

const SKU_CATALOG: Record<string, ProductSku> = {
  "BW-TIM-100": {
    sku: "BW-TIM-100",
    name: "Mechanical 24-Hour Timer",
    tagline: "Simple set-and-forget replacement",
    description:
      "Plug-in mechanical timer with 48 programmable on/off pins. Handles up to 1,875 W. Ideal for small displays with a single circuit.",
    price: "$12.99",
    cartUrl: "/cart?sku=BW-TIM-100",
    highlights: [
      "Rated 1,875 W / 15 A outdoor load",
      "30-minute interval pins",
      "No batteries or app required",
      "UL Listed all-weather housing",
    ],
    isBestValue: false,
  },
  "BW-TIM-200": {
    sku: "BW-TIM-200",
    name: "7-Day Programmable Timer",
    tagline: "Set different schedules for every day of the week",
    description:
      "Digital 7-day timer with LCD display and battery backup. Programs up to 20 on/off events per week across two independent channels.",
    price: "$24.99",
    cartUrl: "/cart?sku=BW-TIM-200",
    highlights: [
      "Two independently controlled outlets",
      "20 programmable events per week",
      "Battery backup retains schedule through outages",
      "UL Listed outdoor enclosure",
    ],
    isBestValue: true,
  },
  "BW-TIM-300": {
    sku: "BW-TIM-300",
    name: "Smart WiFi Timer Hub",
    tagline: "App-controlled scheduling for whole-home displays",
    description:
      "WiFi-connected smart timer with sunrise/sunset auto-scheduling and energy monitoring. Supports up to four zones — covers an entire large-home roofline.",
    price: "$49.99",
    cartUrl: "/cart?sku=BW-TIM-300",
    highlights: [
      "4-zone independent control via app",
      "Sunrise/sunset auto-schedule",
      "Energy usage monitoring",
      "Works with Alexa and Google Home",
    ],
    isBestValue: false,
  },
  "BW-CONN-100": {
    sku: "BW-CONN-100",
    name: "Standard Outdoor Connector Kit",
    tagline: "Reliable quick-connect replacements for shrubs and trees",
    description:
      "25-pack of UV-resistant quick-connect splice connectors rated for 22–18 AWG wire. Pre-filled with dielectric grease to prevent corrosion at ground-level installations.",
    price: "$14.99",
    cartUrl: "/cart?sku=BW-CONN-100",
    highlights: [
      "25 connectors per pack",
      "Pre-filled dielectric grease",
      "UV-resistant housing",
      "Rated for 10 A / 120 V",
    ],
    isBestValue: false,
  },
  "BW-CONN-200": {
    sku: "BW-CONN-200",
    name: "Heavy-Duty Weatherproof Connector Kit",
    tagline: "Roofline-grade protection against freeze-thaw and wind",
    description:
      "25-pack of locking weatherproof connectors with silicone-sealed caps. Designed for high-exposure roofline runs where vibration and temperature cycling crack standard connectors.",
    price: "$22.99",
    cartUrl: "/cart?sku=BW-CONN-200",
    highlights: [
      "Locking silicone seal — no pull-out failures",
      "Rated −40 °F to 185 °F",
      "Vibration-resistant locking collar",
      "25 connectors + 5 bonus end caps",
    ],
    isBestValue: true,
  },
  "BW-BUNDLE-STR": {
    sku: "BW-BUNDLE-STR",
    name: "Starter Replacement Bundle",
    tagline: "Timer + connectors — everything to get back up fast",
    description:
      "Combines the 7-Day Programmable Timer with a 25-pack of Standard Connectors. Covers the two most common failure points in a single order.",
    price: "$34.99",
    cartUrl: "/cart?sku=BW-BUNDLE-STR",
    highlights: [
      "Saves $4.99 vs. buying separately",
      "7-Day Programmable Timer included",
      "25 Standard Connectors included",
      "Ships same day (in-stock guarantee)",
    ],
    isBestValue: false,
  },
  "BW-BUNDLE-PRO": {
    sku: "BW-BUNDLE-PRO",
    name: "Pro Replacement Bundle",
    tagline: "Smart timer + weatherproof connectors for large homes",
    description:
      "Smart WiFi Timer Hub paired with the Heavy-Duty Weatherproof Connector Kit. Built for large homes with complex, multi-zone roofline displays.",
    price: "$64.99",
    cartUrl: "/cart?sku=BW-BUNDLE-PRO",
    highlights: [
      "Saves $8.00 vs. buying separately",
      "Smart WiFi Timer Hub (4-zone control)",
      "25 Weatherproof Connectors included",
      "Covers rooflines up to 300 linear ft",
    ],
    isBestValue: true,
  },
};

export function getRecommendation(inputs: SelectorInputs): ProductSku {
  const { footprint, location, failureMode } = inputs;

  if (failureMode === "timer") {
    if (footprint === "small") return SKU_CATALOG["BW-TIM-100"];
    if (footprint === "medium") return SKU_CATALOG["BW-TIM-200"];
    return SKU_CATALOG["BW-TIM-300"];
  }

  // failureMode === "connector"
  if (footprint === "large") {
    return SKU_CATALOG["BW-BUNDLE-PRO"];
  }
  if (location === "roofline") {
    return SKU_CATALOG["BW-CONN-200"];
  }
  if (footprint === "medium") {
    return SKU_CATALOG["BW-BUNDLE-STR"];
  }
  return SKU_CATALOG["BW-CONN-100"];
}

export function getFootprintLabel(footprint: HomeFootprint): string {
  const labels: Record<HomeFootprint, string> = {
    small: "Small (under 1,500 sq ft)",
    medium: "Medium (1,500–3,000 sq ft)",
    large: "Large (over 3,000 sq ft)",
  };
  return labels[footprint];
}

export function getLocationLabel(location: InstallLocation): string {
  const labels: Record<InstallLocation, string> = {
    roofline: "Roofline / gutters",
    shrub: "Shrubs / bushes",
    tree: "Trees",
  };
  return labels[location];
}

export function getFailureModeLabel(failureMode: FailureMode): string {
  const labels: Record<FailureMode, string> = {
    timer: "Timer stopped working",
    connector: "Connector / plug burned out",
  };
  return labels[failureMode];
}
