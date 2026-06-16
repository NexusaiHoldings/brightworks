import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/admin-auth";
import { getInstallerStatus } from "@/lib/brightworks/access";

const WHOLESALE_DISCOUNT = 0.20;

interface Product {
  sku: string;
  name: string;
  description: string;
  retailPrice: number;
}

const CATALOG: Product[] = [
  {
    sku: "BW-T24-IP65",
    name: "IP65 24-Hour Weatherproof Timer",
    description: "NRTL-certified single-outlet programmable timer, IP65 rated, 15A capacity",
    retailPrice: 49.99,
  },
  {
    sku: "BW-T7D-IP65",
    name: "IP65 7-Day Weatherproof Timer",
    description: "NRTL-certified 7-day programmable timer, IP65 rated, dual outlet, 15A",
    retailPrice: 69.99,
  },
  {
    sku: "BW-QC20-WP",
    name: "Weatherproof Quick-Connect Set (20-pack)",
    description: "UV-resistant snap connectors for strands up to 16 AWG, outdoor rated",
    retailPrice: 24.99,
  },
  {
    sku: "BW-E2E50-WP",
    name: "End-to-End Weatherproof Connectors (50-pack)",
    description: "IP44 rated male-to-female inline connectors for light string extensions",
    retailPrice: 39.99,
  },
  {
    sku: "BW-KIT5-PRO",
    name: "Holiday Lighting Pro Install Kit — 5-Outlet",
    description: "5-outlet weatherproof power strip + timer + 20 quick-connects + carry bag",
    retailPrice: 89.99,
  },
  {
    sku: "BW-KIT10-PRO",
    name: "Holiday Lighting Pro Install Kit — 10-Outlet",
    description: "10-outlet weatherproof power strip + 7-day timer + 50 quick-connects + carry bag",
    retailPrice: 149.99,
  },
  {
    sku: "BW-GFCI-IP65",
    name: "IP65 GFCI Outlet Cover (weatherproof in-use cover)",
    description: "Extra-duty in-use cover fits duplex & GFCI outlets, rated for wet locations",
    retailPrice: 18.99,
  },
  {
    sku: "BW-CORD16A-50",
    name: "16 AWG Extension Cord — 50 ft (outdoor rated)",
    description: "SJTW 3-conductor orange extension cord, IP44, 13A, 1625W max",
    retailPrice: 34.99,
  },
];

function wholesalePrice(retail: number): number {
  return Math.round(retail * (1 - WHOLESALE_DISCOUNT) * 100) / 100;
}

function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export default async function InstallerPortalPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/api/auth/login");
  }

  const status = await getInstallerStatus(user.id);
  const justApplied = searchParams.applied === "1";

  if (!status.verified) {
    return (
      <main>
        <h1>Installer Wholesale Portal</h1>
        <p>
          Exclusive wholesale pricing for verified Brightworks installer partners — 20% below
          retail across the full catalog.
        </p>

        {justApplied && (
          <div className="card">
            <strong>Application received</strong>
            <p>
              Your installer application is under review. Our team typically responds within
              1–2 business days. You will receive an email once your account is approved.
            </p>
          </div>
        )}

        {!justApplied && status.hasPendingApplication && (
          <div className="card">
            <strong>Application pending review</strong>
            <p>
              Your installer application is currently under review. We will email you once a
              decision has been made.
            </p>
          </div>
        )}

        {!justApplied && !status.hasPendingApplication && (
          <div className="empty">
            <p>
              You do not yet have verified installer status. Apply below to unlock wholesale
              pricing and represent Brightworks hardware to your clients.
            </p>
            <Link href="/installer/apply" className="btn">
              Apply for Installer Access
            </Link>
          </div>
        )}
      </main>
    );
  }

  return (
    <main>
      <h1>Installer Wholesale Portal</h1>
      <p>
        Welcome, {user.email}. Your account has verified installer status — all prices below
        reflect the 20% volume discount off retail.
      </p>

      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>Product</th>
            <th>Retail</th>
            <th>Your Price</th>
            <th>Savings</th>
          </tr>
        </thead>
        <tbody>
          {CATALOG.map((product) => {
            const wp = wholesalePrice(product.retailPrice);
            const savings = Math.round((product.retailPrice - wp) * 100) / 100;
            return (
              <tr key={product.sku}>
                <td>
                  <span className="muted">{product.sku}</span>
                </td>
                <td>
                  <strong>{product.name}</strong>
                  <br />
                  <span className="muted">{product.description}</span>
                </td>
                <td>
                  <span className="muted" style={{ textDecoration: "line-through" }}>
                    {formatUsd(product.retailPrice)}
                  </span>
                </td>
                <td>
                  <strong>{formatUsd(wp)}</strong>
                </td>
                <td>
                  <span className="muted">{formatUsd(savings)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="card">
        <strong>How to order</strong>
        <p>
          Contact your Brightworks account manager to place a wholesale order or request a
          quote. Minimum order quantity is 10 units per SKU. Net-30 terms available for
          accounts with 3+ approved orders.
        </p>
        <p>
          Email: <a href="mailto:wholesale@usebrightworks.com">wholesale@usebrightworks.com</a>
        </p>
      </div>
    </main>
  );
}
