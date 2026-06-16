/**
 * Shop index — Brightworks product catalog (F1-002).
 *
 * Lists all active SKUs. IP65 badge is rendered only when a currently-valid
 * certification record exists (FTC Act Section 5 substantiation requirement).
 * Server component; no client interactivity needed for a static listing.
 */
import type { JSX } from "react";
import Link from "next/link";
import { listActiveSkus, formatPrice } from "@/lib/brightworks/skus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ShopPage(): Promise<JSX.Element> {
  const skus = await listActiveSkus();

  return (
    <main>
      <h1>Shop</h1>
      <p>
        Professional-grade outdoor lighting accessories for residential and
        commercial roofline installations. Every product meets or exceeds
        NRTL-certified safety standards.
      </p>

      <Link href="/shop/order" className="btn">
        Request a Quote
      </Link>

      {skus.length === 0 ? (
        <div className="empty">
          <p>Products coming soon — check back shortly.</p>
        </div>
      ) : (
        <div>
          {skus.map((sku) => (
            <article key={sku.id} className="card">
              {sku.image_url ? (
                <img
                  src={sku.image_url}
                  alt={sku.name}
                  style={{
                    width: "100%",
                    maxHeight: 220,
                    objectFit: "cover",
                    borderRadius: 6,
                    marginBottom: 12,
                  }}
                />
              ) : null}

              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, flex: 1 }}>{sku.name}</h2>
                {sku.has_ip65 ? (
                  <span
                    aria-label="IP65 weatherproof certified"
                    title="IP65 weatherproof certified — NRTL lab verified"
                    style={{
                      display: "inline-block",
                      background: "#1d4ed8",
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      padding: "2px 8px",
                      borderRadius: 4,
                      whiteSpace: "nowrap",
                    }}
                  >
                    IP65
                  </span>
                ) : null}
              </div>

              <p className="muted" style={{ margin: "4px 0 0" }}>
                {sku.category}
              </p>

              {sku.description ? (
                <p style={{ margin: "8px 0 0" }}>{sku.description}</p>
              ) : null}

              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 18 }}>{formatPrice(sku.price_cents)}</strong>
                <Link href={`/shop/${sku.slug}`} className="btn secondary">
                  View Details
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
