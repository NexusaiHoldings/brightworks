/**
 * /installer — Wholesale portal for verified Brightworks installer partners.
 *
 * Gate: installer_verified=true via installer_profiles table. Unverified users
 * see their application status or a link to /installer/apply. Verified users see
 * the full SKU catalog at 20% below retail (wholesale tier).
 */

import type { JSX } from "react";
import Link from "next/link";
import {
  checkInstallerAccess,
  wholesalePrice,
  WHOLESALE_DISCOUNT,
} from "@/lib/brightworks/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Product {
  sku: string;
  name: string;
  category: string;
  retailPrice: number;
  unit: string;
}

const CATALOG: Product[] = [
  {
    sku: "BW-ROOF-001",
    name: "Architectural Asphalt Shingles 30yr",
    category: "Roofing",
    retailPrice: 89.99,
    unit: "sq (100 sq ft)",
  },
  {
    sku: "BW-ROOF-002",
    name: "Ridge Cap Shingles",
    category: "Roofing",
    retailPrice: 54.99,
    unit: "bundle",
  },
  {
    sku: "BW-ROOF-003",
    name: "Synthetic Underlayment 10sq Roll",
    category: "Roofing",
    retailPrice: 68.0,
    unit: "roll",
  },
  {
    sku: "BW-GUTTER-001",
    name: "Seamless Aluminum Gutter 5″",
    category: "Gutters",
    retailPrice: 6.5,
    unit: "lin ft",
  },
  {
    sku: "BW-GUTTER-002",
    name: "Gutter Guard Pro Series",
    category: "Gutters",
    retailPrice: 4.25,
    unit: "lin ft",
  },
  {
    sku: "BW-GUTTER-003",
    name: "Downspout 3×4″ Aluminum",
    category: "Gutters",
    retailPrice: 3.75,
    unit: "lin ft",
  },
  {
    sku: "BW-SIDING-001",
    name: "Fiber Cement Lap Siding 7.25″",
    category: "Siding",
    retailPrice: 2.1,
    unit: "sq ft",
  },
  {
    sku: "BW-SIDING-002",
    name: "Vinyl Siding Double 4 Classic",
    category: "Siding",
    retailPrice: 1.4,
    unit: "sq ft",
  },
  {
    sku: "BW-WINDOW-001",
    name: "Double-Hung Vinyl Window 3040",
    category: "Windows & Doors",
    retailPrice: 245.0,
    unit: "unit",
  },
  {
    sku: "BW-WINDOW-002",
    name: "Casement Vinyl Window 3046",
    category: "Windows & Doors",
    retailPrice: 285.0,
    unit: "unit",
  },
  {
    sku: "BW-DOOR-001",
    name: "Fiberglass Entry Door 36×80 Pre-hung",
    category: "Windows & Doors",
    retailPrice: 385.0,
    unit: "unit",
  },
  {
    sku: "BW-DOOR-002",
    name: "Steel Insulated Entry Door 32×80",
    category: "Windows & Doors",
    retailPrice: 295.0,
    unit: "unit",
  },
];

const discountPct = Math.round(WHOLESALE_DISCOUNT * 100);

export default async function InstallerPage(): Promise<JSX.Element> {
  const { user, verified, applicationStatus } = await checkInstallerAccess();

  if (!user) {
    return (
      <main>
        <h1>Installer Wholesale Portal</h1>
        <p>Exclusive wholesale pricing for verified Brightworks installer partners.</p>
        <div className="empty">
          <p>Please log in to access the wholesale portal.</p>
          <Link href="/login" className="btn">
            Log In
          </Link>
          &nbsp;&nbsp;
          <Link href="/installer/apply" className="btn secondary">
            Apply for Partner Access
          </Link>
        </div>
      </main>
    );
  }

  if (!verified) {
    if (applicationStatus === "pending") {
      return (
        <main>
          <h1>Installer Wholesale Portal</h1>
          <p>Exclusive wholesale pricing for verified Brightworks installer partners.</p>
          <div className="card">
            <h2>Application Under Review</h2>
            <p>
              Your installer application has been received and is pending review.
              Our partner team typically responds within 2–3 business days.
            </p>
            <p className="muted">
              Questions?{" "}
              <a href="mailto:partners@usebrightworks.com">
                partners@usebrightworks.com
              </a>
            </p>
          </div>
        </main>
      );
    }

    if (applicationStatus === "rejected") {
      return (
        <main>
          <h1>Installer Wholesale Portal</h1>
          <p>Exclusive wholesale pricing for verified Brightworks installer partners.</p>
          <div className="card">
            <h2>Application Not Approved</h2>
            <p>
              Your installer application was not approved at this time. Please
              contact our partner team to discuss eligibility or reapply.
            </p>
            <a href="mailto:partners@usebrightworks.com" className="btn">
              Contact Partner Team
            </a>
            &nbsp;&nbsp;
            <Link href="/installer/apply" className="btn secondary">
              Reapply
            </Link>
          </div>
        </main>
      );
    }

    return (
      <main>
        <h1>Installer Wholesale Portal</h1>
        <p>Exclusive wholesale pricing for verified Brightworks installer partners.</p>
        <div className="empty">
          <p>
            Wholesale access is available to verified installer partners only.
            Apply to join our partner network and unlock{" "}
            <strong>{discountPct}% below retail</strong> on all products.
          </p>
          <Link href="/installer/apply" className="btn">
            Apply for Partner Access
          </Link>
        </div>
      </main>
    );
  }

  const categories = Array.from(new Set(CATALOG.map((p) => p.category)));

  return (
    <main>
      <h1>Installer Wholesale Portal</h1>
      <p>
        Welcome back — your verified partner account is active. All prices shown
        reflect your <strong>{discountPct}% wholesale discount</strong> off
        standard retail.
      </p>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <strong>Wholesale Account Active</strong>
        <p className="muted">
          Logged in as {user.email}. To place an order, email{" "}
          <a href="mailto:orders@usebrightworks.com">
            orders@usebrightworks.com
          </a>{" "}
          or call <a href="tel:18002744489">1-800-BRIGHTWORKS</a>. Volume pricing
          available for orders over 50 units — ask your sales rep.
        </p>
      </div>

      {categories.map((category) => {
        const products = CATALOG.filter((p) => p.category === category);
        return (
          <section key={category} style={{ marginBottom: "2rem" }}>
            <h2>{category}</h2>
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product</th>
                  <th>Unit</th>
                  <th>Retail</th>
                  <th>Wholesale ({discountPct}% off)</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.sku}>
                    <td>
                      <code>{product.sku}</code>
                    </td>
                    <td>{product.name}</td>
                    <td>{product.unit}</td>
                    <td>${product.retailPrice.toFixed(2)}</td>
                    <td>
                      <strong>
                        ${wholesalePrice(product.retailPrice).toFixed(2)}
                      </strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}

      <div className="card">
        <p className="muted">
          Prices are reviewed quarterly. All orders are subject to availability.
          Lead times for special orders: 2–4 weeks. Payment terms: Net 30 for
          approved partner accounts.
        </p>
        <p className="muted">
          <a href="mailto:orders@usebrightworks.com">
            orders@usebrightworks.com
          </a>{" "}
          · 1-800-BRIGHTWORKS (Mon–Fri 7am–6pm CT)
        </p>
      </div>
    </main>
  );
}
