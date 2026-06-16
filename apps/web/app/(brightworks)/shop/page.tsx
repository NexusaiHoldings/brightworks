/**
 * Shop listing page (F1-002).
 *
 * Displays the three launch SKUs. IP65 badge rendered only when a valid
 * NRTL certification record exists — enforces FTC Act Section 5
 * substantiation requirement identified in data_findings.
 */
import type { JSX } from "react";
import Link from "next/link";
import {
  listActiveSkus,
  formatPrice,
  hasValidCertification,
} from "@/lib/brightworks/skus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ShopPage(): Promise<JSX.Element> {
  const skus = await listActiveSkus();
  const company = process.env.COMPANY_NAME ?? "Brightworks";

  return (
    <main>
      <h1>Shop</h1>
      <p>Professional roofline lighting products from {company}.</p>
      {skus.length === 0 ? (
        <p className="empty">Products are being prepared — check back soon.</p>
      ) : (
        <div>
          {skus.map((sku) => {
            const certified = hasValidCertification(sku);
            return (
              <article key={sku.slug} className="card">
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
                <p>
                  <strong>{formatPrice(sku.price_cents)}</strong>
                  {sku.ip_rating && certified ? (
                    <>
                      {" "}
                      <span
                        title="NRTL certified weatherproof rating — UL/ETL file on record"
                        style={{
                          background: "#1d4ed8",
                          color: "#fff",
                          borderRadius: 4,
                          padding: "2px 7px",
                          fontSize: 12,
                          fontWeight: 700,
                          marginLeft: 4,
                        }}
                      >
                        {sku.ip_rating}
                      </span>
                    </>
                  ) : null}
                </p>
                {sku.description ? <p>{sku.description}</p> : null}
                <p>
                  <Link href={`/shop/${sku.slug}`} className="btn">
                    View Details
                  </Link>
                </p>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
