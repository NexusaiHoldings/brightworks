export type NavLink = {
  title: string;
  href: string;
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
    { title: "Shop", href: "/shop" },
    { title: "Product Selector", href: "/selector" },
    { title: "Installer Portal", href: "/installer" },
  ],
  groups: [
    {
      title: "Installers",
      links: [
        { title: "Installer Portal", href: "/installer" },
        { title: "Apply to be an Installer", href: "/installer/apply" },
      ],
    },
    {
      title: "Account",
      links: [{ title: "Order History", href: "/account/orders" }],
    },
    {
      title: "Admin",
      links: [{ title: "Forecasting", href: "/admin/forecasting" }],
    },
  ],
};
