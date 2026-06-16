export const NAV_CONFIG = {
  primary: [
    { label: "Home", href: "/" },
    { label: "Shop", href: "/shop" },
    { label: "Product Selector", href: "/selector" },
    { label: "Installer Portal", href: "/installer" },
  ],
  groups: [
    {
      label: "Installers",
      items: [
        { label: "Portal", href: "/installer" },
        { label: "Apply", href: "/installer/apply" },
      ],
    },
    {
      label: "Customers",
      items: [{ label: "Order History", href: "/account/orders" }],
    },
    {
      label: "Operations",
      items: [{ label: "Demand Forecasting", href: "/admin/forecasting" }],
    },
  ],
} as const;
