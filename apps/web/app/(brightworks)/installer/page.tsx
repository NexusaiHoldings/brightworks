import { requireInstallerAccess, wholesalePrice } from "@/lib/brightworks/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = {
  title: "Installer Wholesale Portal | Brightworks",
  description: "Exclusive wholesale pricing for Brightworks-certified installers.",
};

interface Product {
  sku: string;
  name: string;
  category: string;
  unit: string;
  retailPrice: number;
}

const CATALOG: Product[] = [
  { sku: "PNT-INT-GLS-01", name: "Premium Interior Paint – Gloss", category: "Interior Paint", unit: "gal", retailPrice: 68.0 },
  { sku: "PNT-INT-SAT-01", name: "Premium Interior Paint – Satin", category: "Interior Paint", unit: "gal", retailPrice: 65.0 },
  { sku: "PNT-INT-EGG-01", name: "Premium Interior Paint – Eggshell", category: "Interior Paint", unit: "gal", retailPrice: 63.0 },
  { sku: "PNT-INT-MAT-01", name: "Premium Interior Paint – Matte", category: "Interior Paint", unit: "gal", retailPrice: 60.0 },
  { sku: "PNT-EXT-SAT-01", name: "Exterior Weather Shield – Satin", category: "Exterior Paint", unit: "gal", retailPrice: 78.0 },
  { sku: "PNT-EXT-FLT-01", name: "Exterior Weather Shield – Flat", category: "Exterior Paint", unit: "gal", retailPrice: 74.0 },
  { sku: "PNT-EXT-SHN-01", name: "Exterior Weather Shield – Semi-Gloss", category: "Exterior Paint", unit: "gal", retailPrice: 80.0 },
  { sku: "PRM-INT-01", name: "Interior Primer/Sealer", category: "Primer", unit: "gal", retailPrice: 42.0 },
  { sku: "PRM-EXT-01", name: "Exterior High-Build Primer", category: "Primer", unit: "gal", retailPrice: 48.0 },
  { sku: "PRM-STN-01", name: "Stain-Blocking Shellac Primer", category: "Primer", unit: "gal", retailPrice: 54.0 },
  { sku: "CAU-INT-01", name: "Paintable Interior Caulk", category: "Prep & Caulk", unit: "10.1 oz", retailPrice: 9.5 },
  { sku: "CAU-EXT-01", name: "Exterior Elastomeric Caulk", category: "Prep & Caulk", unit: "10.1 oz", retailPrice: 11.0 },
  { sku: "CAU-SIL-01", name: "Silicone Caulk – Clear", category: "Prep & Caulk", unit: "10.1 oz", retailPrice: 8.5 },
  { sku: "ACC-BRS-2IN-01", name: "Angle Sash Brush – 2 in", category: "Applicators", unit: "each", retailPrice: 18.0 },
  { sku: "ACC-BRS-3IN-01", name: "Angle Sash Brush – 3 in", category: "Applicators", unit: "each", retailPrice: 22.0 },
  { sku: "ACC-ROL-9IN-01", name: "9 in. Professional Roller Kit", category: "Applicators", unit: "kit", retailPrice: 28.0 },
  { sku: "ACC-TRAY-01", name: "Heavy-Duty Roller Tray", category: "Applicators", unit: "each", retailPrice: 12.5 },
  { sku: "ACC-EXT-POL-01", name: "Extension Pole – 4–8 ft", category: "Applicators", unit: "each", retailPrice: 32.0 },
  { sku: "SHD-FAN-01", name: "1500-Chip Color Fan Deck", category: "Color Tools", unit: "each", retailPrice: 55.0 },
  { sku: "SHD-CHR-01", name: "Color Chip Sample – 4×6 in (per sheet)", category: "Color Tools", unit: "sheet", retailPrice: 3.5 },
];

export default async function InstallerPortalPage() {
  const user = await requireInstallerAccess();

  const categories = Array.from(new Set(CATALOG.map((p) => p.category)));

  return (
    <main>
      <h1>Installer Wholesale Portal</h1>
      <p>
        Welcome, <strong>{user.email}</strong>. All prices shown below reflect
        your 20% installer volume discount — applied automatically at checkout.
        No coupon code needed.
      </p>

      <a href="/installer/apply" className="btn secondary">
        View / Update Installer Profile
      </a>

      {categories.map((cat) => {
        const products = CATALOG.filter((p) => p.category === cat);
        return (
          <section key={cat}>
            <h2>{cat}</h2>
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product</th>
                  <th>Unit</th>
                  <th>Retail</th>
                  <th>Your Price</th>
                  <th>Savings</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const wp = wholesalePrice(product.retailPrice);
                  const saving = Math.round((product.retailPrice - wp) * 100) / 100;
                  return (
                    <tr key={product.sku}>
                      <td>
                        <span className="muted">{product.sku}</span>
                      </td>
                      <td>{product.name}</td>
                      <td>{product.unit}</td>
                      <td>${product.retailPrice.toFixed(2)}</td>
                      <td>
                        <strong>${wp.toFixed(2)}</strong>
                      </td>
                      <td className="muted">${saving.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}

      <div className="card">
        <h3>Placing Wholesale Orders</h3>
        <p>
          Contact your Brightworks territory rep or call{" "}
          <a href="tel:+18005551234">1-800-555-1234</a> (Mon–Fri 7 am–5 pm PT)
          to place bulk orders. Minimum order: 10 gallons per SKU. Wholesale
          pricing is applied automatically to your account — no code required.
        </p>
        <p className="muted">
          Need a SKU not listed? Reach out to your rep for special orders,
          custom tints, and large-volume quotes.
        </p>
      </div>
    </main>
  );
}
