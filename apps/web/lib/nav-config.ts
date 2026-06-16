export const NAV_CONFIG = {
  primary: [
    { label: "Shop", href: "/shop" },
    { label: "Selector", href: "/selector" },
    { label: "Installer", href: "/installer" },
  ],
  groups: [
    {
      label: "Account",
      items: [{ label: "Orders", href: "/account/orders" }],
    },
    {
      label: "Admin",
      items: [{ label: "Forecasting", href: "/admin/forecasting" }],
    },
    {
      label: "Installer",
      items: [{ label: "Apply", href: "/installer/apply" }],
    },
  ],
};
