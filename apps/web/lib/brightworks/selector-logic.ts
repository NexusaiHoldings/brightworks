export type FootprintSize = "small" | "medium" | "large";
export type InstallLocation = "roofline" | "shrub" | "tree";
export type FailureMode = "timer" | "connector";

export interface SelectorAnswers {
  footprint: FootprintSize;
  location: InstallLocation;
  failureMode: FailureMode;
}

export interface SkuRecommendation {
  sku: string;
  name: string;
  description: string;
  price: string;
  coverageNote: string;
  cartUrl: string;
  badge?: string;
  addOns: Array<{ sku: string; name: string; price: string }>;
}

export interface QuestionOption {
  value: string;
  label: string;
  description: string;
}

export interface SelectorQuestion {
  id: keyof SelectorAnswers;
  prompt: string;
  subPrompt: string;
  options: QuestionOption[];
}

export const SELECTOR_QUESTIONS: SelectorQuestion[] = [
  {
    id: "failureMode",
    prompt: "What failed on your previous lights?",
    subPrompt:
      "Knowing your past failure helps us pick the right replacement so history doesn't repeat.",
    options: [
      {
        value: "timer",
        label: "Timer stopped working",
        description:
          "Lights turned on or off at the wrong times, or stopped responding to the timer entirely.",
      },
      {
        value: "connector",
        label: "Connector burned out",
        description:
          "Visible scorch marks, melted plastic, tripped breakers, or a section of lights went dark.",
      },
    ],
  },
  {
    id: "location",
    prompt: "Where do you install your lights?",
    subPrompt:
      "Installation surface affects clip type, wire gauge, and weatherproofing needs.",
    options: [
      {
        value: "roofline",
        label: "Roofline / gutters",
        description:
          "Lights hang from the eaves, gutters, or fascia along the edge of your roof.",
      },
      {
        value: "shrub",
        label: "Shrubs / hedges",
        description:
          "Lights wrap around or are staked into low bushes, hedges, or garden beds.",
      },
      {
        value: "tree",
        label: "Trees",
        description:
          "Lights spiral up or drape through the branches of small or large trees.",
      },
    ],
  },
  {
    id: "footprint",
    prompt: "How large is your home?",
    subPrompt:
      "Footprint determines the strand count and total wattage you'll need.",
    options: [
      {
        value: "small",
        label: "Small (under 1,500 sq ft)",
        description: "Cottage, townhouse, or apartment patio.",
      },
      {
        value: "medium",
        label: "Medium (1,500 – 3,000 sq ft)",
        description: "Average single-family home.",
      },
      {
        value: "large",
        label: "Large (over 3,000 sq ft)",
        description: "Large single-family home, estate, or commercial property.",
      },
    ],
  },
];

type SkuMatrix = Record<
  FootprintSize,
  Record<InstallLocation, Record<FailureMode, SkuRecommendation>>
>;

