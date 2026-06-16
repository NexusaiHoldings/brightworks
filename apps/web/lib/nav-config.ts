import { NAV_CONFIG as BASE_NAV_CONFIG } from "@/lib/legos.config";

export const NAV_CONFIG = {
  ...BASE_NAV_CONFIG,
  primary: [
    ...BASE_NAV_CONFIG.primary,
    { label: "Shop", href: "/shop" },
    { label: "Product Selector", href: "/selector" },
    { label: "Installers", href: "/installer" },
  ],
  groups: [
    ...BASE_NAV_CONFIG.groups,
    {
      label: "Installers",
      items: [
        { label: "Installer Home", href: "/installer" },
        { label: "Apply as Installer", href: "/installer/apply" },
      ],
    },
    {
      label: "Account",
      items: [{ label: "Orders", href: "/account/orders" }],
    },
    {
      label: "Admin",
      items: [{ label: "Demand Forecasting", href: "/admin/forecasting" }],
    },
  ],
} satisfies typeof BASE_NAV_CONFIG;
