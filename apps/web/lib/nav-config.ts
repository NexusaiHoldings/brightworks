export const NAV_CONFIG = {
  primary: [
    { label: "Shop", href: "/shop" },
    { label: "Selector", href: "/selector" },
  ],
  groups: [
    {
      label: "Installer",
      items: [
        { label: "Portal", href: "/installer" },
        { label: "Apply", href: "/installer/apply" },
      ],
    },
    {
      label: "Account",
      items: [{ label: "Orders", href: "/account/orders" }],
    },
    {
      label: "Admin",
      items: [{ label: "Forecasting", href: "/admin/forecasting" }],
    },
  ],
};
