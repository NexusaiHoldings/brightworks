export type NavLink = {
  href: string;
  label: string;
  external?: boolean;
  badge?: string;
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
    { href: "/conversation", label: "Conversations" },
    { href: "/work", label: "Work" },
    { href: "/artifact", label: "Artifacts" },
    { href: "/approval", label: "Approvals" },
    { href: "/direct", label: "Records" },
    { href: "/shop", label: "Shop" },
    { href: "/selector", label: "Product Selector" },
    { href: "/installer", label: "Installer Portal" },
  ],
  groups: [
    {
      label: "Brightworks",
      links: [
        { href: "/", label: "Home" },
        { href: "/shop", label: "Shop" },
        { href: "/selector", label: "Product Selector" },
        { href: "/installer", label: "Installer Program" },
        { href: "/installer/apply", label: "Installer Application" },
        { href: "/account/orders", label: "My Orders" },
      ],
    },
    {
      label: "Operations",
      links: [
        { href: "/conversation", label: "Conversations" },
        { href: "/work", label: "Work" },
        { href: "/artifact", label: "Artifacts" },
        { href: "/approval", label: "Approvals" },
        { href: "/direct", label: "Records" },
        { href: "/admin/forecasting", label: "Demand Forecasting" },
      ],
    },
  ],
};
