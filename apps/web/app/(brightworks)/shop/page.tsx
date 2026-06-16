import type { JSX } from "react";
import Link from "next/link";
import { listSkus, formatPrice } from "@/lib/brightworks/skus";

export const metadata = {
  title: "Shop — Brightworks",
  description:
    "Professional permanent holiday lighting products: weatherproof timers, connectors, and roofline install kits.",
};

export default async function ShopPage(): Promise<JSX.Element> {
  const skus = await listSkus();

  return (
    <main>
      <h1>Shop</h1>
      <p>
        Professional-grade permanent holiday lighting — built to last, certified safe.
      </p>

      <div style={{ marginTop: "1.5rem" }}>
        <Link href="/shop/weatherproof-timer" className="btn">
          View Featured Product
        </Link>
      </div>

      {skus.length === 0 ? (
        <div className="empty" style={{ marginTop: "2rem" }}>
          <p>Products are coming soon. Check back shortly.</p>
        </div>
      ) : (
        <table style={{ marginTop: "2rem" }}>
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>Price</th>
              <th>Rating</th>
              <th>Certification</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {skus.map((sku) => (
              <tr key={sku.id}>
                <td>
                  <strong>{sku.name}</strong>
                  <br />
                  <span className="muted">{sku.description}</span>
                </td>
                <td style={{ textTransform: "capitalize" }}>{sku.category}</td>
                <td>{formatPrice(sku.price_cents)}</td>
                <td>
                  {sku.ip_rating ? (
                    <span className="muted">{sku.ip_rating}</span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  {sku.ip_rating && sku.has_valid_cert ? (
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        background: "#166534",
                        color: "#fff",
                        borderRadius: 4,
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        letterSpacing: "0.04em",
                      }}
                    >
                      {sku.ip_rating} Certified
                    </span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  <Link href={`/shop/${sku.slug}`} className="btn secondary">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="card" style={{ marginTop: "2rem" }}>
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          IP65 certification badges are displayed only when a current NRTL
          (UL/ETL) certification record is on file, in compliance with FTC Act
          §5 substantiation requirements.
        </p>
      </div>
    </main>
  );
}
