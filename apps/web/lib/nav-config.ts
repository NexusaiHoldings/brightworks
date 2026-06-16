export type NavLink = {
  href: string;
  label: string;
};

export type NavGroup = {
  label: string;
  links: NavLink[];
};

export type NavConfig = {
  primary: NavLink[];
  groups: NavGroup[];
};

export const NAV_CONFIG: NavConfig = {
  primary: [
    { href: "/shop", label: "Shop" },
    { href: "/selector", label: "Product Selector" },
    { href: "/installer", label: "Installer Portal" },
  ],
  groups: [
    {
      label: "Installer",
      links: [{ href: "/installer/apply", label: "Apply to Install" }],
    },
    {
      label: "Account",
      links: [{ href: "/account/orders", label: "Order History" }],
    },
    {
      label: "Admin",
      links: [{ href: "/admin/forecasting", label: "Demand Forecasting" }],
    },
  ],
};
