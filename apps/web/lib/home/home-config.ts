/**
 * home-config — the company's root surface (company-root-landing-001).
 * Written by provisioning (_step_substrate_install) from CTO home_mode
 * + CMO positioning. Do NOT hand-edit.
 */
export interface HomeCta {
  label: string;
  href: string;
}

export interface HomeConfig {
  mode: "landing" | "conversation";
  headline?: string;
  subhead?: string;
  primaryCta?: HomeCta;
  secondaryCta?: HomeCta;
}

export const homeConfig: HomeConfig = {
  "mode": "landing",
  "headline": "Stop replacing cheap timers every season \u2014 Brightworks hardware is built to survive the weather, not just the holidays.",
  "subhead": "Brightworks (usebrightworks.com) sells NRTL-certified IP65-rated outdoor timers, weatherproof connectors, and curated install kits direct to homeowners and small installers \u2014 the only DTC brand purpose-built for holiday lighting durability,"
};
