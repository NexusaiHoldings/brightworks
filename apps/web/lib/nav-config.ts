import { NAV_CONFIG as BASE_NAV_CONFIG } from "@/components/navigation/nav-config";

const basePrimary = BASE_NAV_CONFIG.primary ?? [];
const baseGroups = BASE_NAV_CONFIG.groups ?? [];

export const NAV_CONFIG: typeof BASE_NAV_CONFIG = {
  ...BASE_NAV_CONFIG,
  primary: [
    ...basePrimary,
    { label: "Shop", href: "/shop" },
    { label: "Product Selector", href: "/selector" },
  ],
  groups: [
    ...baseGroups,
    {
      label: "Installers",
      links: [
        { label: "Installer Portal", href: "/installer" },
        { label: "Apply to Install", href: "/installer/apply" },
      ],
    },
    {
      label: "Account",
      links: [{ label: "Order History", href: "/account/orders" }],
    },
    {
      label: "Operations",
      links: [{ label: "Demand Forecasting", href: "/admin/forecasting" }],
    },
  ],
};
