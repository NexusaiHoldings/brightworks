export type NavLink = {
  label: string;
  href: string;
  external?: boolean;
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
    { label: "Home", href: "/" },
    { label: "Shop", href: "/shop" },
    { label: "Product Selector", href: "/selector" },
    { label: "Installer Program", href: "/installer" },
  ],
  groups: [
    {
      label: "Installer Program",
      links: [{ label: "Apply to Install", href: "/installer/apply" }],
    },
    {
      label: "Account",
      links: [{ label: "Orders", href: "/account/orders" }],
    },
    {
      label: "Admin",
      links: [{ label: "Demand Forecasting", href: "/admin/forecasting" }],
    },
  ],
};

export default NAV_CONFIG;