const SKU_MATRIX: SkuMatrix = {
  small: {
    roofline: {
      timer: {
        sku: "BW-RF-T-S",
        name: "RoofLine TimerGuard Starter",
        description:
          "24-strand LED roofline kit with our upgraded digital timer module. The rebuilt timer circuit eliminates the capacitor-drain failure seen in legacy products and includes a 3-year replacement warranty on the timer head.",
        price: "$49.99",
        coverageNote: "Covers up to 60 ft of eave.",
        cartUrl: "/cart?sku=BW-RF-T-S",
        badge: "Best for timer replacements",
        addOns: [
          {
            sku: "BW-CLIP-GUTTER",
            name: "All-Season Gutter Clips (50-pack)",
            price: "$8.99",
          },
        ],
      },
      connector: {
        sku: "BW-RF-C-S",
        name: "RoofLine SealConnect Starter",
        description:
          "24-strand LED roofline kit featuring nickel-plated, heat-resistant connectors rated to 15 A. Replaces the common 10 A connector found in budget sets that led to your burnout.",
        price: "$54.99",
        coverageNote: "Covers up to 60 ft of eave.",
        cartUrl: "/cart?sku=BW-RF-C-S",
        badge: "Connector burnout fix",
        addOns: [
          {
            sku: "BW-CLIP-GUTTER",
            name: "All-Season Gutter Clips (50-pack)",
            price: "$8.99",
          },
        ],
      },
    },
    shrub: {
      timer: {
        sku: "BW-SH-T-S",
        name: "Garden TimerGuard Starter",
        description:
          "Low-profile shrub net with built-in precision timer. Weatherproof housing rated IP67 keeps moisture out of the timer module — the #1 cause of timer failure in ground-level installs.",
        price: "$44.99",
        coverageNote: "One 4 × 6 ft net; covers 2–3 medium shrubs.",
        cartUrl: "/cart?sku=BW-SH-T-S",
        badge: "Best for timer replacements",
        addOns: [
          {
            sku: "BW-STAKE-6PK",
            name: "Ground Stakes (6-pack)",
            price: "$5.99",
          },
        ],
      },
      connector: {
        sku: "BW-SH-C-S",
        name: "Garden SealConnect Starter",
        description:
          "Shrub net kit with moisture-sealed barrel connectors. Eliminates the oxidation-driven burnout common in ground-level sets exposed to irrigation overspray.",
        price: "$47.99",
        coverageNote: "One 4 × 6 ft net; covers 2–3 medium shrubs.",
        cartUrl: "/cart?sku=BW-SH-C-S",
        badge: "Connector burnout fix",
        addOns: [
          {
            sku: "BW-STAKE-6PK",
            name: "Ground Stakes (6-pack)",
            price: "$5.99",
          },
        ],
      },
    },
    tree: {
      timer: {
        sku: "BW-TR-T-S",
        name: "TreeWrap TimerGuard Starter",
        description:
          "100-light wrap strand with outdoor-rated digital timer. The dual-fuse design means a timer failure won't darken the whole strand — a common complaint with single-fuse competitors.",
        price: "$39.99",
        coverageNote: "One 25 ft strand; wraps a 6–8 ft tree.",
        cartUrl: "/cart?sku=BW-TR-T-S",
        badge: "Best for timer replacements",
        addOns: [
          {
            sku: "BW-BRANCH-TIES",
            name: "Branch-Tie Clips (30-pack)",
            price: "$4.99",
          },
        ],
      },
      connector: {
        sku: "BW-TR-C-S",
        name: "TreeWrap SealConnect Starter",
        description:
          "100-light wrap strand with push-lock waterproof connectors. Rated for branch flex — standard connectors crack under repeated bending in wind, which causes the burnout you experienced.",
        price: "$42.99",
        coverageNote: "One 25 ft strand; wraps a 6–8 ft tree.",
        cartUrl: "/cart?sku=BW-TR-C-S",
        badge: "Connector burnout fix",
        addOns: [
          {
            sku: "BW-BRANCH-TIES",
            name: "Branch-Tie Clips (30-pack)",
            price: "$4.99",
          },
        ],
      },
    },
  },
  medium: {
    roofline: {
      timer: {
        sku: "BW-RF-T-M",
        name: "RoofLine TimerGuard Standard",
        description:
          "48-strand LED roofline kit with our upgraded digital timer module. Includes a secondary timer backup so a single timer fault doesn't leave your home dark.",
        price: "$89.99",
        coverageNote: "Covers up to 120 ft of eave.",
        cartUrl: "/cart?sku=BW-RF-T-M",
        badge: "Most popular",
        addOns: [
          {
            sku: "BW-CLIP-GUTTER",
            name: "All-Season Gutter Clips (100-pack)",
            price: "$14.99",
          },
          {
            sku: "BW-EXT-CORD-25",
            name: "Outdoor Extension Cord 25 ft",
            price: "$12.99",
          },
        ],
      },
      connector: {
        sku: "BW-RF-C-M",
        name: "RoofLine SealConnect Standard",
        description:
          "48-strand LED roofline kit with nickel-plated 15 A connectors and surge-protected inline fuses. Designed to handle the higher draw of full-home installations without connector overheating.",
        price: "$97.99",
        coverageNote: "Covers up to 120 ft of eave.",
        cartUrl: "/cart?sku=BW-RF-C-M",
        badge: "Connector burnout fix",
        addOns: [
          {
            sku: "BW-CLIP-GUTTER",
            name: "All-Season Gutter Clips (100-pack)",
            price: "$14.99",
          },
          {
            sku: "BW-EXT-CORD-25",
            name: "Outdoor Extension Cord 25 ft",
            price: "$12.99",
          },
        ],
      },
    },
    shrub: {
      timer: {
        sku: "BW-SH-T-M",
        name: "Garden TimerGuard Standard",
        description:
          "Three 4 × 6 ft shrub nets with a shared precision timer hub. The hub isolates each net on its own circuit — a timer fault on one net won't affect the others.",
        price: "$79.99",
        coverageNote: "Three nets; covers up to 9 medium shrubs.",
        cartUrl: "/cart?sku=BW-SH-T-M",
        badge: "Most popular",
        addOns: [
          {
            sku: "BW-STAKE-12PK",
            name: "Ground Stakes (12-pack)",
            price: "$9.99",
          },
        ],
      },
      connector: {
        sku: "BW-SH-C-M",
        name: "Garden SealConnect Standard",
        description:
          "Three 4 × 6 ft shrub nets with moisture-sealed barrel connectors and a grounded outdoor power stake. Eliminates the oxidation burnout that plagues multi-net daisy chains.",
        price: "$84.99",
        coverageNote: "Three nets; covers up to 9 medium shrubs.",
        cartUrl: "/cart?sku=BW-SH-C-M",
        badge: "Connector burnout fix",
        addOns: [
          {
            sku: "BW-STAKE-12PK",
            name: "Ground Stakes (12-pack)",
            price: "$9.99",
          },
        ],
      },
    },
    tree: {
      timer: {
        sku: "BW-TR-T-M",
        name: "TreeWrap TimerGuard Standard",
        description:
          "Three 25 ft wrap strands with a shared outdoor digital timer. Dual-fuse design and cold-weather-rated wire insulation prevent the timer-induced failures common in freezing climates.",
        price: "$74.99",
        coverageNote: "Three 25 ft strands; wraps 3 medium trees.",
        cartUrl: "/cart?sku=BW-TR-T-M",
        badge: "Most popular",
        addOns: [
          {
            sku: "BW-BRANCH-TIES",
            name: "Branch-Tie Clips (60-pack)",
            price: "$7.99",
          },
        ],
      },
      connector: {
        sku: "BW-TR-C-M",
        name: "TreeWrap SealConnect Standard",
        description:
          "Three 25 ft wrap strands with push-lock flex connectors and reinforced inline fuses. The flex connector absorbs branch movement that normally cracks standard connectors.",
        price: "$79.99",
        coverageNote: "Three 25 ft strands; wraps 3 medium trees.",
        cartUrl: "/cart?sku=BW-TR-C-M",
        badge: "Connector burnout fix",
        addOns: [
          {
            sku: "BW-BRANCH-TIES",
            name: "Branch-Tie Clips (60-pack)",
            price: "$7.99",
          },
        ],
      },
    },
  },
  large: {
    roofline: {
      timer: {
        sku: "BW-RF-T-L",
        name: "RoofLine TimerGuard Pro",
        description:
          "96-strand LED roofline system with a programmable smart timer and zone control. The zone controller lets you run up to 4 independent timer schedules — critical for large homes with multiple roof levels.",
        price: "$149.99",
        coverageNote: "Covers up to 240 ft of eave across 4 zones.",
        cartUrl: "/cart?sku=BW-RF-T-L",
        badge: "Professional grade",
        addOns: [
          {
            sku: "BW-CLIP-GUTTER",
            name: "All-Season Gutter Clips (200-pack)",
            price: "$24.99",
          },
          {
            sku: "BW-EXT-CORD-50",
            name: "Outdoor Extension Cord 50 ft",
            price: "$19.99",
          },
          {
            sku: "BW-ZONE-HUB",
            name: "4-Zone Smart Timer Hub",
            price: "$29.99",
          },
        ],
      },
      connector: {
        sku: "BW-RF-C-L",
        name: "RoofLine SealConnect Pro",
        description:
          "96-strand LED roofline system with 20 A heavy-duty connectors and a whole-system surge protector. Built for large homes where connector burnout cascades across multiple runs.",
        price: "$164.99",
        coverageNote: "Covers up to 240 ft of eave.",
        cartUrl: "/cart?sku=BW-RF-C-L",
        badge: "Professional grade",
        addOns: [
          {
            sku: "BW-CLIP-GUTTER",
            name: "All-Season Gutter Clips (200-pack)",
            price: "$24.99",
          },
          {
            sku: "BW-SURGE-PRO",
            name: "Whole-System Surge Protector",
            price: "$34.99",
          },
        ],
      },
    },
    shrub: {
      timer: {
        sku: "BW-SH-T-L",
        name: "Garden TimerGuard Pro",
        description:
          "Six 4 × 6 ft shrub nets with a 6-zone programmable timer hub. Zone isolation prevents a single timer fault from taking out your entire garden display — the key weakness of single-timer setups.",
        price: "$129.99",
        coverageNote: "Six nets; covers up to 18 medium shrubs across 6 zones.",
        cartUrl: "/cart?sku=BW-SH-T-L",
        badge: "Professional grade",
        addOns: [
          {
            sku: "BW-STAKE-24PK",
            name: "Ground Stakes (24-pack)",
            price: "$16.99",
          },
          {
            sku: "BW-ZONE-HUB",
            name: "6-Zone Smart Timer Hub",
            price: "$29.99",
          },
        ],
      },
      connector: {
        sku: "BW-SH-C-L",
        name: "Garden SealConnect Pro",
        description:
          "Six 4 × 6 ft shrub nets with marine-grade sealed connectors and a grounded outdoor power station. Marine-grade sealing handles irrigation overspray and standing water — the leading cause of connector burnout in garden installs.",
        price: "$139.99",
        coverageNote: "Six nets; covers up to 18 medium shrubs.",
        cartUrl: "/cart?sku=BW-SH-C-L",
        badge: "Professional grade",
        addOns: [
          {
            sku: "BW-STAKE-24PK",
            name: "Ground Stakes (24-pack)",
            price: "$16.99",
          },
        ],
      },
    },
    tree: {
      timer: {
        sku: "BW-TR-T-L",
        name: "TreeWrap TimerGuard Pro",
        description:
          "Six 25 ft wrap strands with a programmable smart timer and individual zone switches. Eliminates the single-point-of-failure timer design that left your property dark last season.",
        price: "$119.99",
        coverageNote: "Six 25 ft strands; wraps 6 medium or 3 large trees.",
        cartUrl: "/cart?sku=BW-TR-T-L",
        badge: "Professional grade",
        addOns: [
          {
            sku: "BW-BRANCH-TIES",
            name: "Branch-Tie Clips (120-pack)",
            price: "$13.99",
          },
          {
            sku: "BW-ZONE-HUB",
            name: "6-Zone Smart Timer Hub",
            price: "$29.99",
          },
        ],
      },
      connector: {
        sku: "BW-TR-C-L",
        name: "TreeWrap SealConnect Pro",
        description:
          "Six 25 ft wrap strands with armored flex connectors and a whole-system fuse box. The armored connector jacket survives the constant branch flex and UV exposure that cracks standard connectors within a single season.",
        price: "$124.99",
        coverageNote: "Six 25 ft strands; wraps 6 medium or 3 large trees.",
        cartUrl: "/cart?sku=BW-TR-C-L",
        badge: "Professional grade",
        addOns: [
          {
            sku: "BW-BRANCH-TIES",
            name: "Branch-Tie Clips (120-pack)",
            price: "$13.99",
          },
          {
            sku: "BW-SURGE-PRO",
            name: "Whole-System Surge Protector",
            price: "$34.99",
          },
        ],
      },
    },
  },
};

export function getRecommendation(answers: SelectorAnswers): SkuRecommendation {
  return SKU_MATRIX[answers.footprint][answers.location][answers.failureMode];
}
