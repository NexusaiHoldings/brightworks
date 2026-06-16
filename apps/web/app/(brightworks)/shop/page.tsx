import type { JSX } from "react";
import Link from "next/link";
import { listSkusWithCertStatus } from "@/lib/brightworks/skus";

export const metadata = {
  title: "Shop — Brightworks",
  description:
    "Weatherproof lighting timers and accessories for professional roofline installations.",
};

export default async function ShopPage(): Promise<JSX.Element> {
  const skus = await listSkusWithCertStatus();

  return (
    <main>
      <h1>Shop</h1>
      <p>
        Professional-grade weatherproof lighting accessories for seasonal
        roofline installations.
      </p>

      {skus.length === 0 ? (
        <div className="empty">
          <p>Products coming soon. Check back shortly.</p>
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {skus.map((sku) => (
            <li key={sku.id} className="card" style={{ marginBottom: "1rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "1rem",
                }}
              >
                <div style={{ flex: 1 }}>
                  <h2 style={{ marginBottom: "0.25rem" }}>
                    <Link href={`/shop/${sku.slug}`}>{sku.name}</Link>
                  </h2>
                  {sku.description && (
                    <p className="muted" style={{ marginBottom: "0.5rem" }}>
                      {sku.description}
                    </p>
                  )}
                  <p style={{ fontWeight: 600, margin: 0 }}>
                    ${(sku.price_cents / 100).toFixed(2)}
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    alignItems: "flex-end",
                    flexShrink: 0,
                  }}
                >
                  {sku.has_ip65 && (
                    <span
                      style={{
                        background: "#16a34a",
                        color: "#fff",
                        padding: "0.2rem 0.6rem",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                        whiteSpace: "nowrap",
                      }}
                      title="IP65 rating verified by accredited NRTL laboratory"
                    >
                      IP65 Certified
                    </span>
                  )}
                  <Link href={`/shop/${sku.slug}`} className="btn secondary">
                    View Details
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
