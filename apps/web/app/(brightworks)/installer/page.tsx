import type { JSX } from "react";
import Link from "next/link";
import { getSessionUser } from "@/lib/admin-auth";
import { isInstallerVerified } from "@/lib/brightworks/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WHOLESALE_CATALOG = [
  { sku: "BW-SOL-200W",  name: "200W Solar Panel Kit",       retail: 349.0,  category: "Solar"     },
  { sku: "BW-SOL-400W",  name: "400W Solar Panel Kit",       retail: 649.0,  category: "Solar"     },
  { sku: "BW-BAT-100AH", name: "100Ah LiFePO4 Battery",      retail: 499.0,  category: "Storage"   },
  { sku: "BW-BAT-200AH", name: "200Ah LiFePO4 Battery",      retail: 899.0,  category: "Storage"   },
  { sku: "BW-INV-2000W", name: "2000W Pure Sine Inverter",    retail: 449.0,  category: "Inverters" },
  { sku: "BW-INV-3000W", name: "3000W Pure Sine Inverter",    retail: 699.0,  category: "Inverters" },
  { sku: "BW-MNT-ROOF",  name: "Roof Mount Bracket Set",      retail: 129.0,  category: "Mounting"  },
  { sku: "BW-MNT-GRND",  name: "Ground Mount Frame Kit",      retail: 219.0,  category: "Mounting"  },
] as const;

const DISCOUNT_RATE = 0.2;

function usd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export default async function InstallerPortalPage(): Promise<JSX.Element> {
  const user = await getSessionUser();

  if (!user) {
    return (
      <main>
        <h1>Installer Wholesale Portal</h1>
        <p>
          Exclusive 20% volume pricing for verified Brightworks installer partners.
        </p>
        <div className="empty">
          <p>
            Please <Link href="/login">sign in</Link> to access installer pricing.
          </p>
        </div>
      </main>
    );
  }

  const verified = await isInstallerVerified(user.id);

  if (!verified) {
    return (
      <main>
        <h1>Installer Wholesale Portal</h1>
        <p>
          Exclusive 20% volume pricing for verified Brightworks installer partners.
        </p>
        <div className="empty">
          <strong>Installer verification required</strong>
          <p>
            Your account has not yet been verified as a Brightworks installer partner.
            Apply below to unlock wholesale pricing across our full product catalog.
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
        Verified installer pricing — 20% volume discount applied to all catalog SKUs.
      </p>

      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>Product</th>
            <th>Category</th>
            <th>Retail</th>
            <th>Your Price (−20%)</th>
            <th>Savings</th>
          </tr>
        </thead>
        <tbody>
          {WHOLESALE_CATALOG.map((item) => {
            const wholesale = item.retail * (1 - DISCOUNT_RATE);
            const savings = item.retail - wholesale;
            return (
              <tr key={item.sku}>
                <td>
                  <code>{item.sku}</code>
                </td>
                <td>{item.name}</td>
                <td>{item.category}</td>
                <td>{usd(item.retail)}</td>
                <td>
                  <strong>{usd(wholesale)}</strong>
                </td>
                <td className="muted">{usd(savings)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="card">
        <strong>How to place wholesale orders</strong>
        <p>
          Email{" "}
          <a href="mailto:wholesale@usebrightworks.com">
            wholesale@usebrightworks.com
          </a>{" "}
          with your installer ID and the SKUs you need. Net-30 payment terms are
          available for accounts in good standing. Orders of 10+ units per SKU
          qualify for additional negotiated pricing — contact your account manager
          for a custom quote.
        </p>
      </div>
    </main>
  );
}
