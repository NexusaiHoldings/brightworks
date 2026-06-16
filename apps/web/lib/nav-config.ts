export type NavLink = {
  label: string;
  href: string;
  external?: boolean;
};

export type NavGroup = {
  heading: string;
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
    { label: "Installer Network", href: "/installer" },
  ],
  groups: [
    {
      heading: "Installers",
      links: [
        { label: "Installer Overview", href: "/installer" },
        { label: "Apply to Install", href: "/installer/apply" },
      ],
    },
    {
      heading: "Account",
      links: [{ label: "Order History", href: "/account/orders" }],
    },
    {
      heading: "Operations",
      links: [{ label: "Demand Forecasting", href: "/admin/forecasting" }],
    },
  ],
};

export default NAV_CONFIG;
