export type RooflineFootprint = "compact" | "standard" | "expansive";
export type InstallationLocation = "roofline" | "shrub" | "tree";
export type ReportedFailureMode = "none" | "timer" | "connector";

export interface RecommendationInput {
  footprint: RooflineFootprint;
  installLocation: InstallationLocation;
  failureMode: ReportedFailureMode;
}

export interface BundleItem {
  sku: string;
  name: string;
  description: string;
}

export interface RecommendationResult {
  sku: string;
  name: string;
  summary: string;
  rationale: string;
  bundle: BundleItem[];
}

interface FootprintProfile {
  baseSku: string;
  name: string;
  lead: string;
  coverage: string;
}

const FOOTPRINT_PROFILES: Record<RooflineFootprint, FootprintProfile> = {
  compact: {
    baseSku: "BW-LUMA-50",
    name: "LumaFlex 50 ft Starter Kit",
    lead: "Perfect for compact bungalows and simple rooflines.",
    coverage: "Covers up to 75 linear feet with two 25 ft light runs.",
  },
  standard: {
    baseSku: "BW-LUMA-100",
    name: "LumaFlex 100 ft Complete Kit",
    lead: "Balanced output for most single-family rooflines.",
    coverage:
      "Includes four 25 ft light runs plus dual inline power injectors.",
  },
  expansive: {
    baseSku: "BW-PRO-150",
    name: "ProGlow 150 ft Performance Bundle",
    lead: "Extended reach for wraparound installs or detached garages.",
    coverage:
      "Ships with six 25 ft light runs, weatherproof jumpers, and splitters.",
  },
};

interface LocationAccessory {
  sku: string;
  name: string;
  description: string;
  rationale: string;
}

const LOCATION_ACCESSORIES: Record<InstallationLocation, LocationAccessory> = {
  roofline: {
    sku: "BW-CLIP-PRO",
    name: "Roofline Pro Clip Pack",
    description:
      "High-hold stainless clips for eaves, soffits, and gutter lips.",
    rationale:
      "Roofline installs benefit from corrosion-resistant clips that maintain spacing through freeze-thaw cycles.",
  },
  shrub: {
    sku: "BW-GRD-STAKE",
    name: "EverStake Ground Anchors",
    description:
      "Low-profile stakes keep lights tidy along shrubs and flower beds.",
    rationale:
      "Ground anchors prevent sagging when wrapping shrubs or outlining beds.",
  },
  tree: {
    sku: "BW-CANOPY-RING",
    name: "Canopy Ring Suspension Kit",
    description:
      "Adjustable suspension rings and soft ties for tree canopy draping.",
    rationale:
      "Suspension hardware protects bark while holding strands securely in the canopy.",
  },
};

interface FailureUpgrade {
  sku: string;
  name: string;
  description: string;
  rationale: string;
}

const FAILURE_UPGRADES: Record<ReportedFailureMode, FailureUpgrade | null> = {
  none: null,
  timer: {
    sku: "BW-SMART-TMR",
    name: "BrightSync Smart Timer",
    description:
      "Wi-Fi enabled timer with sunrise/sunset automation and outage recovery.",
    rationale:
      "Smart timer replaces mechanical units that often drift or fail after storms.",
  },
  connector: {
    sku: "BW-SEALED-CONN",
    name: "SureSeal Connector Upgrade Pack",
    description:
      "IP67 sealed connectors and dielectric gel for high-moisture environments.",
    rationale:
      "Sealed connectors eliminate the corrosion and burnout common with legacy sets.",
  },
};

const GENERAL_RATIONALE =
  "Matched from BrightWorks seasonal data for homeowners seeking durable replacements after failure events.";

export function getSelectorRecommendation(
  input: RecommendationInput,
): RecommendationResult {
  const footprintProfile = FOOTPRINT_PROFILES[input.footprint];
  const locationAccessory = LOCATION_ACCESSORIES[input.installLocation];
  const failureUpgrade = FAILURE_UPGRADES[input.failureMode];

  const bundle: BundleItem[] = [
    {
      sku: locationAccessory.sku,
      name: locationAccessory.name,
      description: locationAccessory.description,
    },
  ];

  const rationaleSegments = [
    footprintProfile.lead,
    locationAccessory.rationale,
    GENERAL_RATIONALE,
  ];

  if (failureUpgrade) {
    bundle.push({
      sku: failureUpgrade.sku,
      name: failureUpgrade.name,
      description: failureUpgrade.description,
    });
    rationaleSegments.splice(2, 0, failureUpgrade.rationale);
  }

  return {
    sku: footprintProfile.baseSku,
    name: footprintProfile.name,
    summary: footprintProfile.coverage,
    rationale: rationaleSegments.join(" "),
    bundle,
  };
}
