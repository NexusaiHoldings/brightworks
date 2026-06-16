export type InstallLocation = "roofline" | "shrub" | "tree";
export type FailureMode = "timer" | "connector";

type CoverageBand = "compact" | "standard" | "expansive";

export interface SelectorInputs {
  footprintSqFt: number;
  installLocation: InstallLocation;
  failureMode: FailureMode;
}

export interface BundleItem {
  sku: string;
  name: string;
  description: string;
}

export interface SelectorRecommendation {
  sku: string;
  title: string;
  description: string;
  coverageSqFt: number;
  bundleItems: BundleItem[];
  rationale: string;
}

interface KitDefinition {
  sku: string;
  name: string;
  description: string;
  coverageSqFt: number;
}

interface LocationProfile {
  label: string;
  rationale: string;
  kits: Record<CoverageBand, KitDefinition>;
}

interface FailureAdjustment {
  suffix: string;
  titlePrefix: string;
  descriptionAppend: string;
  item: BundleItem;
  rationale: string;
}

export const INSTALL_LOCATION_OPTIONS: ReadonlyArray<{
  value: InstallLocation;
  label: string;
  helper: string;
}> = [
  {
    value: "roofline",
    label: "Roofline / Eaves",
    helper: "Linear runs along peaks, soffits, or gutters.",
  },
  {
    value: "shrub",
    label: "Shrubs & Ground Cover",
    helper: "Low-height foliage or garden bed edging.",
  },
  {
    value: "tree",
    label: "Trees & Vertical Features",
    helper: "Trunks, canopy wraps, or tall architectural accents.",
  },
];

export const FAILURE_MODE_OPTIONS: ReadonlyArray<{
  value: FailureMode;
  label: string;
  helper: string;
}> = [
  {
    value: "timer",
    label: "Timer burnout",
    helper: "Prior setup failed because the scheduling controller overheated.",
  },
  {
    value: "connector",
    label: "Connector failure",
    helper: "Prior setup failed due to melted or loose connectors.",
  },
];

const LOCATION_PROFILES: Record<InstallLocation, LocationProfile> = {
  roofline: {
    label: "Roofline",
    rationale:
      "Roofline kits prioritize straight runs, wind resistance, and weatherized clips.",
    kits: {
      compact: {
        sku: "BW-RF-150",
        name: "Roofline Essentials Kit",
        description:
          "150 linear feet of warm white LEDs with weatherized edge clips and low-profile cabling.",
        coverageSqFt: 600,
      },
      standard: {
        sku: "BW-RF-250",
        name: "Roofline Plus Kit",
        description:
          "250 linear feet, dual-channel driver, and peak anchors for consistent fascia coverage.",
        coverageSqFt: 1200,
      },
      expansive: {
        sku: "BW-RF-400",
        name: "Roofline Pro Bundle",
        description:
          "400 linear feet with cast-aluminum clips and dual-circuit driver for long roof runs.",
        coverageSqFt: 2000,
      },
    },
  },
  shrub: {
    label: "Shrub & Ground Cover",
    rationale:
      "Ground applications need flexible net lighting and soft cabling to avoid damaging plantings.",
    kits: {
      compact: {
        sku: "BW-GR-080",
        name: "Garden Net Starter",
        description:
          "Four 4x6 ft shrub nets with UV-resistant leads and stakes for dense coverage.",
        coverageSqFt: 300,
      },
      standard: {
        sku: "BW-GR-150",
        name: "Garden Net Plus",
        description:
          "Eight shrub nets, dual power taps, and low-voltage splitter for medium beds.",
        coverageSqFt: 900,
      },
      expansive: {
        sku: "BW-GR-240",
        name: "Garden Net Pro Pack",
        description:
          "Twelve shrub nets, weather-rated hubs, and extension harnesses for large installations.",
        coverageSqFt: 1500,
      },
    },
  },
  tree: {
    label: "Tree & Vertical",
    rationale:
      "Tree kits rely on spiral wraps and tension straps to secure strands along vertical surfaces.",
    kits: {
      compact: {
        sku: "BW-TR-090",
        name: "Tree Wrap Essentials",
        description:
          "90 ft spiral wrap with silicone straps for trunks up to 12 ft tall.",
        coverageSqFt: 500,
      },
      standard: {
        sku: "BW-TR-180",
        name: "Tree Wrap Plus",
        description:
          "180 ft of dual-density wraps, branch clips, and canopy spreaders for mid-size trees.",
        coverageSqFt: 1100,
      },
      expansive: {
        sku: "BW-TR-300",
        name: "Tree Wrap Skyline Kit",
        description:
          "300 ft pro-grade wraps, anchor straps, and canopy rigging for tall architectural trees.",
        coverageSqFt: 1800,
      },
    },
  },
};

