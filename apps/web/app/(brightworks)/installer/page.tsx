/**
 * /installer — Installer Wholesale Portal.
 *
 * Gated: only accounts with an approved installer application
 * (installer_verified=true) may view wholesale pricing. Unapproved visitors
 * are directed to /installer/apply. Wholesale prices reflect a 20% volume
 * discount per ceo_briefing MVP scope.
 */

import type { JSX } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/admin-auth";
import {
  getInstallerProfile,
  applyInstallerDiscount,
  INSTALLER_DISCOUNT_RATE,
} from "@/lib/brightworks/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Product {
  sku: string;
  name: string;
  msrp: number;
  category: string;
  unit: string;
}

const CATALOG: Product[] = [
  { sku: "BW-OUT-001", name: "Premium Exterior Paint (1 gal)", msrp: 54.99, category: "Coatings", unit: "gal" },
  { sku: "BW-OUT-002", name: "Premium Exterior Paint (5 gal)", msrp: 239.99, category: "Coatings", unit: "5-gal" },
  { sku: "BW-PRM-001", name: "Weather-Seal Primer (1 gal)", msrp: 39.99, category: "Coatings", unit: "gal" },
  { sku: "BW-CLK-001", name: "Professional Caulk (10 oz)", msrp: 8.49, category: "Sealants", unit: "tube" },
  { sku: "BW-CLK-002", name: "Silicone Sealant (10 oz)", msrp: 10.99, category: "Sealants", unit: "tube" },
  { sku: "BW-FLS-001", name: "Self-Adhesive Flashing Tape (4\" × 75\')", msrp: 44.99, category: "Waterproofing", unit: "roll" },
  { sku: "BW-FLS-002", name: "Butyl Flashing Membrane (9\" × 50\')", msrp: 89.99, category: "Waterproofing", unit: "roll" },
  { sku: "BW-INS-001", name: "Spray Foam Insulation (12 oz)", msrp: 12.99, category: "Insulation", unit: "can" },
  { sku: "BW-INS-002", name: "Rigid Foam Board (2\" × 4\'×8\')", msrp: 34.99, category: "Insulation", unit: "sheet" },
  { sku: "BW-HRD-001", name: "Stainless Deck Screws (1 lb, #8×3\")", msrp: 18.99, category: "Fasteners", unit: "lb" },
  { sku: "BW-HRD-002", name: "Structural Screws (1 lb, #10×4\")", msrp: 22.99, category: "Fasteners", unit: "lb" },
  { sku: "BW-WRP-001", name: "House Wrap (9\'×100\')", msrp: 129.99, category: "Waterproofing", unit: "roll" },
];

const categories = Array.from(new Set(CATALOG.map((p) => p.category)));

export default async function InstallerPortalPage(): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const profile = await getInstallerProfile(user.id);
  const verified = profile?.status === "approved";

  if (!verified) {
    return (
      <main>
        <h1>Installer Wholesale Portal</h1>
        <p>Exclusive wholesale pricing for verified Brightworks installer partners.</p>

        {profile?.status === "pending" ? (
          <div className="card">
            <h2>Application Under Review</h2>
            <p>
              Your installer application for <strong>{profile.companyName}</strong> is
              currently under review. Our team typically responds within 2 business days.
              You will receive an email notification once a decision is made.
            </p>
            <p className="muted">Submitted: {new Date(profile.createdAt).toLocaleDateString()}</p>
          </div>
        ) : profile?.status === "rejected" ? (
          <div className="card">
            <h2>Application Not Approved</h2>
            <p>
              Unfortunately your installer application was not approved at this time.
              Please contact our partner team for more information or to reapply.
            </p>
            <Link href="/installer/apply" className="btn">Reapply</Link>
          </div>
        ) : (
          <div className="empty">
            <h2>Partner Access Required</h2>
            <p>
              Wholesale pricing is available exclusively to verified Brightworks installer
              partners. Apply for your installer account to access bulk pricing,
              priority stock, and dedicated account support.
            </p>
            <Link href="/installer/apply" className="btn">Apply for Installer Account</Link>
          </div>
        )}
      </main>
    );
  }

  const discountPct = Math.round(INSTALLER_DISCOUNT_RATE * 100);

  return (
    <main>
      <h1>Installer Wholesale Portal</h1>
      <p>
        Welcome back, <strong>{profile?.companyName ?? user.email}</strong>. Your verified
        installer account includes a {discountPct}% volume discount on all catalog items.
      </p>

      {categories.map((category) => (
        <section key={category} style={{ marginBottom: "2rem" }}>
          <h2>{category}</h2>
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th>Unit</th>
                <th style={{ textAlign: "right" }}>MSRP</th>
                <th style={{ textAlign: "right" }}>Wholesale ({discountPct}% off)</th>
              </tr>
            </thead>
            <tbody>
              {CATALOG.filter((p) => p.category === category).map((product) => (
                <tr key={product.sku}>
                  <td className="muted">{product.sku}</td>
                  <td>{product.name}</td>
                  <td className="muted">{product.unit}</td>
                  <td style={{ textAlign: "right" }} className="muted">
                    ${product.msrp.toFixed(2)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <strong>${applyInstallerDiscount(product.msrp).toFixed(2)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      <p className="muted" style={{ marginTop: "2rem" }}>
        Prices are per unit. Volume tier pricing is available for orders over 50 units —
        contact your account manager or email <a href="mailto:wholesale@usebrightworks.com">wholesale@usebrightworks.com</a>.
      </p>
    </main>
  );
}
