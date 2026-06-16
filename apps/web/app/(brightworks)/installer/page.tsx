import type { JSX } from "react";
import Link from "next/link";
import { getInstallerSessionUser, isInstallerVerified } from "@/lib/brightworks/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WHOLESALE_DISCOUNT = 0.2;

interface Product {
  sku: string;
  name: string;
  category: string;
  retailPrice: number;
  description: string;
}

const CATALOG: Product[] = [
  {
    sku: "BW-TIM-OUT-01",
    name: "Outdoor Smart Timer — Single Zone",
    category: "Timers",
    retailPrice: 89.99,
    description: "Weather-resistant outdoor timer, single irrigation zone, app-controlled.",
  },
  {
    sku: "BW-TIM-OUT-04",
    name: "Outdoor Smart Timer — 4 Zone",
    category: "Timers",
    retailPrice: 149.99,
    description: "Heavy-duty weatherproof 4-zone timer, Brightworks app + voice control.",
  },
  {
    sku: "BW-TIM-OUT-08",
    name: "Outdoor Smart Timer — 8 Zone",
    category: "Timers",
    retailPrice: 229.99,
    description: "Commercial-grade 8-zone timer, supports seasonal scheduling presets.",
  },
  {
    sku: "BW-CTRL-HUB-01",
    name: "Brightworks Hub Controller",
    category: "Controllers",
    retailPrice: 119.99,
    description: "Central hub linking multiple timer zones, cloud + local failover.",
  },
  {
    sku: "BW-SNS-RAIN-01",
    name: "Wireless Rain Sensor",
    category: "Sensors",
    retailPrice: 39.99,
    description: "Auto-suspends active schedules on rain detection, 300 ft wireless range.",
  },
  {
    sku: "BW-SNS-SOIL-01",
    name: "Smart Soil Moisture Probe",
    category: "Sensors",
    retailPrice: 54.99,
    description: "Prevents overwatering; integrates with hub controller scheduling.",
  },
  {
    sku: "BW-ACC-MNTR-01",
    name: "Weatherproof Mounting Bracket Kit",
    category: "Accessories",
    retailPrice: 19.99,
    description: "Universal stainless bracket kit for exterior wall or post installation.",
  },
];

function wholesalePrice(retail: number): number {
  return Math.round(retail * (1 - WHOLESALE_DISCOUNT) * 100) / 100;
}

function usd(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export default async function InstallerPortalPage(): Promise<JSX.Element> {
  const user = await getInstallerSessionUser();

  if (!user) {
    return (
      <main>
        <h1>Installer Wholesale Portal</h1>
        <p>Exclusive wholesale pricing for certified Brightworks installer partners.</p>
        <p>
          <Link href="/login?redirect=/installer" className="btn">Sign in to access</Link>
        </p>
        <p className="muted">
          Not yet certified?{" "}
          <Link href="/installer/apply">Apply for installer access</Link>
        </p>
      </main>
    );
  }

  const verified = await isInstallerVerified(user.id);

  if (!verified) {
    return (
      <main>
        <h1>Installer Wholesale Portal</h1>
        <p>This portal is exclusive to verified Brightworks installer partners.</p>
        <div className="card">
          <p>
            Your account <strong>{user.email}</strong> does not yet have verified installer
            access.
          </p>
          <p>
            <Link href="/installer/apply" className="btn">
              Apply for Installer Access
            </Link>
          </p>
        </div>
        <p className="muted">
          Already applied? Our team reviews applications within 2–3 business days. Contact{" "}
          <a href="mailto:partners@usebrightworks.com">partners@usebrightworks.com</a> for
          status updates.
        </p>
      </main>
    );
  }

  const categories = [...new Set(CATALOG.map((p) => p.category))];

  return (
    <main>
      <h1>Installer Wholesale Portal</h1>
      <p>
        Certified installer pricing — 20% volume discount off standard retail rates. Prices shown
        are your net wholesale cost.
      </p>

      {categories.map((cat) => (
        <section key={cat}>
          <h2>{cat}</h2>
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
              {CATALOG.filter((p) => p.category === cat).map((product) => {
                const ws = wholesalePrice(product.retailPrice);
                const savings = product.retailPrice - ws;
                return (
                  <tr key={product.sku}>
                    <td>
                      <code>{product.sku}</code>
                    </td>
                    <td>
                      <strong>{product.name}</strong>
                      <br />
                      <span className="muted">{product.description}</span>
                    </td>
                    <td>{usd(product.retailPrice)}</td>
                    <td>
                      <strong>{usd(ws)}</strong>
                    </td>
                    <td className="muted">{usd(savings)} off</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}

      <div className="card">
        <h2>Place a Wholesale Order</h2>
        <p>
          To order at wholesale pricing, contact your account representative or email{" "}
          <a href="mailto:wholesale@usebrightworks.com">wholesale@usebrightworks.com</a> with
          your desired SKUs and quantities.
        </p>
        <p className="muted">
          Minimum order: 5 units per SKU. Net-30 terms available for established accounts.
        </p>
      </div>
    </main>
  );
}
