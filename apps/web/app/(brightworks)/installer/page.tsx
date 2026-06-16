import type { JSX } from "react";
import Link from "next/link";
import { getInstallerAccess } from "@/lib/brightworks/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PricingItem {
  name: string;
  retail: number;
  unit: string;
}

const WHOLESALE_DISCOUNT = 0.2;

const CATALOG: PricingItem[] = [
  { name: "Premium Architectural Shingles", retail: 85, unit: "square" },
  { name: "Fiber Cement Siding", retail: 120, unit: "square" },
  { name: "Window & Door Flashing Kit", retail: 48, unit: "kit" },
  { name: "50-Year Vapor Barrier (500 sq ft)", retail: 64, unit: "roll" },
  { name: "Composite Deck Boards (16 ft)", retail: 32, unit: "board" },
  { name: "Exterior Caulk & Sealant Bundle", retail: 24, unit: "pack" },
  { name: "Ice & Water Shield (2 sq)", retail: 96, unit: "roll" },
  { name: "Soffit & Fascia Trim Package", retail: 155, unit: "set" },
];

export default async function InstallerPortalPage(): Promise<JSX.Element> {
  const access = await getInstallerAccess();

  if (!access) {
    return (
      <main>
        <h1>Installer Wholesale Portal</h1>
        <p>Exclusive wholesale pricing for verified Brightworks installer partners.</p>
        <div className="empty">
          <p>Please log in to access your installer account.</p>
          <Link href="/login?redirect=/installer" className="btn">Log In</Link>
        </div>
      </main>
    );
  }

  if (!access.isVerified) {
    if (access.applicationStatus === "pending") {
      return (
        <main>
          <h1>Installer Wholesale Portal</h1>
          <p>Exclusive wholesale pricing for verified Brightworks installer partners.</p>
          <div className="card">
            <h2>Application Under Review</h2>
            <p>Your installer application is being reviewed by our partner relations team. You will receive an email at <strong>{access.user.email}</strong> once a decision has been made.</p>
            <p className="muted">Typical review time is 2–3 business days.</p>
          </div>
        </main>
      );
    }

    if (access.applicationStatus === "rejected") {
      return (
        <main>
          <h1>Installer Wholesale Portal</h1>
          <p>Exclusive wholesale pricing for verified Brightworks installer partners.</p>
          <div className="card">
            <h2>Application Not Approved</h2>
            <p>Your installer application was not approved at this time. Please contact our support team if you have questions or would like to discuss reapplying.</p>
            <Link href="/support" className="btn secondary">Contact Support</Link>
          </div>
        </main>
      );
    }

    return (
      <main>
        <h1>Installer Wholesale Portal</h1>
        <p>Exclusive wholesale pricing for verified Brightworks installer partners.</p>
        <div className="empty">
          <h2>Installer Verification Required</h2>
          <p>This portal is restricted to verified Brightworks installer partners. Apply today to unlock 20% wholesale pricing across our full product catalog.</p>
          <Link href="/installer/apply" className="btn">Apply for Installer Access</Link>
        </div>
      </main>
    );
  }

  return (
    <main>
      <h1>Installer Wholesale Portal</h1>
      <p>Welcome, {access.user.email}. Your verified installer pricing with 20% volume discount is shown below.</p>
      <div className="card">
        <h2>Wholesale Pricing — 20% Volume Discount</h2>
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Retail</th>
              <th>Installer Price</th>
              <th>You Save</th>
              <th>Unit</th>
            </tr>
          </thead>
          <tbody>
            {CATALOG.map((item) => {
              const wholesale = item.retail * (1 - WHOLESALE_DISCOUNT);
              const savings = item.retail * WHOLESALE_DISCOUNT;
              return (
                <tr key={item.name}>
                  <td>{item.name}</td>
                  <td>${item.retail.toFixed(2)}</td>
                  <td><strong>${wholesale.toFixed(2)}</strong></td>
                  <td className="muted">${savings.toFixed(2)}</td>
                  <td className="muted">per {item.unit}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted">Installer pricing applies to all qualifying orders. <Link href="/support">Contact support</Link> to place a wholesale order.</p>
    </main>
  );
}
