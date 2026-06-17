/**
 * Top Navigation Configuration — substrate-topnav-001 (2026-05-24).
 *
 * Substrate ships with one nav entry (Home). Each portfolio company's
 * coding pipeline extends this file via F1-001 (per CTO mvp_scope —
 * cto-prompt-nav-requirement-001) to add links to the company's
 * specific feature pages.
 *
 * The substrate's TopNav component reads PRIMARY_NAV_LINKS and renders
 * them in the order declared.
 *
 * Convention:
 *   - Always keep Home as the first entry.
 *   - Group related pages with NavGroup (admin, account, etc.).
 *   - Use relative paths (Next.js route group parens collapse out of
 *     the URL — e.g. apps/web/app/(domain)/configure/page.tsx serves
 *     at /configure).
 *   - Server-only data; no client JS bundled from this file.
 */

export type NavLink = {
  /** URL path (without route-group parens). */
  href: string;
  /** Visible label. */
  label: string;
};

export type NavGroup = {
  /** Group label (e.g. "Account", "Admin"). */
  label: string;
  /** Child links shown inline (flat) inside the group. */
  links: NavLink[];
};

export type NavConfig = {
  primary: NavLink[];
  groups: NavGroup[];
};

export const NAV_CONFIG: NavConfig = {
  primary: [
    { href: "/", label: "Home" },
    { href: "/shop", label: "Shop" },
    { href: "/selector", label: "Product Selector" },
    { href: "/installer", label: "Installer Portal" },
  ],
  groups: [
    {
      label: "Installers",
      links: [
        { href: "/installer", label: "Installer Portal" },
        { href: "/installer/apply", label: "Apply to Install" },
      ],
    },
    {
      label: "Account",
      links: [{ href: "/account/orders", label: "Order History" }],
    },
    {
      label: "Admin",
      links: [{ href: "/admin/forecasting", label: "Demand Forecasting" }],
    },
  ],
};
