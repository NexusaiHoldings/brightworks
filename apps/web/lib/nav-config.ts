export type NavLink = {
  label: string;
  href: string;
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
    { label: "Shop", href: "/shop" },
    { label: "Product Selector", href: "/selector" },
    { label: "Installer Portal", href: "/installer" },
  ],
  groups: [
    {
      label: "Installers",
      links: [
        { label: "Installer Portal", href: "/installer" },
        { label: "Apply to be an Installer", href: "/installer/apply" },
      ],
    },
    {
      label: "Account",
      links: [{ label: "Order History", href: "/account/orders" }],
    },
    {
      label: "Admin",
      links: [{ label: "Forecasting", href: "/admin/forecasting" }],
    },
  ],
};
