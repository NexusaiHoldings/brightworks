/**
 * Shop index — Brightworks product catalog (F1-002).
 *
 * Lists active SKUs. IP65 badge is shown only when a valid NRTL certification
 * record exists for the SKU (FTC Act Section 5 substantiation requirement).
 */
import type { JSX } from "react";
import Link from "next/link";
import { listSkus, formatPrice } from "@/lib/brightworks/skus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ShopPage(): Promise<JSX.Element> {
  const skus = await listSkus();

  return (
    <main>
      <h1>Shop</h1>
      <p>
        Professional-grade outdoor lighting products built for residential
        roofline installations.
      </p>

      {skus.length === 0 ? (
        <div className="empty">
          <p>Products coming soon. Check back shortly.</p>
        </div>
      ) : (
        <div>
          {skus.map((sku) => (
            <article key={sku.id} className="card">
              {sku.image_url ? (
                <Link href={`/shop/${sku.slug}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sku.image_url}
                    alt={sku.name}
                    style={{
                      width: "100%",
                      borderRadius: 8,
                      marginBottom: 12,
                      aspectRatio: "4 / 3",
                      objectFit: "cover",
                    }}
                  />
                </Link>
              ) : null}

              <h2>
                <Link href={`/shop/${sku.slug}`}>{sku.name}</Link>
              </h2>

              {sku.description ? <p>{sku.description}</p> : null}

              <p>
                <strong>{formatPrice(sku.price_cents)}</strong>
                {sku.has_valid_certification ? (
                  <>
                    {" "}
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: "#0369a1",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 600,
                        letterSpacing: "0.04em",
                        verticalAlign: "middle",
                      }}
                      title="NRTL-certified IP65 weatherproof rating"
                    >
                      IP65
                    </span>
                  </>
                ) : null}
              </p>

              <p>
                <Link href={`/shop/${sku.slug}`} className="btn">
                  View details
                </Link>
              </p>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
