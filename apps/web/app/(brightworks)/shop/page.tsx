/**
 * /shop — Brightworks product catalog (F1-002).
 *
 * Server component. IP65 badge rendered only when a valid NRTL certification
 * record exists for the SKU (FTC Act Section 5 substantiation requirement).
 */

import type { JSX } from "react";
import { listActiveSkus, hasIp65Certification, formatPrice } from "@/lib/brightworks/skus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = {
  title: "Shop — Brightworks",
  description:
    "Weatherproof outdoor lighting products. Professional-grade holiday and landscape lighting systems.",
};

export default async function ShopPage(): Promise<JSX.Element> {
  const skus = await listActiveSkus();

  return (
    <main>
      <h1>Shop</h1>
      <p>
        Professional-grade weatherproof lighting products for residential and
        commercial installations.
      </p>

      {skus.length === 0 ? (
        <div className="empty">
          <p>Products are being prepared — check back soon.</p>
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {skus.map((sku) => {
            const ip65 = hasIp65Certification(sku);
            return (
              <li key={sku.slug} className="card" style={{ marginBottom: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <h2 style={{ margin: "0 0 0.25rem" }}>
                      <a href={`/shop/${sku.slug}`}>{sku.name}</a>
                    </h2>
                    {ip65 && (
                      <span
                        aria-label="IP65 weather-resistance certified"
                        style={{
                          display: "inline-block",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          padding: "0.15rem 0.5rem",
                          borderRadius: "4px",
                          background: "#1d4ed8",
                          color: "#fff",
                          marginBottom: "0.5rem",
                        }}
                      >
                        IP65 Certified
                      </span>
                    )}
                    {sku.description && (
                      <p className="muted" style={{ margin: "0.25rem 0 0" }}>
                        {sku.description}
                      </p>
                    )}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
                      {formatPrice(sku.price_cents)}
                    </p>
                    <p className="muted" style={{ margin: "0.25rem 0 0", textTransform: "capitalize" }}>
                      {sku.category}
                    </p>
                  </div>
                </div>
                <div style={{ marginTop: "0.75rem" }}>
                  <a href={`/shop/${sku.slug}`} className="btn secondary">
                    View Details
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
