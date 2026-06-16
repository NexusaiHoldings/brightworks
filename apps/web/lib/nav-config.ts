export type NavLink = {
  label: string;
  href: string;
  exact?: boolean;
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
    { label: "Order History", href: "/account/orders" },
    { label: "Demand Forecasting", href: "/admin/forecasting" },
  ],
  groups: [
    {
      label: "Products",
      links: [
        { label: "Shop", href: "/shop" },
        { label: "Product Selector", href: "/selector" },
      ],
    },
    {
      label: "Installer Program",
      links: [
        { label: "Overview", href: "/installer" },
        { label: "Apply", href: "/installer/apply" },
      ],
    },
    {
      label: "Customers",
      links: [{ label: "Order History", href: "/account/orders" }],
    },
    {
      label: "Operations",
      links: [{ label: "Demand Forecasting", href: "/admin/forecasting" }],
    },
  ],
};

export default NAV_CONFIG;
