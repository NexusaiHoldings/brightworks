export type NavLink = {
  label: string;
  href: string;
  matcher?: RegExp | ((pathname: string) => boolean);
  external?: boolean;
};

export type NavGroup = {
  label: string;
  links: NavLink[];
};

export type NavConfig = {
  primary: NavLink[];
  secondary: NavLink[];
  groups: NavGroup[];
};

export const NAV_CONFIG: NavConfig = {
  primary: [
    {
      label: "Home",
      href: "/",
    },
    {
      label: "Shop",
      href: "/shop",
    },
    {
      label: "Product Selector",
      href: "/selector",
    },
    {
      label: "Installer Portal",
      href: "/installer",
    },
  ],
  secondary: [],
  groups: [
    {
      label: "Installers",
      links: [
        {
          label: "Installer Portal",
          href: "/installer",
        },
        {
          label: "Apply to Install",
          href: "/installer/apply",
        },
      ],
    },
    {
      label: "Account",
      links: [
        {
          label: "Order History",
          href: "/account/orders",
        },
      ],
    },
    {
      label: "Admin",
      links: [
        {
          label: "Demand Forecasting",
          href: "/admin/forecasting",
        },
      ],
    },
  ],
};
