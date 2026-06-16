export const NAV_CONFIG = {
  primary: [
    { href: "/conversation", label: "Conversation" },
    { href: "/work", label: "Work" },
    { href: "/artifact", label: "Artifacts" },
    { href: "/approval", label: "Approvals" },
    { href: "/direct", label: "Direct" },
    { href: "/shop", label: "Shop" },
    { href: "/selector", label: "Product Selector" },
  ],
  groups: [
    {
      label: "Installers",
      items: [
        { href: "/installer", label: "Installer Portal" },
        { href: "/installer/apply", label: "Apply to Install" },
      ],
    },
    {
      label: "Account",
      items: [{ href: "/account/orders", label: "Order History" }],
    },
    {
      label: "Admin",
      items: [{ href: "/admin/forecasting", label: "Forecasting" }],
    },
  ],
} as const;
