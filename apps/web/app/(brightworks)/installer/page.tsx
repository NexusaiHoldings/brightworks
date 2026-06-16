/**
 * /installer — wholesale portal for verified installer partners.
 *
 * Access-gated to installer_verified=true via lib/brightworks/access.ts.
 * Unverified users see an invitation to apply; verified users see the full
 * product catalog with 20% wholesale pricing per ceo_briefing MVP scope.
 */

import type { JSX } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/admin-auth";
import { isInstallerVerified, applyWholesaleDiscount } from "@/lib/brightworks/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Product {
  sku: string;
  name: string;
  unit: string;
  retailCents: number;
}

const WHOLESALE_CATALOG: Product[] = [
  { sku: "BW-LVP-001", name: "Luxury Vinyl Plank — Oak Harvest", unit: "box / 20 sq ft", retailCents: 8900 },
  { sku: "BW-LVP-002", name: "Luxury Vinyl Plank — Ash Smoke", unit: "box / 20 sq ft", retailCents: 9400 },
  { sku: "BW-LVP-003", name: "Luxury Vinyl Plank — Driftwood Grey", unit: "box / 20 sq ft", retailCents: 9800 },
  { sku: "BW-HWD-001", name: "Engineered Hardwood — White Oak", unit: "box / 25 sq ft", retailCents: 16500 },
  { sku: "BW-HWD-002", name: "Engineered Hardwood — Natural Walnut", unit: "box / 25 sq ft", retailCents: 19900 },
  { sku: "BW-LAM-001", name: "Laminate Plank — Grey Stone 12mm", unit: "box / 18 sq ft", retailCents: 5400 },
  { sku: "BW-LAM-002", name: "Laminate Plank — Classic Beech 8mm", unit: "box / 18 sq ft", retailCents: 4200 },
  { sku: "BW-UND-001", name: "Acoustic Underlayment Roll", unit: "roll / 100 sq ft", retailCents: 3200 },
  { sku: "BW-ADH-001", name: "Flooring Adhesive", unit: "1-gallon pail", retailCents: 4200 },
  { sku: "BW-TRM-001", name: "T-Molding Transition Strip", unit: "8 ft length", retailCents: 1800 },
  { sku: "BW-TRM-002", name: "Reducer Transition Strip", unit: "8 ft length", retailCents: 1900 },
  { sku: "BW-TRM-003", name: "Stair Nose Molding", unit: "8 ft length", retailCents: 2400 },
];

function formatUSD(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

interface InstallerPortalPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function InstallerPortalPage({
  searchParams,
}: InstallerPortalPageProps): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login?redirect=/installer");
  }

  const applied = searchParams.applied === "true";
  const verified = await isInstallerVerified(user.id);

  if (!verified) {
    return (
      <main>
        <h1>Installer Wholesale Portal</h1>
        <p>Exclusive wholesale pricing for verified Brightworks installer partners.</p>

        {applied && (
          <div className="card">
            <strong>Application received.</strong> Our team reviews installer applications
            within 2 business days. You will be notified by email once your account is
            verified.
          </div>
        )}

        <div className="card">
          <h2>Partner access required</h2>
          <p>
            Your account is not yet verified as an installer partner. Verified installers
            receive <strong>20% off retail pricing</strong> across the full Brightworks
            product catalog.
          </p>
          <Link href="/installer/apply" className="btn">
            Apply for installer access
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main>
      <h1>Wholesale Portal</h1>
      <p>Your installer pricing — 20% below retail on every SKU, applied automatically at checkout.</p>

      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>Product</th>
            <th>Unit</th>
            <th>Retail</th>
            <th>Your price</th>
            <th>You save</th>
          </tr>
        </thead>
        <tbody>
          {WHOLESALE_CATALOG.map((product) => {
            const wholesaleCents = applyWholesaleDiscount(product.retailCents);
            const savingsCents = product.retailCents - wholesaleCents;
            return (
              <tr key={product.sku}>
                <td>
                  <code>{product.sku}</code>
                </td>
                <td>{product.name}</td>
                <td className="muted">{product.unit}</td>
                <td className="muted">{formatUSD(product.retailCents)}</td>
                <td>
                  <strong>{formatUSD(wholesaleCents)}</strong>
                </td>
                <td>{formatUSD(savingsCents)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="muted">
        Prices are per unit. Volume pricing (100+ units per line item) is available —
        contact your account manager to place a bulk order.
      </p>
    </main>
  );
}