const FAILURE_ADJUSTMENTS: Record<FailureMode, FailureAdjustment> = {
  timer: {
    suffix: "TG",
    titlePrefix: "TimerGuard",
    descriptionAppend:
      " TimerGuard smart controller isolates surges and provides dusk-to-dawn automation rated for 15A loads.",
    item: {
      sku: "BW-TIMER-GUARD",
      name: "TimerGuard Smart Controller",
      description:
        "Solid-state outdoor timer with thermal trip protection and surge clamping.",
    },
    rationale:
      "Adding TimerGuard prevents future controller burnout by regulating startup load and voltage swings.",
  },
  connector: {
    suffix: "CS",
    titlePrefix: "ConnectorSafe",
    descriptionAppend:
      " ConnectorSafe sealed junction set replaces legacy plug-and-play connectors with IP67 locking barrels.",
    item: {
      sku: "BW-CONNECTOR-SAFE",
      name: "ConnectorSafe Junction Pack",
      description:
        "Set of ten IP67 locking connectors with silicone gaskets rated for 18AWG-16AWG runs.",
    },
    rationale:
      "ConnectorSafe mitigates heat build-up by upgrading every splice to sealed, locking connectors.",
  },
};

function determineCoverageBand(footprintSqFt: number): CoverageBand {
  if (footprintSqFt <= 450) {
    return "compact";
  }
  if (footprintSqFt <= 1300) {
    return "standard";
  }
  return "expansive";
}

export function getSelectorRecommendation(
  inputs: SelectorInputs,
): SelectorRecommendation {
  const sanitizedFootprint = Number.isFinite(inputs.footprintSqFt)
    ? Math.max(1, Math.round(inputs.footprintSqFt))
    : 1;

  const locationProfile = LOCATION_PROFILES[inputs.installLocation];
  const coverageBand = determineCoverageBand(sanitizedFootprint);
  const baseKit = locationProfile.kits[coverageBand];

  const bundleItems: BundleItem[] = [
    {
      sku: baseKit.sku,
      name: baseKit.name,
      description: baseKit.description,
    },
  ];

  const rationaleParts: string[] = [
    `We sized the kit for approximately ${sanitizedFootprint.toLocaleString()} sq ft, which aligns with our ${coverageBand} coverage profile (${baseKit.coverageSqFt.toLocaleString()} sq ft capacity).`,
    locationProfile.rationale,
  ];

  const failureAdjustment = FAILURE_ADJUSTMENTS[inputs.failureMode];

  let recommendationSku = baseKit.sku;
  let title = baseKit.name;
  let description = baseKit.description;

  if (failureAdjustment) {
    recommendationSku = `${baseKit.sku}-${failureAdjustment.suffix}`;
    title = `${failureAdjustment.titlePrefix} ${baseKit.name}`;
    description = `${baseKit.description}${failureAdjustment.descriptionAppend}`;
    bundleItems.push({
      sku: failureAdjustment.item.sku,
      name: failureAdjustment.item.name,
      description: failureAdjustment.item.description,
    });
    rationaleParts.push(failureAdjustment.rationale);
  }

  const rationale = rationaleParts.join(" ");

  return {
    sku: recommendationSku,
    title,
    description,
    coverageSqFt: baseKit.coverageSqFt,
    bundleItems,
    rationale,
  };
}
