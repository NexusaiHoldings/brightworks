import type { JSX } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/admin-auth";
import { isInstallerVerified } from "@/lib/brightworks/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DISCOUNT_RATE = 0.2;

interface WholesaleSku {
  id: string;
  name: string;
  category: string;
  retailPrice: number;
  unit: string;
}

const CATALOG: WholesaleSku[] = [
  {
    id: "sku-bw-001",
    name: "Architectural Shingles — 30-Year",
    category: "Roofing",
    retailPrice: 89.99,
    unit: "square",
  },
  {
    id: "sku-bw-002",
    name: "Ridge Cap Shingles",
    category: "Roofing",
    retailPrice: 65.0,
    unit: "bundle",
  },
  {
    id: "sku-bw-003",
    name: "Ice & Water Shield (200 sq ft)",
    category: "Roofing",
    retailPrice: 72.5,
    unit: "roll",
  },
  {
    id: "sku-bw-004",
    name: "Synthetic Underlayment (10 sq)",
    category: "Roofing",
    retailPrice: 45.0,
    unit: "roll",
  },
  {
    id: "sku-bw-005",
    name: "Drip Edge Aluminum (10 ft)",
    category: "Roofing",
    retailPrice: 8.49,
    unit: "piece",
  },
  {
    id: "sku-bw-006",
    name: 'Coil Roofing Nails 1-3/4" (5 lb)',
    category: "Fasteners",
    retailPrice: 14.99,
    unit: "box",
  },
  {
    id: "sku-bw-007",
    name: "Aluminum Step Flashing (10 ft)",
    category: "Roofing",
    retailPrice: 22.0,
    unit: "piece",
  },
  {
    id: "sku-bw-008",
    name: "Ridge Vent (4 ft section)",
    category: "Ventilation",
    retailPrice: 19.99,
    unit: "section",
  },
  {
    id: "sku-bw-009",
    name: "Soffit Vent (16×8 in)",
    category: "Ventilation",
    retailPrice: 6.49,
    unit: "piece",
  },
  {
    id: "sku-bw-010",
    name: "Roof Cement (1 gal)",
    category: "Sealants",
    retailPrice: 18.99,
    unit: "pail",
  },
];

function toWholesale(retail: number): string {
  return (retail * (1 - DISCOUNT_RATE)).toFixed(2);
}

export default async function InstallerPortalPage(): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login?next=/installer");
  }

  const verified = await isInstallerVerified(user.id);

  if (!verified) {
    return (
      <main>
        <h1>Installer Wholesale Portal</h1>
        <p>Exclusive 20% volume pricing for verified installer partners.</p>
        <div className="card">
          <h2>Access Restricted</h2>
          <p>
            Your account has not yet been verified for installer wholesale
            access. Submit an application to have your credentials reviewed —
            approvals are typically processed within 2 business days.
          </p>
          <Link href="/installer/apply" className="btn">
            Apply for Installer Access
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main>
      <h1>Installer Wholesale Portal</h1>
      <p>
        Verified installer pricing — 20% volume discount applied to all SKUs.
        Contact your account rep to place a bulk order.
      </p>

      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>Product</th>
            <th>Category</th>
            <th>Retail</th>
            <th>Your Price</th>
            <th>Unit</th>
          </tr>
        </thead>
        <tbody>
          {CATALOG.map((sku) => (
            <tr key={sku.id}>
              <td className="muted">{sku.id}</td>
              <td>{sku.name}</td>
              <td>{sku.category}</td>
              <td>${sku.retailPrice.toFixed(2)}</td>
              <td>
                <strong>${toWholesale(sku.retailPrice)}</strong>
              </td>
              <td>{sku.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
