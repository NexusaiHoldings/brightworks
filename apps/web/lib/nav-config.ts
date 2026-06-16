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
    { label: "Selector", href: "/selector" },
    { label: "Installer", href: "/installer" },
    { label: "Apply to Install", href: "/installer/apply" },
    { label: "Order History", href: "/account/orders" },
    { label: "Forecasting", href: "/admin/forecasting" },
  ],
  groups: [
    {
      label: "Shop",
      links: [
        { label: "Shop All Products", href: "/shop" },
        { label: "Guided Selector", href: "/selector" },
      ],
    },
    {
      label: "Installer",
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
      label: "Admin",
      links: [{ label: "Demand Forecasting", href: "/admin/forecasting" }],
    },
  ],
};
