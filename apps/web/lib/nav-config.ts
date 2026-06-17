export interface NavLink {
  label: string;
  href: string;
}

export interface NavGroup {
  label: string;
  links: NavLink[];
}

export interface NavConfigShape {
  primary: NavLink[];
  groups: NavGroup[];
}

export type NavConfig = NavConfigShape;

export const NAV_CONFIG: NavConfigShape = {
  primary: [
    { label: "Shop", href: "/shop" },
    { label: "Product Selector", href: "/selector" },
  ],
  groups: [
    {
      label: "Installers",
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
      label: "Operations",
      links: [{ label: "Demand Forecasting", href: "/admin/forecasting" }],
    },
  ],
};
