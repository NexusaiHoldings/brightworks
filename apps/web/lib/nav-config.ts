// Extend NAV_CONFIG here — <TopNav /> reads this file; never edit the component.

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
      label: "Installer Network",
      href: "/installer",
    },
  ],
  groups: [
    {
      label: "Installers",
      links: [
        {
          label: "Installer Hub",
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
          label: "Forecasting",
          href: "/admin/forecasting",
        },
      ],
    },
  ],
};

export default NAV_CONFIG;
