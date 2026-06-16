export type NavLink = {
  label: string;
  href: string;
  description?: string;
  external?: boolean;
  target?: "_self" | "_blank";
};

export type NavGroup = {
  title: string;
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
    { label: "Installer Portal", href: "/installer" },
  ],
  groups: [
    {
      title: "Installers",
      links: [
        { label: "Installer Portal", href: "/installer" },
        { label: "Apply to Install", href: "/installer/apply" },
      ],
    },
    {
      title: "Account",
      links: [{ label: "Order History", href: "/account/orders" }],
    },
    {
      title: "Admin",
      links: [{ label: "Demand Forecasting", href: "/admin/forecasting" }],
    },
  ],
};
