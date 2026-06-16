import { NAV_CONFIG as BASE_NAV_CONFIG } from "./nav-config.base";

const ADDITIONAL_PRIMARY = [
  { href: "/shop", label: "Shop" },
  { href: "/selector", label: "Product Selector" },
  { href: "/installer", label: "Installer Portal" },
];

const ADDITIONAL_GROUPS = [
  {
    label: "Installer",
    items: [{ href: "/installer/apply", label: "Apply to Install" }],
  },
  {
    label: "Account",
    items: [{ href: "/account/orders", label: "Order History" }],
  },
  {
    label: "Admin",
    items: [{ href: "/admin/forecasting", label: "Demand Forecasting" }],
  },
];

export const NAV_CONFIG: typeof BASE_NAV_CONFIG = {
  ...BASE_NAV_CONFIG,
  primary: [...BASE_NAV_CONFIG.primary, ...ADDITIONAL_PRIMARY],
  groups: [...BASE_NAV_CONFIG.groups, ...ADDITIONAL_GROUPS],
};
